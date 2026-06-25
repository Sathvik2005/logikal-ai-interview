import { Test, TestingModule } from "@nestjs/testing";
import { InterviewsController } from "./interviews.controller";
import { InterviewEngineService } from "../../application/interview/interview-engine.service";
import { CandidateWorkflowService } from "../../application/candidate/candidate-workflow.service";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { IQueueServiceToken } from "../../application/common/queue/queue.service";
import { SupabaseAuthGuard } from "../guards/supabase-auth.guard";
import { RolesGuard } from "../guards/roles.guard";

describe("InterviewsController", () => {
  let controller: InterviewsController;
  let prisma: any;
  let engine: any;
  let workflow: any;
  let queue: any;

  const mockPrisma = {
    interview: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    interviewTemplate: {
      create: jest.fn(),
    },
    candidate: {
      findUnique: jest.fn(),
    },
    interviewSession: {
      findFirst: jest.fn(),
    },
    interviewTurn: {
      findMany: jest.fn(),
    },
    interviewEvent: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    interviewReschedule: {
      create: jest.fn(),
    },
    personaVersion: {
      findFirst: jest.fn(),
    },
  };

  const mockEngine = {
    startSession: jest.fn(),
    endSession: jest.fn(),
    appendTurn: jest.fn(),
    getNextQuestion: jest.fn(),
    recordEvent: jest.fn(),
  };

  const mockWorkflow = {
    transition: jest.fn(),
  };

  const mockQueue = {
    enqueue: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InterviewsController],
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: InterviewEngineService,
          useValue: mockEngine,
        },
        {
          provide: CandidateWorkflowService,
          useValue: mockWorkflow,
        },
        {
          provide: IQueueServiceToken,
          useValue: mockQueue,
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<InterviewsController>(InterviewsController);
    prisma = module.get<PrismaService>(PrismaService);
    engine = module.get<InterviewEngineService>(InterviewEngineService);
    workflow = module.get<CandidateWorkflowService>(CandidateWorkflowService);
    queue = module.get(IQueueServiceToken);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("list", () => {
    it("should fetch lists with filter logic", async () => {
      const req = { user: { orgId: "org-1" } };
      mockPrisma.interview.findMany.mockResolvedValue([]);

      const result = await controller.list(req, "scheduled", "2026-06-20", "2026-06-25", "10");

      expect(mockPrisma.interview.findMany).toHaveBeenCalledWith({
        where: {
          org_id: "org-1",
          deleted_at: null,
          status: "scheduled",
          scheduled_at: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        },
        include: { candidate: true, job: true, template: true },
        orderBy: { scheduled_at: "asc" },
        take: 10,
      });
      expect(result).toEqual([]);
    });
  });

  describe("schedule", () => {
    it("should auto-create a template, schedule an interview, transition state and queue email", async () => {
      const req = { user: { orgId: "org-1", userId: "user-1" } };
      const body = {
        candidateId: "cand-1",
        jobId: "job-1",
        personaId: "p-1",
        scheduledAt: "2026-06-25T10:00:00Z",
      };

      mockPrisma.interviewTemplate.create.mockResolvedValue({ id: "temp-9" });
      mockPrisma.interview.create.mockResolvedValue({ id: "iv-5", org_id: "org-1" });
      mockPrisma.candidate.findUnique.mockResolvedValue({ id: "cand-1", full_name: "Alice", email: "alice@example.com", role_applied: "Dev" });
      mockPrisma.personaVersion.findFirst.mockResolvedValue({ id: "mock-persona-version-id" });
      
      const result = await controller.schedule(req, body);

      expect(mockPrisma.interviewTemplate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          org_id: "org-1",
          job_id: "job-1",
          persona_id: "p-1",
        }),
      });

      expect(mockPrisma.interview.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          org_id: "org-1",
          candidate_id: "cand-1",
          template_id: "temp-9",
          status: "scheduled",
        }),
      });

      expect(workflow.transition).toHaveBeenNthCalledWith(1, "cand-1", "interview_assigned", expect.any(String), { interviewId: "iv-5" });
      expect(workflow.transition).toHaveBeenNthCalledWith(2, "cand-1", "interview_scheduled", expect.any(String));
      expect(workflow.transition).toHaveBeenNthCalledWith(3, "cand-1", "invitation_sent", expect.any(String));

      expect(queue.enqueue).toHaveBeenCalledWith("send-notification", {
        orgId: "org-1",
        kind: "interview_invitation",
        recipientEmail: "alice@example.com",
        payload: {
          candidateName: "Alice",
          interviewId: "iv-5",
          role: "Dev",
        },
      });

      expect(result).toEqual({ id: "iv-5", org_id: "org-1" });
    });
  });

  describe("start", () => {
    it("should call engine.startSession", async () => {
      engine.startSession.mockResolvedValue({ id: "sess-1" });
      const result = await controller.start({ interviewId: "iv-5", deviceInfo: { x: 1 } });
      expect(engine.startSession).toHaveBeenCalledWith("iv-5", { x: 1 });
      expect(result).toEqual({ id: "sess-1" });
    });
  });

  describe("end", () => {
    it("should call engine.endSession", async () => {
      engine.endSession.mockResolvedValue(undefined);
      const result = await controller.end({ sessionId: "sess-1" });
      expect(engine.endSession).toHaveBeenCalledWith("sess-1");
      expect(result).toEqual({ status: "success" });
    });
  });

  describe("getTurns", () => {
    it("should return interview session turns", async () => {
      mockPrisma.interviewTurn.findMany.mockResolvedValue([]);
      const result = await controller.getTurns("sess-1");
      expect(mockPrisma.interviewTurn.findMany).toHaveBeenCalledWith({
        where: { session_id: "sess-1" },
        orderBy: { started_at: "asc" },
      });
      expect(result).toEqual([]);
    });
  });

  describe("appendTurn", () => {
    it("should delegate turn appending to engine", async () => {
      engine.appendTurn.mockResolvedValue({ id: "t-1" });
      const result = await controller.appendTurn("sess-1", { speaker: "candidate", text: "Answer" });
      expect(engine.appendTurn).toHaveBeenCalledWith("sess-1", "candidate", "Answer", undefined);
      expect(result).toEqual({ id: "t-1" });
    });
  });

  describe("getNextQuestion", () => {
    it("should call engine getNextQuestion", async () => {
      engine.getNextQuestion.mockResolvedValue({ text: "Question?" });
      const result = await controller.getNextQuestion("sess-1");
      expect(engine.getNextQuestion).toHaveBeenCalledWith("sess-1");
      expect(result).toEqual({ text: "Question?" });
    });
  });

  describe("logEvent", () => {
    it("should record proctor session event", async () => {
      engine.recordEvent.mockResolvedValue(undefined);
      const result = await controller.logEvent("sess-1", { type: "tab_switch", payload: { c: 1 } });
      expect(engine.recordEvent).toHaveBeenCalledWith("sess-1", "tab_switch", { c: 1 });
      expect(result).toEqual({ status: "success" });
    });
  });

  describe("finalizeEvaluation", () => {
    it("should enqueue background evaluation job", async () => {
      queue.enqueue.mockResolvedValue(undefined);
      const result = await controller.finalizeEvaluation("iv-5", { sessionId: "sess-1" });
      expect(queue.enqueue).toHaveBeenCalledWith("finalize-evaluation", {
        interviewId: "iv-5",
        sessionId: "sess-1",
      });
      expect(result).toEqual({ status: "queued" });
    });
  });

  describe("getEvaluation", () => {
    it("should query interview evaluation fields", async () => {
      const evaluationData = { id: "iv-5", overall_score: 90 };
      mockPrisma.interview.findUnique.mockResolvedValue(evaluationData);

      const result = await controller.getEvaluation("iv-5");

      expect(mockPrisma.interview.findUnique).toHaveBeenCalledWith({
        where: { id: "iv-5" },
        select: {
          id: true,
          evaluation: true,
          overall_score: true,
          recommendation: true,
          integrity_score: true,
          evaluation_status: true,
          status: true,
        },
      });
      expect(result).toEqual(evaluationData);
    });
  });
});
