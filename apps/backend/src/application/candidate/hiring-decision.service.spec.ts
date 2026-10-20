import { BadRequestException, ConflictException } from "@nestjs/common";
import { HiringDecisionService, isOverride } from "./hiring-decision.service";

const actor = { userId: "u1", email: "recruiter@x.com", orgId: "org-1" };

describe("isOverride", () => {
  it("flags decisions that go against the AI, or that have no AI view at all", () => {
    expect(isOverride("hire", "strong_no_hire")).toBe(true);
    expect(isOverride("hire", "no_hire")).toBe(true);
    expect(isOverride("reject", "hire")).toBe(true);
    expect(isOverride("reject", "strong_hire")).toBe(true);
    expect(isOverride("hire", "hire")).toBe(false);
    expect(isOverride("reject", "no_hire")).toBe(false);
    expect(isOverride("hold", "hire")).toBe(false);
    expect(isOverride("hire", null)).toBe(true);
    expect(isOverride("hold", null)).toBe(false);
  });
});

describe("HiringDecisionService.decide", () => {
  let prisma: any;
  let workflow: any;
  let service: HiringDecisionService;

  const reviewCandidate = {
    id: "c1",
    org_id: "org-1",
    status: "recruiter_review",
    deleted_at: null,
  };
  const withReport = (recommendation: string | null) =>
    prisma.interview.findFirst.mockResolvedValue(
      recommendation
        ? { id: "i1", reports: { recommendation, scores: { a: 80, b: 90 }, integrity_score: "95" } }
        : null,
    );

  beforeEach(() => {
    prisma = {
      candidate: { findUnique: jest.fn().mockResolvedValue(reviewCandidate), findMany: jest.fn() },
      interview: { findFirst: jest.fn() },
      candidateDecision: {
        create: jest.fn(async ({ data }: any) => ({ id: "d1", ...data })),
        findMany: jest.fn(),
      },
    };
    workflow = { transition: jest.fn(), logTimeline: jest.fn() };
    service = new HiringDecisionService(prisma, workflow);
    withReport("hire");
  });

  it("hire that agrees with the AI needs no note and moves the candidate to hiring_decision", async () => {
    const rec = await service.decide("c1", "hire", undefined, actor);

    expect(rec).toMatchObject({
      decision: "hire",
      overrode_ai: false,
      decided_by: "u1",
      ai_recommendation: "hire",
      ai_score: 85,
    });
    expect(workflow.transition).toHaveBeenCalledWith(
      "c1",
      "hiring_decision",
      expect.any(String),
      expect.objectContaining({
        decision: "hire",
        decidedBy: "recruiter@x.com",
        overrodeAi: false,
      }),
    );
  });

  it("overriding the AI requires a written reason", async () => {
    withReport("strong_no_hire");
    await expect(service.decide("c1", "hire", "ok", actor)).rejects.toThrow(/overriding the AI/);
    expect(prisma.candidateDecision.create).not.toHaveBeenCalled();
    expect(workflow.transition).not.toHaveBeenCalled();

    const rec = await service.decide("c1", "hire", "Great portfolio, interview misjudged", actor);
    expect(rec.overrode_ai).toBe(true);
  });

  it("rejection always requires a note, then archives the candidate", async () => {
    withReport("no_hire");
    await expect(service.decide("c1", "reject", "", actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    await service.decide("c1", "reject", "Not enough depth in system design", actor);
    expect(workflow.transition).toHaveBeenCalledWith(
      "c1",
      "archived",
      expect.stringContaining("Rejected: Not enough depth"),
      expect.any(Object),
    );
  });

  it("hold is recorded on the timeline and keeps the candidate in review", async () => {
    await service.decide("c1", "hold", "Waiting for the reference check", actor);
    expect(workflow.transition).not.toHaveBeenCalled();
    expect(workflow.logTimeline).toHaveBeenCalledWith(
      "c1",
      "decision_hold",
      expect.any(String),
      "Waiting for the reference check",
      expect.any(Object),
    );
  });

  it("refuses candidates that are not awaiting a decision, and unknown ones", async () => {
    prisma.candidate.findUnique.mockResolvedValue({
      ...reviewCandidate,
      status: "interview_running",
    });
    await expect(service.decide("c1", "hire", "note note note", actor)).rejects.toBeInstanceOf(
      ConflictException,
    );

    prisma.candidate.findUnique.mockResolvedValue(null);
    await expect(service.decide("c1", "hire", "note note note", actor)).rejects.toThrow(
      /not found/,
    );
  });

  it("rejects an invalid decision value", async () => {
    await expect(service.decide("c1", "maybe" as any, "note note note", actor)).rejects.toThrow(
      /hire, hold or reject/,
    );
  });

  it("without any AI report, a hire needs a reason (no basis to agree with)", async () => {
    withReport(null);
    await expect(service.decide("c1", "hire", undefined, actor)).rejects.toThrow(
      /overriding the AI/,
    );
  });
});
