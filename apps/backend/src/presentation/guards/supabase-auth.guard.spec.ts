import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { SupabaseAuthGuard } from "./supabase-auth.guard";
import * as jwt from "jsonwebtoken";
import { generateKeyPairSync } from "node:crypto";

describe("SupabaseAuthGuard", () => {
  let guard: SupabaseAuthGuard;
  let prisma: { userRole: { findMany: jest.Mock }; profile: { findUnique: jest.Mock } };
  let n = 0;
  /** Unique user id per test: the guard caches identities per user for a short time. */
  const uid = () => `user-${++n}`;

  beforeEach(() => {
    prisma = {
      userRole: { findMany: jest.fn().mockResolvedValue([{ role: "recruiter" }]) },
      profile: { findUnique: jest.fn().mockResolvedValue({ org_id: "org-1" }) },
    };
    guard = new SupabaseAuthGuard(prisma as any);
    delete process.env.JWT_SECRET;
  });

  const createMockContext = (authHeader?: string): ExecutionContext => {
    const req = {
      headers: {
        authorization: authHeader,
      },
      user: undefined,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as any;
  };

  it("should throw UnauthorizedException if authorization header is missing", async () => {
    const context = createMockContext(undefined);
    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException("Missing authorization header"),
    );
  });

  it("should throw UnauthorizedException if header is not Bearer", async () => {
    const context = createMockContext("Basic 12345");
    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException("Invalid authorization format. Bearer token expected."),
    );
  });

  it("should decode token without verification when JWT_SECRET is not configured", async () => {
    const id = uid();
    const payload = { sub: id, email: "test@example.com" };
    const token = jwt.sign(payload, "dummy-secret");
    const context = createMockContext(`Bearer ${token}`);

    const canActivate = await guard.canActivate(context);

    expect(canActivate).toBe(true);
    const req = context.switchToHttp().getRequest();
    expect(req.user).toEqual({
      userId: id,
      email: "test@example.com",
      role: "recruiter",
      orgId: "org-1",
      orgFromProfile: "org-1",
      claims: expect.objectContaining({ sub: id }),
    });
  });

  it("takes role and organization from the database, NOT from user-editable user_metadata", async () => {
    // A candidate who edited their own metadata to claim admin of another organization:
    prisma.userRole.findMany.mockResolvedValue([{ role: "candidate" }]);
    prisma.profile.findUnique.mockResolvedValue({ org_id: "real-org" });
    const id = uid();
    const token = jwt.sign(
      { sub: id, user_metadata: { role: "admin", orgId: "someone-elses-org" } },
      "dummy-secret",
    );
    const context = createMockContext(`Bearer ${token}`);

    await guard.canActivate(context);

    const user = context.switchToHttp().getRequest().user;
    expect(user.role).toBe("candidate");
    expect(user.orgId).toBe("real-org");
    expect(user.orgFromProfile).toBe("real-org");
  });

  it("uses the most privileged role when a user holds several", async () => {
    prisma.userRole.findMany.mockResolvedValue([
      { role: "candidate" },
      { role: "admin" },
      { role: "recruiter" },
    ]);
    const context = createMockContext(`Bearer ${jwt.sign({ sub: uid() }, "dummy-secret")}`);
    await guard.canActivate(context);
    expect(context.switchToHttp().getRequest().user.role).toBe("admin");
  });

  it("falls back to candidate and the explicit default organization when the user has neither", async () => {
    prisma.userRole.findMany.mockResolvedValue([]);
    prisma.profile.findUnique.mockResolvedValue(null);
    const context = createMockContext(`Bearer ${jwt.sign({ sub: uid() }, "dummy-secret")}`);
    await guard.canActivate(context);
    const user = context.switchToHttp().getRequest().user;
    expect(user.role).toBe("candidate");
    expect(user.orgId).toBe("00000000-0000-0000-0000-000000000000");
    expect(user.orgFromProfile).toBeUndefined();
  });

  it("caches the identity briefly instead of querying the database on every request", async () => {
    const id = uid();
    const token = jwt.sign({ sub: id }, "dummy-secret");
    await guard.canActivate(createMockContext(`Bearer ${token}`));
    await guard.canActivate(createMockContext(`Bearer ${token}`));
    expect(prisma.userRole.findMany).toHaveBeenCalledTimes(1);
  });

  it("should verify token when JWT_SECRET is configured", async () => {
    process.env.JWT_SECRET = "my-secret-key-is-very-long";
    const payload = { sub: "user-456", email: "admin@example.com" };
    const token = jwt.sign(payload, process.env.JWT_SECRET);
    const context = createMockContext(`Bearer ${token}`);

    const canActivate = await guard.canActivate(context);

    expect(canActivate).toBe(true);
    const req = context.switchToHttp().getRequest();
    expect(req.user.userId).toBe("user-456");
  });

  it("should throw UnauthorizedException if verification fails", async () => {
    process.env.JWT_SECRET = "my-secret-key-is-very-long";
    const token = jwt.sign({ sub: "user-456" }, "different-secret");
    const context = createMockContext(`Bearer ${token}`);

    await expect(guard.canActivate(context)).rejects.toThrow(expect.any(UnauthorizedException));
  });

  describe("asymmetric (ES256) tokens via JWKS", () => {
    const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test-kid", alg: "ES256" };
    const originalFetch = global.fetch;

    beforeEach(() => {
      process.env.SUPABASE_JWKS_URL = "https://example.test/jwks.json";
      global.fetch = jest
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ keys: [jwk] }) }) as any;
    });
    afterEach(() => {
      global.fetch = originalFetch;
      delete process.env.SUPABASE_JWKS_URL;
    });

    it("should verify an ES256 token against the JWKS", async () => {
      const token = jwt.sign({ sub: "user-es", email: "a@b.c" }, privateKey, {
        algorithm: "ES256",
        keyid: "test-kid",
      });
      const context = createMockContext(`Bearer ${token}`);

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(context.switchToHttp().getRequest().user.userId).toBe("user-es");
    });

    it("should reject an ES256 token signed by a different key", async () => {
      const other = generateKeyPairSync("ec", { namedCurve: "P-256" });
      const token = jwt.sign({ sub: "evil" }, other.privateKey, {
        algorithm: "ES256",
        keyid: "test-kid",
      });

      await expect(guard.canActivate(createMockContext(`Bearer ${token}`))).rejects.toThrow(
        expect.any(UnauthorizedException),
      );
    });
  });
});
