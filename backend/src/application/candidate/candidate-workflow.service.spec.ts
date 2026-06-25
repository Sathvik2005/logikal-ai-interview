import { Test, TestingModule } from "@nestjs/testing";
import { CandidateWorkflowService } from "./candidate-workflow.service";
import { ICandidateRepositoryToken } from "../../domain/candidate/candidate.repository.interface";
import { IEventBusToken } from "../common/event-bus/event-bus.interface";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { Candidate } from "../../domain/candidate/candidate.entity";
import { CandidateAppliedEvent } from "../../domain/candidate/events/candidate-events";
import { IQueueServiceToken } from "../common/queue/queue.service";

describe("CandidateWorkflowService", () => {
  let service: CandidateWorkflowService;
  let candidateRepo: any;
  let eventBus: any;
  let prisma: any;

  const mockCandidateRepo = {
    create: jest.fn(),
    findById: jest.fn(),
    save: jest.fn(),
  };

  const mockEventBus = {
    publish: jest.fn(),
  };

  const mockPrismaService = {
    candidateTimeline: {
      create: jest.fn(),
    },
    auditEvent: {
      create: jest.fn(),
    },
    candidate: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CandidateWorkflowService,
        {
          provide: ICandidateRepositoryToken,
          useValue: mockCandidateRepo,
        },
        {
          provide: IEventBusToken,
          useValue: mockEventBus,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: IQueueServiceToken,
          useValue: { enqueue: jest.fn(), registerProcessor: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<CandidateWorkflowService>(CandidateWorkflowService);
    candidateRepo = module.get(ICandidateRepositoryToken);
    eventBus = module.get(IEventBusToken);
    prisma = module.get(PrismaService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("apply", () => {
    it("should successfully register a candidate and emit applied event", async () => {
      candidateRepo.create.mockResolvedValue(undefined);
      prisma.candidateTimeline.create.mockResolvedValue({});

      const name = "John Doe";
      const email = "john@example.com";
      const orgId = "org-123";
      const phone = "+12345678";

      const candidateId = await service.apply(orgId, name, email, phone);

      expect(candidateId).toBeDefined();
      expect(typeof candidateId).toBe("string");

      expect(candidateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: candidateId,
          name,
          email,
          orgId,
          phone,
          status: "applied",
        })
      );

      expect(prisma.candidateTimeline.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          candidate_id: candidateId,
          event_type: "applied",
          title: "Application Submitted",
        }),
      });

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(CandidateAppliedEvent)
      );
      const dispatchedEvent = eventBus.publish.mock.calls[0][0];
      expect(dispatchedEvent.candidateId).toBe(candidateId);
      expect(dispatchedEvent.name).toBe(name);
      expect(dispatchedEvent.email).toBe(email);
    });
  });

  describe("transition", () => {
    it("should transition candidate status and log to timeline", async () => {
      const candidate = new Candidate("cand-123", "org-123", "John Doe", "john@example.com", "applied");
      candidateRepo.findById.mockResolvedValue(candidate);
      candidateRepo.save.mockResolvedValue(undefined);
      prisma.candidateTimeline.create.mockResolvedValue({});

      await service.transition("cand-123", "resume_imported", "Resume upload details");

      expect(candidateRepo.findById).toHaveBeenCalledWith("cand-123");
      expect(candidate.status).toBe("resume_imported");
      expect(candidateRepo.save).toHaveBeenCalledWith(candidate);
      
      expect(prisma.candidateTimeline.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          candidate_id: "cand-123",
          event_type: "resume_imported",
          title: "Resume Document Uploaded",
          description: "Resume upload details",
        }),
      });
    });

    it("should throw error if candidate not found", async () => {
      candidateRepo.findById.mockResolvedValue(null);

      await expect(
        service.transition("cand-123", "resume_imported")
      ).rejects.toThrow("Candidate with ID cand-123 not found.");
    });
  });

  describe("logTimeline", () => {
    it("should log event to database timeline", async () => {
      prisma.candidateTimeline.create.mockResolvedValue({});

      await service.logTimeline("cand-123", "custom_event", "Title", "Description", { key: "val" });

      expect(prisma.candidateTimeline.create).toHaveBeenCalledWith({
        data: {
          candidate_id: "cand-123",
          event_type: "custom_event",
          title: "Title",
          description: "Description",
          meta: { key: "val" },
        },
      });
    });
  });
});
