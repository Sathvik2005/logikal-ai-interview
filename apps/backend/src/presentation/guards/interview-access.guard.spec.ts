import { InterviewAccessGuard } from "./interview-access.guard";

const ctx = (req: any) => ({ switchToHttp: () => ({ getRequest: () => req }) }) as any;

describe("InterviewAccessGuard", () => {
  let prisma: any;
  let guard: InterviewAccessGuard;
  const interview = { org_id: "org-1", candidate: { user_id: "cand-user" } };

  beforeEach(() => {
    prisma = {
      interviewSession: { findUnique: jest.fn().mockResolvedValue({ interview }) },
      interview: { findUnique: jest.fn().mockResolvedValue(interview) },
    };
    guard = new InterviewAccessGuard(prisma);
  });

  it("lets a candidate act on their own session and interview", async () => {
    const user = { userId: "cand-user", role: "candidate" };
    await expect(
      guard.canActivate(ctx({ user, params: { sessionId: "s1" }, body: {} })),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(ctx({ user, params: {}, body: { interviewId: "i1" } })),
    ).resolves.toBe(true);
  });

  it("refuses a candidate acting on someone else's session or interview", async () => {
    const user = { userId: "other-candidate", role: "candidate" };
    await expect(
      guard.canActivate(ctx({ user, params: { sessionId: "s1" }, body: {} })),
    ).resolves.toBe(false);
    await expect(
      guard.canActivate(ctx({ user, params: {}, body: { interviewId: "i1" } })),
    ).resolves.toBe(false);
  });

  it("reads the session id from the body too (end-session / snapshot upload)", async () => {
    const user = { userId: "other-candidate", role: "candidate" };
    await expect(
      guard.canActivate(ctx({ user, params: {}, body: { sessionId: "s1" } })),
    ).resolves.toBe(false);
    expect(prisma.interviewSession.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "s1" } }),
    );
  });

  it("refuses a candidate when the interview does not exist or the request targets nothing", async () => {
    const user = { userId: "cand-user", role: "candidate" };
    prisma.interviewSession.findUnique.mockResolvedValue(null);
    await expect(
      guard.canActivate(ctx({ user, params: { sessionId: "nope" }, body: {} })),
    ).resolves.toBe(false);
    await expect(guard.canActivate(ctx({ user, params: {}, body: {} }))).resolves.toBe(false);
  });

  it("lets recruiters in the same organization through, and blocks other organizations", async () => {
    const same = { userId: "r", role: "recruiter", orgFromProfile: "org-1" };
    const other = { userId: "r2", role: "recruiter", orgFromProfile: "org-2" };
    await expect(
      guard.canActivate(ctx({ user: same, params: { sessionId: "s1" }, body: {} })),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(ctx({ user: other, params: { sessionId: "s1" }, body: {} })),
    ).resolves.toBe(false);
  });

  it("refuses a recruiter that has no organization", async () => {
    const recruiter = { userId: "r", role: "recruiter" };
    await expect(
      guard.canActivate(ctx({ user: recruiter, params: { sessionId: "s1" }, body: {} })),
    ).resolves.toBe(false);
  });

  it("does not restrict an admin without an organization, and lets staff reach a handler's own not-found", async () => {
    const staff = { userId: "r", role: "admin" };
    await expect(
      guard.canActivate(ctx({ user: staff, params: { sessionId: "s1" }, body: {} })),
    ).resolves.toBe(true);
    prisma.interviewSession.findUnique.mockResolvedValue(null);
    await expect(
      guard.canActivate(ctx({ user: staff, params: { sessionId: "nope" }, body: {} })),
    ).resolves.toBe(true);
  });

  it("refuses requests with no authenticated user", async () => {
    await expect(guard.canActivate(ctx({ params: {}, body: {} }))).resolves.toBe(false);
  });
});
