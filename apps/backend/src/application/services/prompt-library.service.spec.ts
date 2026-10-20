import { Test, TestingModule } from "@nestjs/testing";
import { PromptLibraryService } from "./prompt-library.service";
import { PrismaService } from "../../infrastructure/database/prisma.service";

describe("PromptLibraryService", () => {
  let service: PromptLibraryService;
  let prisma: any;

  const mockPrismaService = {
    promptLibrary: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromptLibraryService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PromptLibraryService>(PromptLibraryService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("onModuleInit", () => {
    it("should seed prompts if they do not exist", async () => {
      prisma.promptLibrary.findUnique.mockResolvedValue(null);
      prisma.promptLibrary.create.mockResolvedValue({});

      await service.onModuleInit();

      expect(prisma.promptLibrary.findUnique).toHaveBeenCalledTimes(5);
      expect(prisma.promptLibrary.create).toHaveBeenCalledTimes(5);
    });

    it("should skip seeding if prompts already exist", async () => {
      prisma.promptLibrary.findUnique.mockResolvedValue({ name: "EXISTING_PROMPT" });
      prisma.promptLibrary.create.mockResolvedValue({});

      await service.onModuleInit();

      expect(prisma.promptLibrary.findUnique).toHaveBeenCalledTimes(5);
      expect(prisma.promptLibrary.create).not.toHaveBeenCalled();
    });
  });

  describe("getPrompt", () => {
    it("should return database prompt if found", async () => {
      prisma.promptLibrary.findUnique.mockResolvedValue({
        name: "INTERVIEW_AGENT",
        prompt_text: "Custom Interview Prompt",
      });

      const prompt = await service.getPrompt("INTERVIEW_AGENT");
      expect(prompt).toBe("Custom Interview Prompt");
      expect(prisma.promptLibrary.findUnique).toHaveBeenCalledWith({
        where: { name: "INTERVIEW_AGENT" },
      });
    });

    it("should fallback to default prompt if not found in database", async () => {
      prisma.promptLibrary.findUnique.mockResolvedValue(null);

      const prompt = await service.getPrompt("INTERVIEW_AGENT");
      expect(prompt).toContain("Aria");
      expect(prisma.promptLibrary.findUnique).toHaveBeenCalledWith({
        where: { name: "INTERVIEW_AGENT" },
      });
    });

    it("should throw error if prompt name is invalid and not found in defaults", async () => {
      prisma.promptLibrary.findUnique.mockResolvedValue(null);

      await expect(service.getPrompt("INVALID_AGENT")).rejects.toThrow(
        "Prompt template INVALID_AGENT not found in library."
      );
    });
  });

  describe("updatePrompt", () => {
    it("should update the prompt in the database", async () => {
      prisma.promptLibrary.update.mockResolvedValue({});

      await service.updatePrompt("INTERVIEW_AGENT", "New Prompt Text");

      expect(prisma.promptLibrary.update).toHaveBeenCalledWith({
        where: { name: "INTERVIEW_AGENT" },
        data: expect.objectContaining({
          prompt_text: "New Prompt Text",
        }),
      });
    });
  });
});
