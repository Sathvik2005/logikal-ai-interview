import { Test, TestingModule } from "@nestjs/testing";
import { GeminiOrchestratorService } from "./gemini-orchestrator.service";
import { AppConfigService } from "../../application/services/config.service";
import { PromptLibraryService } from "../../application/services/prompt-library.service";

describe("GeminiOrchestratorService (Mock Fallback Mode)", () => {
  let service: GeminiOrchestratorService;
  let config: any;
  let promptLibrary: any;

  const mockAppConfigService = {
    getGeminiApiKey: jest.fn().mockReturnValue(""), // Empty to trigger mock fallback
  };

  const mockPromptLibraryService = {
    getPrompt: jest.fn().mockImplementation((name) => `System prompt for ${name}`),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeminiOrchestratorService,
        {
          provide: AppConfigService,
          useValue: mockAppConfigService,
        },
        {
          provide: PromptLibraryService,
          useValue: mockPromptLibraryService,
        },
      ],
    }).compile();

    service = module.get<GeminiOrchestratorService>(GeminiOrchestratorService);
    config = module.get<AppConfigService>(AppConfigService);
    promptLibrary = module.get<PromptLibraryService>(PromptLibraryService);
  });

  it("should initialize in mock mode when key is empty", () => {
    expect(service).toBeDefined();
    expect((service as any).hasClient()).toBe(false);
  });

  describe("parseResume", () => {
    it("should parse text using the heuristic mock parser", async () => {
      const resumeText = "Experienced developer with 8 years of experience. Email: test@example.com, Phone: +1-555-0199";
      const result = await service.parseResume(resumeText);

      expect(promptLibrary.getPrompt).toHaveBeenCalledWith("RESUME_PARSE_AGENT");
      expect(result.experienceYears).toBe(8);
      expect(result.email).toBe("test@example.com");
      expect(result.phone).toBe("+1-555-0199");
      expect(result.skills).toEqual(["React", "TypeScript", "Node.js", "PostgreSQL", "Git"]);
    });
  });

  describe("suggestJd", () => {
    it("should return realistic mockup job description requirements", async () => {
      const result = await service.suggestJd("Backend Dev", "Engineering");
      expect(result.description).toContain("Backend Dev");
      expect(result.requirements).toContain("3+ years experience");
    });
  });

  describe("matchJdCandidate", () => {
    it("should calculate matching score based on overlaps in skills list", async () => {
      const candidateProfile = { skills: ["React", "PostgreSQL", "Vue"] };
      const jdRequirements = "Required: React, PostgreSQL, Node.js";

      const result = await service.matchJdCandidate(jdRequirements, candidateProfile);

      expect(promptLibrary.getPrompt).toHaveBeenCalledWith("JD_MATCHING_AGENT");
      expect(result.matchScore).toBeGreaterThanOrEqual(60);
      expect(result.analysis).toContain("React, PostgreSQL");
    });
  });

  describe("generateInterviewQuestion", () => {
    it("should generate mock questions based on history", async () => {
      const resultEmpty = await service.generateInterviewQuestion("Sophia system prompt", []);
      expect(resultEmpty).toContain("tell me about your background");

      const resultWithCurated = await service.generateInterviewQuestion(
        "Sophia prompt",
        [{ speaker: "candidate", text: "Hello" }],
        "Node.js Dev",
        "John",
        "What is event loop?"
      );
      expect(resultWithCurated).toBe("What is event loop?");

      const resultAdaptive = await service.generateInterviewQuestion(
        "Sophia prompt",
        [{ speaker: "candidate", text: "Hello" }],
        "Node.js Dev",
        "John"
      );
      expect(resultAdaptive).toContain("scalability and error logging");
    });
  });

  describe("evaluateInterview", () => {
    it("should return mock evaluation grades matching expected schema", async () => {
      const result = await service.evaluateInterview({}, [], { tab_switch: 3 });

      expect(promptLibrary.getPrompt).toHaveBeenCalledWith("EVALUATION_AGENT");
      expect(result.overallScore).toBe(82);
      expect(result.integrityScore).toBe(70); // 100 - 3*10
      expect(result.recommendation).toBe("hire");
      expect(result.competencyScores).toBeDefined();
    });
  });

  describe("generateReportMarkdown", () => {
    it("should output clean markdown evaluation report based on mock data", async () => {
      const evaluationResult = {
        overallScore: 85,
        recommendation: "strong_hire",
        strengths: ["Fast learner"],
        concerns: ["None"],
        summary: "John is great",
        competencyScores: { Technical: 85 },
        integrityScore: 100
      };

      const result = await service.generateReportMarkdown(
        { name: "John Doe", email: "john@example.com" },
        { title: "Node Dev" },
        evaluationResult as any
      );

      expect(promptLibrary.getPrompt).toHaveBeenCalledWith("REPORT_AGENT");
      expect(result).toContain("Candidate Assessment Report");
      expect(result).toContain("John Doe");
      expect(result).toContain("STRONG_HIRE");
    });
  });
});
