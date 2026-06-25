import { Test, TestingModule } from "@nestjs/testing";
import { InterviewEngineService } from "./interview-engine.service";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { IInterviewRepositoryToken } from "../../domain/interview/interview.repository.interface";
import { CandidateWorkflowService } from "../candidate/candidate-workflow.service";
import { IAIOrchestratorToken } from "../common/ai/ai-orchestrator.interface";
import { IQueueServiceToken } from "../common/queue/queue.service";
import { Interview } from "../../domain/interview/interview.entity";

describe("InterviewEngineService", () => {
  let service: InterviewEngineService;
  let prisma: any;
  let interviewRepo: any;
  let candidateWorkflow: any;
  let aiOrchestrator: any;
  let queue: any;

  const mockPrismaService = {
    interviewSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    interviewTurn: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    interviewEvent: {
      create: jest.fn(),
    },
    interview: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    personaVersion: {
      findUnique: jest.fn(),
    },
    persona: {
      findUnique: jest.fn(),
    },
    jobDescription: {
      findUnique: jest.fn(),
    },
    candidate: {
      findUnique: jest.fn(),
    },
    interviewQuestion: {
      findMany: jest.fn(),
    },
  };

  const mockInterviewRepo = {
    findById: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockCandidateWorkflow = {
    transition: jest.fn(),
    logTimeline: jest.fn(),
  };

  const mockAIOrchestrator = {
    generateInterviewQuestion: jest.fn(),
  };

  const mockQueueService = {
    enqueue: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterviewEngineService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: IInterviewRepositoryToken,
          useValue: mockInterviewRepo,
        },
        {
          provide: CandidateWorkflowService,
          useValue: mockCandidateWorkflow,
        },
        {
          provide: IAIOrchestratorToken,
          useValue: mockAIOrchestrator,
        },
        {
          provide: IQueueServiceToken,
          useValue: mockQueueService,
        },
      ],
    }).compile();

    service = module.get<InterviewEngineService>(InterviewEngineService);
    prisma = module.get<PrismaService>(PrismaService);
    interviewRepo = module.get(IInterviewRepositoryToken);
    candidateWorkflow = module.get<CandidateWorkflowService>(CandidateWorkflowService);
    aiOrchestrator = module.get(IAIOrchestratorToken);
    queue = module.get(IQueueServiceToken);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("startSession", () => {
    it("should start an interview session, transition interview/candidate states", async () => {
      const interview = new Interview("int-123", "org-123", "cand-456", "scheduled");
      interviewRepo.findById.mockResolvedValue(interview);
      interviewRepo.save.mockResolvedValue(undefined);

      const mockSession = {
        id: "sess-999",
        interview_id: "int-123",
        started_at: new Date(),
      };
      prisma.interviewSession.create.mockResolvedValue(mockSession);
      candidateWorkflow.transition.mockResolvedValue(undefined);

      const result = await service.startSession("int-123", { browser: "chrome" });

      expect(interviewRepo.findById).toHaveBeenCalledWith("int-123");
      expect(interview.status).toBe("in_progress");
      expect(interviewRepo.save).toHaveBeenCalledWith(interview);
      
      expect(prisma.interviewSession.create).toHaveBeenCalledWith({
        data: {
          interview_id: "int-123",
          org_id: "org-123",
          device_info: { browser: "chrome" },
        },
      });

      expect(candidateWorkflow.transition).toHaveBeenCalledWith(
        "cand-456",
        "interview_started",
        expect.any(String),
        { sessionId: "sess-999" }
      );

      expect(result).toEqual({
        id: "sess-999",
        interviewId: "int-123",
        startedAt: mockSession.started_at,
      });
    });

    it("should throw error if interview not found", async () => {
      interviewRepo.findById.mockResolvedValue(null);

      await expect(service.startSession("int-123")).rejects.toThrow("Interview not found: int-123");
    });
  });

  describe("appendTurn", () => {
    it("should append a dialog turn and log to timeline", async () => {
      const mockSession = { id: "sess-999", interview_id: "int-123" };
      prisma.interviewSession.findUnique.mockResolvedValue(mockSession);

      const mockTurn = { id: "turn-1", session_id: "sess-999", speaker: "candidate", text: "My answer" };
      prisma.interviewTurn.create.mockResolvedValue(mockTurn);

      const mockInterview = { id: "int-123", candidate_id: "cand-456" };
      prisma.interview.findUnique.mockResolvedValue(mockInterview);

      const result = await service.appendTurn("sess-999", "candidate", "My answer", "s3://audio.mp3");

      expect(prisma.interviewSession.findUnique).toHaveBeenCalledWith({ where: { id: "sess-999" } });
      expect(prisma.interviewTurn.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          session_id: "sess-999",
          speaker: "candidate",
          text: "My answer",
          audio_path: "s3://audio.mp3",
        }),
      });

      expect(prisma.interview.findUnique).toHaveBeenCalledWith({ where: { id: "int-123" } });
      expect(candidateWorkflow.logTimeline).toHaveBeenCalledWith(
        "cand-456",
        "turn_candidate",
        "CANDIDATE Turn",
        "My answer"
      );

      expect(result).toEqual(mockTurn);
    });
  });

  describe("recordEvent", () => {
    it("should record proctor event and log integrity flags if suspicious", async () => {
      const mockSession = {
        id: "sess-999",
        interview_id: "int-123",
        interview: { id: "int-123", candidate_id: "cand-456" },
      };
      prisma.interviewSession.findUnique.mockResolvedValue(mockSession);
      prisma.interviewEvent.create.mockResolvedValue({});

      await service.recordEvent("sess-999", "tab_switch", { count: 1 });

      expect(prisma.interviewEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          session_id: "sess-999",
          type: "tab_switch",
          payload: { count: 1 },
        }),
      });

      expect(candidateWorkflow.logTimeline).toHaveBeenCalledWith(
        "cand-456",
        "integrity_violation",
        "Integrity Signal: tab_switch",
        expect.any(String),
        { count: 1 }
      );
    });
  });

  describe("getNextQuestion", () => {
    it("should generate and append the next question", async () => {
      const mockSession = {
        id: "sess-999",
        interview_id: "int-123",
        interview: {
          id: "int-123",
          candidate_id: "cand-456",
          job_id: "job-1",
          persona_id: "p-1",
        },
      };
      prisma.interviewSession.findUnique.mockResolvedValue(mockSession);

      prisma.persona.findUnique.mockResolvedValue({ id: "p-1", name: "Sophia", prompt: "Interviewer system prompt" });
      prisma.jobDescription.findResolvedValue = jest.fn();
      prisma.jobDescription.findUnique.mockResolvedValue({ id: "job-1", title: "Node Dev", requirements: "Node.js" });
      prisma.candidate.findUnique.mockResolvedValue({ id: "cand-456", full_name: "John", resume_summary: "Dev", skills: ["JS"] });
      
      prisma.interviewTurn.findMany.mockResolvedValue([
        { id: "t1", speaker: "candidate", text: "Hello", started_at: new Date() }
      ]);
      prisma.interviewQuestion.findMany.mockResolvedValue([
        { id: "q1", question: { prompt: "Curated Question 1" } }
      ]);

      aiOrchestrator.generateInterviewQuestion.mockResolvedValue("Generated Question text?");
      
      // Spy appendTurn
      const appendTurnSpy = jest.spyOn(service, "appendTurn").mockResolvedValue({ id: "turn-gen", speaker: "persona", text: "Generated Question text?" });

      const result = await service.getNextQuestion("sess-999");

      expect(aiOrchestrator.generateInterviewQuestion).toHaveBeenCalledWith(
        "Interviewer system prompt",
        [{ speaker: "candidate", text: "Hello" }],
        "Job Title: Node Dev\nRequirements: Node.js",
        "Candidate Name: John\nResume Summary: Dev\nSkills: JS",
        "Curated Question 1"
      );

      expect(appendTurnSpy).toHaveBeenCalledWith("sess-999", "persona", "Generated Question text?");
      expect(result).toEqual({
        id: "turn-gen",
        speaker: "persona",
        text: "Generated Question text?",
      });
    });
  });

  describe("endSession", () => {
    it("should close the session, transition states and enqueue background evaluation", async () => {
      const mockSession = {
        id: "sess-999",
        interview_id: "int-123",
        interview: { id: "int-123", candidate_id: "cand-456" },
      };
      prisma.interviewSession.findUnique.mockResolvedValue(mockSession);
      prisma.interviewSession.update.mockResolvedValue({});
      prisma.interview.update.mockResolvedValue({});

      const interview = new Interview("int-123", "org-123", "cand-456", "in_progress");
      interviewRepo.findById.mockResolvedValue(interview);
      interviewRepo.save.mockResolvedValue(undefined);

      await service.endSession("sess-999");

      expect(prisma.interviewSession.update).toHaveBeenCalledWith({
        where: { id: "sess-999" },
        data: expect.objectContaining({ ended_at: expect.any(Date) }),
      });

      expect(interview.status).toBe("evaluation_pending");
      expect(interviewRepo.save).toHaveBeenCalledWith(interview);

      expect(prisma.interview.update).toHaveBeenCalledWith({
        where: { id: "int-123" },
        data: { evaluation_status: "queued" },
      });

      expect(candidateWorkflow.transition).toHaveBeenCalledWith(
        "cand-456",
        "evaluation_processing",
        expect.any(String),
        { sessionId: "sess-999" }
      );

      expect(queue.enqueue).toHaveBeenCalledWith("finalize-evaluation", {
        interviewId: "int-123",
        sessionId: "sess-999",
      });
    });
  });
});
