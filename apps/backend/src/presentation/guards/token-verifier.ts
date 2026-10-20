import { UnauthorizedException } from "@nestjs/common";
import * as jwt from "jsonwebtoken";
import { createPublicKey, KeyObject } from "node:crypto";
import { PrismaService } from "../../infrastructure/database/prisma.service";

/**
 * Shared access-token verification and identity lookup, used by the HTTP guard and the WebSocket gateway
 * so both enforce exactly the same rules.
 */

export const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000000";
const ROLE_PRIORITY = ["admin", "recruiter", "candidate"] as const;
const IDENTITY_TTL_MS = 60_000;
const identityCache = new Map<string, { at: number; role: string; orgId: string | null }>();

type Jwk = { kid?: string; kty: string; [k: string]: unknown };

const JWKS_TTL_MS = 10 * 60 * 1000;
let jwksCache: { fetchedAt: number; url: string; keys: Jwk[] } | null = null;

function jwksUrl(): string | null {
  if (process.env.SUPABASE_JWKS_URL) return process.env.SUPABASE_JWKS_URL;
  if (process.env.SUPABASE_URL) return `${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`;
  return null;
}

async function getJwks(url: string, force = false): Promise<Jwk[]> {
  if (
    !force &&
    jwksCache &&
    jwksCache.url === url &&
    Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS
  ) {
    return jwksCache.keys;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch JWKS (${res.status})`);
  const body = (await res.json()) as { keys?: Jwk[] };
  jwksCache = { fetchedAt: Date.now(), url, keys: body.keys ?? [] };
  return jwksCache.keys;
}

/** Verify an asymmetric (ES256/RS256) Supabase access token against the project JWKS. */
async function verifyWithJwks(
  token: string,
  kid: string | undefined,
  alg: string,
): Promise<jwt.JwtPayload> {
  const url = jwksUrl();
  if (!url) throw new Error("No JWKS URL configured (SUPABASE_JWKS_URL or SUPABASE_URL)");
  const find = (keys: Jwk[]) => keys.find((k) => !kid || k.kid === kid);
  let jwk = find(await getJwks(url));
  if (!jwk) jwk = find(await getJwks(url, true)); // key rotation
  if (!jwk) throw new Error("Signing key not found in JWKS");
  const key: KeyObject = createPublicKey({ key: jwk as never, format: "jwk" });
  return jwt.verify(token, key, { algorithms: [alg as jwt.Algorithm] }) as jwt.JwtPayload;
}

/** Verify a Supabase access token (ES256/RS256 via JWKS, or HS256 with JWT_SECRET) and return its claims. */
export async function verifyAccessToken(token: string): Promise<jwt.JwtPayload> {
  const jwtSecret = process.env.JWT_SECRET;
  const hasSecret =
    !!jwtSecret &&
    jwtSecret !== "your-supabase-jwt-secret-used-for-validation" &&
    jwtSecret.length > 5;
  const header = jwt.decode(token, { complete: true })?.header;
  const alg = header?.alg ?? "";
  let decoded: jwt.JwtPayload | string | null = null;

  if (alg && !alg.startsWith("HS")) {
    decoded = await verifyWithJwks(token, header?.kid, alg);
  } else if (hasSecret) {
    decoded = jwt.verify(token, jwtSecret as string);
  } else if (process.env.NODE_ENV !== "production") {
    // Fallback decode for local testing/development environments only
    decoded = jwt.decode(token);
  } else {
    throw new UnauthorizedException("JWT verification is not configured.");
  }
  if (!decoded || typeof decoded === "string") {
    throw new UnauthorizedException("Invalid authorization token claims.");
  }
  return decoded;
}

/**
 * Role and organization come from the database (`user_roles`, `profiles`), never from the token's
 * `user_metadata`: that field is editable by the signed-in user, so trusting it would let any user
 * make themselves an admin or join another organization. Cached briefly to avoid a query per request.
 */
export async function resolveIdentity(
  prisma: PrismaService,
  userId: string,
): Promise<{ role: string; orgId: string | null }> {
  const hit = identityCache.get(userId);
  if (hit && Date.now() - hit.at < IDENTITY_TTL_MS) return hit;
  const [roles, profile] = await Promise.all([
    prisma.userRole.findMany({ where: { user_id: userId }, select: { role: true } }),
    prisma.profile.findUnique({ where: { id: userId }, select: { org_id: true } }),
  ]);
  const held = new Set(roles.map((r) => r.role as string));
  const role = ROLE_PRIORITY.find((r) => held.has(r)) ?? "candidate";
  const identity = { at: Date.now(), role, orgId: profile?.org_id ?? null };
  identityCache.set(userId, identity);
  return identity;
}

/** The request-scoped user object built from a verified token plus the database identity. */
export async function buildRequestUser(prisma: PrismaService, claims: jwt.JwtPayload) {
  const identity = await resolveIdentity(prisma, String(claims.sub));
  return {
    userId: String(claims.sub),
    email: claims.email as string | undefined,
    role: identity.role,
    // Real organization from the profile; users without one share the explicit default organization.
    orgId: identity.orgId ?? DEFAULT_ORG_ID,
    // Set only when the user genuinely belongs to an organization (used for cross-organization checks).
    orgFromProfile: identity.orgId ?? undefined,
    claims,
  };
}
