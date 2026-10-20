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
  let queue: any;
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
        findFirst: jest.fn(),
        update: jest.fn(async ({ data }: any) => ({ id: "d1", ...data })),
      },
    };
    workflow = { transition: jest.fn(), logTimeline: jest.fn() };
    queue = { enqueue: jest.fn() };
    service = new HiringDecisionService(prisma, workflow, queue);
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

  describe("notifyOutcome", () => {
    const decision = (over: any = {}) => ({
      id: "d1",
      org_id: "org-1",
      decision: "reject",
      note: "internal: weak system design, AI score 59",
      outcome_notified_at: null,
      ...over,
    });
    const person = { userId: "u1", email: "recruiter@x.com", orgId: "org-1" };

    beforeEach(() => {
      prisma.candidate.findUnique.mockResolvedValue({
        id: "c1",
        email: "cand@x.com",
        full_name: "Jane Doe",
        role_applied: "Backend Engineer",
      });
      prisma.candidateDecision.findFirst.mockResolvedValue(decision());
    });

    it("queues one outcome email, marks it as sent and logs it on the timeline", async () => {
      const rec = await service.notifyOutcome("c1", person, "We wish you the best.");

      expect(queue.enqueue).toHaveBeenCalledWith("send-notification", {
        orgId: "org-1",
        kind: "candidate_outcome",
        recipientEmail: "cand@x.com",
        payload: {
          decisionId: "d1",
          candidateName: "Jane Doe",
          role: "Backend Engineer",
          outcome: "reject",
          message: "We wish you the best.",
        },
      });
      expect(prisma.candidateDecision.update).toHaveBeenCalledWith({
        where: { id: "d1" },
        data: { outcome_notified_at: expect.any(Date), outcome_notified_by: "recruiter@x.com" },
      });
      expect(workflow.logTimeline).toHaveBeenCalledWith(
        "c1",
        "outcome_email_sent",
        expect.any(String),
        expect.any(String),
        expect.any(Object),
      );
      expect(rec.outcome_notified_by).toBe("recruiter@x.com");
    });

    it("never puts the internal note or any AI data in the email payload", async () => {
      await service.notifyOutcome("c1", person);
      const payload = queue.enqueue.mock.calls[0][1].payload;
      expect(JSON.stringify(payload)).not.toMatch(/internal|AI score|weak system design/i);
      expect(Object.keys(payload).sort()).toEqual([
        "candidateName",
        "decisionId",
        "message",
        "outcome",
        "role",
      ]);
    });

    it("refuses a second send for the same decision", async () => {
      prisma.candidateDecision.findFirst.mockResolvedValue(
        decision({ outcome_notified_at: new Date() }),
      );
      await expect(service.notifyOutcome("c1", person)).rejects.toBeInstanceOf(ConflictException);
      expect(queue.enqueue).not.toHaveBeenCalled();
    });

    it("refuses when there is no hire/reject decision (e.g. only a hold)", async () => {
      prisma.candidateDecision.findFirst.mockResolvedValue(null);
      await expect(service.notifyOutcome("c1", person)).rejects.toThrow(
        /no hire or reject decision/,
      );
      expect(queue.enqueue).not.toHaveBeenCalled();
    });
  });
});
