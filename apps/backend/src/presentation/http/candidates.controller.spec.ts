import { Test, TestingModule } from "@nestjs/testing";
import { CandidatesController } from "./candidates.controller";
import { CandidateWorkflowService } from "../../application/candidate/candidate-workflow.service";
import { FileProcessingPipelineService } from "../../application/candidate/file-processing-pipeline.service";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { SupabaseAuthGuard } from "../guards/supabase-auth.guard";
import { RolesGuard } from "../guards/roles.guard";
import { StorageService } from "../../application/services/storage.service";

describe("CandidatesController", () => {
  let controller: CandidatesController;
  let workflow: any;
  let filePipeline: any;
  let prisma: any;

  const mockWorkflow = {
    apply: jest.fn(),
    transition: jest.fn(),
  };

  const mockFilePipeline = {
    processResume: jest.fn(),
  };

  const mockStorage = {
    getFileSignedUrl: jest.fn(),
  };

  const mockPrisma = {
    candidate: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    candidateTimeline: {
      findMany: jest.fn(),
    },
    interview: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    notificationOutbox: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CandidatesController],
      providers: [
        {
          provide: CandidateWorkflowService,
          useValue: mockWorkflow,
        },
        {
          provide: FileProcessingPipelineService,
          useValue: mockFilePipeline,
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: StorageService,
          useValue: mockStorage,
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CandidatesController>(CandidatesController);
    workflow = module.get<CandidateWorkflowService>(CandidateWorkflowService);
    filePipeline = module.get<FileProcessingPipelineService>(FileProcessingPipelineService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("list", () => {
    it("should fetch candidate list with parameters", async () => {
      const candidates = [{ id: "1", full_name: "A" }];
      mockPrisma.candidate.findMany.mockResolvedValue(candidates);

      const result = await controller.list("search-term", "applied");

      expect(mockPrisma.candidate.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          status: "applied",
          OR: expect.arrayContaining([
            { full_name: { contains: "search-term", mode: "insensitive" } },
          ]),
        }),
        orderBy: { created_at: "desc" },
      });
      expect(result).toEqual(candidates);
    });
  });

  describe("getOne", () => {
    it("should fetch candidate by id with relations", async () => {
      const candidate = { id: "c1", full_name: "B" };
      mockPrisma.candidate.findUnique.mockResolvedValue(candidate);

      const result = await controller.getOne("c1");

      expect(mockPrisma.candidate.findUnique).toHaveBeenCalledWith({
        where: { id: "c1" },
        include: {
          timeline: true,
          matches: {
            include: { job: true },
          },
        },
      });
      expect(result).toBe(candidate);
    });
  });

  describe("create", () => {
    it("should call apply workflow", async () => {
      workflow.apply.mockResolvedValue("new-id");
      const req = { user: { orgId: "org-123" } };
      const body = { name: "Alice", email: "alice@example.com", phone: "123" };

      const result = await controller.create(req, body);

      expect(workflow.apply).toHaveBeenCalledWith(
        "org-123",
        "Alice",
        "alice@example.com",
        "123",
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      );
      expect(result).toEqual({ id: "new-id", message: "Candidate profile registered successfully." });
    });
  });

  describe("updateStatus", () => {
    it("should transition candidate workflow status", async () => {
      workflow.transition.mockResolvedValue(undefined);

      const result = await controller.updateStatus("c1", { status: "shortlisted", reason: "Good resume" });

      expect(workflow.transition).toHaveBeenCalledWith("c1", "shortlisted", "Good resume");
      expect(result).toEqual({ message: "Candidate state transitioned successfully." });
    });
  });

  describe("uploadResume", () => {
    it("should process uploaded file in resume pipeline", async () => {
      filePipeline.processResume.mockResolvedValue(undefined);
      const req = { user: { orgId: "org-123" } };
      const file: any = { originalname: "resume.pdf", buffer: Buffer.from(""), mimetype: "application/pdf" };

      const result = await controller.uploadResume(req, "c1", file);

      expect(filePipeline.processResume).toHaveBeenCalledWith(
        "org-123",
        "c1",
        "resume.pdf",
        file.buffer,
        "application/pdf"
      );
      expect(result).toEqual({ message: "Resume file uploaded and parsed by pipeline." });
    });
  });

  describe("getTimeline", () => {
    it("should query candidate logs", async () => {
      mockPrisma.candidateTimeline.findMany.mockResolvedValue([]);

      const result = await controller.getTimeline("c1");

      expect(mockPrisma.candidateTimeline.findMany).toHaveBeenCalledWith({
        where: { candidate_id: "c1" },
        orderBy: { created_at: "asc" },
      });
      expect(result).toEqual([]);
    });
  });

  describe("getResumeUrl", () => {
    it("should return signed URL if recruiter/admin checks it", async () => {
      const candidate = { id: "c1", resume_url: "http://localhost:3000/resumes/c1-resume.pdf", user_id: "user-123" };
      mockPrisma.candidate.findUnique.mockResolvedValue(candidate);
      mockStorage.getFileSignedUrl.mockResolvedValue("http://localhost:3000/signed/c1-resume.pdf");

      const req = { user: { role: "recruiter", userId: "user-456" } };
      const result = await controller.getResumeUrl(req, "c1");

      expect(mockPrisma.candidate.findUnique).toHaveBeenCalledWith({ where: { id: "c1" } });
      expect(mockStorage.getFileSignedUrl).toHaveBeenCalledWith("resumes", "c1-resume.pdf");
      expect(result).toEqual({ url: "http://localhost:3000/signed/c1-resume.pdf" });
    });
  });
});
