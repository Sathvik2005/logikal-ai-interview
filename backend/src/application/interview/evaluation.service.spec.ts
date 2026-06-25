import { Test, TestingModule } from "@nestjs/testing";
import { EvaluationService } from "./evaluation.service";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { IAIOrchestratorToken } from "../common/ai/ai-orchestrator.interface";
import { CandidateWorkflowService } from "../candidate/candidate-workflow.service";
import { IQueueServiceToken } from "../common/queue/queue.service";
import { IEventBusToken } from "../common/event-bus/event-bus.interface";
import { InMemoryQueueService } from "../../infrastructure/queue/in-memory-queue.service";
import { EvaluationCompletedEvent } from "../../domain/interview/events/interview-events";

describe("EvaluationService", () => {
  let service: EvaluationService;
  let prisma: any;
  let aiOrchestrator: any;
  let workflow: any;
  let queue: any;
  let eventBus: any;

  const mockPrismaService = {
    interview: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    interviewTurn: {
      findMany: jest.fn(),
    },
    interviewEvent: {
      findMany: jest.fn(),
    },
    interviewReport: {
      create: jest.fn(),
    },
  };

  const mockAIOrchestrator = {
    evaluateInterview: jest.fn(),
    generateReportMarkdown: jest.fn(),
  };

  const mockCandidateWorkflow = {
    transition: jest.fn(),
  };

  const mockQueueService = {
    enqueue: jest.fn(),
    registerProcessor: jest.fn(),
  };

  const mockEventBus = {
    publish: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: IAIOrchestratorToken,
          useValue: mockAIOrchestrator,
        },
        {
          provide: CandidateWorkflowService,
          useValue: mockCandidateWorkflow,
        },
        {
          provide: IQueueServiceToken,
          useValue: mockQueueService,
        },
        {
          provide: IEventBusToken,
          useValue: mockEventBus,
        },
      ],
    }).compile();

    service = module.get<EvaluationService>(EvaluationService);
    prisma = module.get<PrismaService>(PrismaService);
    aiOrchestrator = module.get(IAIOrchestratorToken);
    workflow = module.get<CandidateWorkflowService>(CandidateWorkflowService);
    queue = module.get(IQueueServiceToken);
    eventBus = module.get(IEventBusToken);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("onModuleInit", () => {
    it("should register background processor if queue is InMemoryQueueService", () => {
      // Create a dummy instance subclassing InMemoryQueueService
      const inMemoryQueue = Object.create(InMemoryQueueService.prototype);
      inMemoryQueue.registerProcessor = jest.fn();

      const serviceWithInMemory = new EvaluationService(
        prisma,
        aiOrchestrator,
        workflow,
        inMemoryQueue,
        eventBus
      );

      serviceWithInMemory.onModuleInit();
      expect(inMemoryQueue.registerProcessor).toHaveBeenCalledWith(
        "finalize-evaluation",
        expect.any(Function)
      );
    });
  });

  describe("finalizeEvaluation", () => {
    it("should grade interview transcript, update db, create report, transition candidate and enqueue emails", async () => {
      prisma.interview.update.mockResolvedValue({});
      
      const mockTurns = [
        { speaker: "persona", text: "Question?" },
        { speaker: "candidate", text: "Answer." }
      ];
      prisma.interviewTurn.findMany.mockResolvedValue(mockTurns);

      const mockEvents = [
        { type: "tab_switch" },
        { type: "tab_switch" }
      ];
      prisma.interviewEvent.findMany.mockResolvedValue(mockEvents);

      const mockInterview = {
        id: "int-123",
        org_id: "org-123",
        candidate_id: "cand-456",
        candidate: { full_name: "John Doe", email: "john@example.com" },
        job: { title: "Dev", requirements: "Node" },
        template: { evaluation_criteria: { competency: "standard" } }
      };
      prisma.interview.findUnique.mockResolvedValue(mockInterview);

      const mockEvaluationResult = {
        overallScore: 88,
        recommendation: "strong_hire",
        strengths: ["Clean Code"],
        concerns: ["None"],
        summary: "Excellent candidate",
        competencyScores: { "Node.js": 90 },
        integrityScore: 80
      };
      aiOrchestrator.evaluateInterview.mockResolvedValue(mockEvaluationResult);
      aiOrchestrator.generateReportMarkdown.mockResolvedValue("# Report markdown content");

      const mockReport = { id: "rep-999", org_id: "org-123" };
      prisma.interviewReport.create.mockResolvedValue(mockReport);

      workflow.transition.mockResolvedValue(undefined);
      eventBus.publish.mockImplementation(() => {});
      queue.enqueue.mockResolvedValue(undefined);

      await service.finalizeEvaluation("int-123", "sess-999");

      // 1. Sets status to running
      expect(prisma.interview.update).toHaveBeenNthCalledWith(1, {
        where: { id: "int-123" },
        data: { evaluation_status: "running" },
      });

      // 2. Evaluates interview
      expect(aiOrchestrator.evaluateInterview).toHaveBeenCalledWith(
        { competency: "standard" },
        [{ speaker: "persona", text: "Question?" }, { speaker: "candidate", text: "Answer." }],
        { tab_switch: 2 }
      );

      // 3. Updates interview with results
      expect(prisma.interview.update).toHaveBeenNthCalledWith(2, {
        where: { id: "int-123" },
        data: {
          status: "completed",
          evaluation_status: "done",
          overall_score: 88,
          integrity_score: 80,
          recommendation: "strong_hire",
          evaluation: mockEvaluationResult,
        },
      });

      // 4. Generates markdown report
      expect(aiOrchestrator.generateReportMarkdown).toHaveBeenCalledWith(
        { name: "John Doe", email: "john@example.com" },
        { title: "Dev", requirements: "Node" },
        mockEvaluationResult
      );

      // 5. Stores report in DB
      expect(prisma.interviewReport.create).toHaveBeenCalledWith({
        data: {
          org_id: "org-123",
          interview_id: "int-123",
          executive_summary: "# Report markdown content",
          scores: mockEvaluationResult.competencyScores,
          strengths: mockEvaluationResult.strengths,
          weaknesses: mockEvaluationResult.concerns,
          integrity_score: 80,
          recommendation: "strong_hire",
        },
      });

      // 6. Transitions candidate to recruiter_review
      expect(workflow.transition).toHaveBeenCalledWith(
        "cand-456",
        "recruiter_review",
        expect.any(String),
        { score: 88, recommendation: "strong_hire" }
      );

      // 7. Dispatches Event
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(EvaluationCompletedEvent)
      );

      // 8. Enqueues email delivery
      expect(queue.enqueue).toHaveBeenCalledWith("send-notification", {
        orgId: "org-123",
        kind: "interview_report_ready",
        recipientEmail: "john@example.com",
        payload: {
          candidateName: "John Doe",
          score: 88,
          interviewId: "int-123",
        },
      });
    });

    it("should set evaluation status to failed and rethrow on error", async () => {
      prisma.interview.update.mockResolvedValue({});
      prisma.interviewTurn.findMany.mockRejectedValue(new Error("Database error"));

      await expect(
        service.finalizeEvaluation("int-123", "sess-999")
      ).rejects.toThrow("Database error");

      expect(prisma.interview.update).toHaveBeenCalledWith({
        where: { id: "int-123" },
        data: { evaluation_status: "failed" },
      });
    });
  });
});
