import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { SupabaseAuthGuard } from "./supabase-auth.guard";
import * as jwt from "jsonwebtoken";

describe("SupabaseAuthGuard", () => {
  let guard: SupabaseAuthGuard;

  beforeEach(() => {
    guard = new SupabaseAuthGuard();
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
      new UnauthorizedException("Missing authorization header")
    );
  });

  it("should throw UnauthorizedException if header is not Bearer", async () => {
    const context = createMockContext("Basic 12345");
    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException("Invalid authorization format. Bearer token expected.")
    );
  });

  it("should decode token without verification when JWT_SECRET is not configured", async () => {
    const payload = {
      sub: "user-123",
      email: "test@example.com",
      user_metadata: { role: "recruiter", orgId: "org-1" },
    };
    const token = jwt.sign(payload, "dummy-secret");
    const context = createMockContext(`Bearer ${token}`);

    const canActivate = await guard.canActivate(context);

    expect(canActivate).toBe(true);
    const req = context.switchToHttp().getRequest();
    expect(req.user).toEqual({
      userId: "user-123",
      email: "test@example.com",
      role: "recruiter",
      orgId: "org-1",
      claims: expect.objectContaining({ sub: "user-123" }),
    });
  });

  it("should verify token when JWT_SECRET is configured", async () => {
    process.env.JWT_SECRET = "my-secret-key-is-very-long";
    const payload = {
      sub: "user-456",
      email: "admin@example.com",
      user_metadata: { role: "admin", orgId: "org-2" },
    };
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

    await expect(guard.canActivate(context)).rejects.toThrow(
      expect.any(UnauthorizedException)
    );
  });
});
