import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import * as jwt from "jsonwebtoken";
import { createPublicKey, KeyObject } from "node:crypto";

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

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers["authorization"];

    if (!authHeader) {
      throw new UnauthorizedException("Missing authorization header");
    }

    if (!authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("Invalid authorization format. Bearer token expected.");
    }

    const token = authHeader.split(" ")[1];
    try {
      const jwtSecret = process.env.JWT_SECRET;
      const hasSecret =
        !!jwtSecret &&
        jwtSecret !== "your-supabase-jwt-secret-used-for-validation" &&
        jwtSecret.length > 5;
      const header = jwt.decode(token, { complete: true })?.header;
      const alg = header?.alg ?? "";
      let decoded: any = null;

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

      if (!decoded) {
        throw new UnauthorizedException("Invalid authorization token claims.");
      }

      // Populate request user scope
      request.user = {
        userId: decoded.sub,
        email: decoded.email,
        role: decoded.user_metadata?.role || "candidate",
        orgId: decoded.user_metadata?.orgId || "00000000-0000-0000-0000-000000000000",
        claims: decoded,
      };

      return true;
    } catch (err) {
      throw new UnauthorizedException(
        `Authorization failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
