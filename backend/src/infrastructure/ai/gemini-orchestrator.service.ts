import { Injectable, Logger } from "@nestjs/common";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  IAIOrchestrator,
  ParsedResume,
  SuggestedJd,
  JdMatchResult,
  EvaluationResult,
} from "../../application/common/ai/ai-orchestrator.interface";
import { PromptLibraryService } from "../../application/services/prompt-library.service";
import { AppConfigService } from "../../application/services/config.service";

@Injectable()
export class GeminiOrchestratorService implements IAIOrchestrator {
  private readonly logger = new Logger(GeminiOrchestratorService.name);
  private genAI: GoogleGenerativeAI | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly promptLibrary: PromptLibraryService,
  ) {
    const apiKey = this.config.getGeminiApiKey();
    if (apiKey && apiKey !== "your-gemini-api-key-here" && apiKey.length > 10) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.logger.log("Gemini Generative AI client initialized successfully.");
    } else {
      this.logger.warn(
        "GEMINI_API_KEY is missing or template key. AI Orchestrator running in Mock Fallback Mode.",
      );
    }
  }

  private hasClient(): boolean {
    return this.genAI !== null;
  }

  async parseResume(resumeText: string): Promise<ParsedResume> {
    const systemPrompt = await this.promptLibrary.getPrompt("RESUME_PARSE_AGENT");
    if (!this.hasClient()) {
      this.logger.log("[AI Mock] Parsing resume text mock fallback");
      // Simple heuristic parser for testing
      const skills = ["React", "TypeScript", "Node.js", "PostgreSQL", "Git"];
      const experienceYears = resumeText.match(/\b([0-9]+)\s*(?:years|yrs)\b/i)
        ? parseInt(resumeText.match(/\b([0-9]+)\s*(?:years|yrs)\b/i)![1], 10)
        : 5;

      const emailMatch = resumeText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
      const phoneMatch = resumeText.match(
        /\b(?:\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b/,
      );

      return {
        name: "John Doe (Extracted)",
        email: emailMatch ? emailMatch[0] : "candidate.john@example.com",
        phone: phoneMatch ? phoneMatch[0] : "+1-555-0199",
        experienceYears,
        skills,
        resumeSummary:
          "Experienced software developer with a strong background in web engineering and client-side applications.",
      };
    }

    try {
      const model = this.genAI!.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" },
      });
      const response = await model.generateContent([
        { text: systemPrompt },
        { text: `Resume text:\n${resumeText}` },
      ]);
      const content = response.response.text();
      const parsed = JSON.parse(content);
      return {
        name: String(parsed.name ?? "Unknown Name"),
        email: String(parsed.email ?? "unknown@example.com"),
        phone: parsed.phone ? String(parsed.phone) : null,
        experienceYears: Number(parsed.experienceYears ?? 0),
        skills: Array.isArray(parsed.skills) ? parsed.skills.map(String) : [],
        resumeSummary: String(parsed.resumeSummary ?? ""),
      };
    } catch (err) {
      this.logger.error(`Error parsing resume with Gemini: ${err}`);
      throw err;
    }
  }

  async suggestJd(title: string, department?: string): Promise<SuggestedJd> {
    if (!this.hasClient()) {
      this.logger.log("[AI Mock] Suggesting job description details");
      return {
        description: `We are looking for a skilled ${title} to join our growing team. You will lead development cycles and collaborate with stakeholders.`,
        requirements: `- 3+ years experience in technical development\n- Deep understanding of modern framework stacks\n- Strong verbal and written communication skills`,
      };
    }

    try {
      const model = this.genAI!.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" },
      });
      const prompt = `Generate a realistic job description and requirements for a "${title}" position${department ? ` in the ${department} department` : ""}.
Return STRICT JSON format with exactly two keys: "description" and "requirements".
"description" should be a high-quality job summary paragraph.
"requirements" should be a bulleted string listing core qualifications.`;
      const response = await model.generateContent(prompt);
      const parsed = JSON.parse(response.response.text());
      return {
        description: String(parsed.description ?? ""),
        requirements: String(parsed.requirements ?? ""),
      };
    } catch (err) {
      this.logger.error(`Error suggesting JD details with Gemini: ${err}`);
      throw err;
    }
  }

  async matchJdCandidate(jdRequirements: string, candidateProfile: any): Promise<JdMatchResult> {
    const systemPrompt = await this.promptLibrary.getPrompt("JD_MATCHING_AGENT");
    if (!this.hasClient()) {
      this.logger.log("[AI Mock] Matching JD candidate mock");
      // basic score check
      let matches = 0;
      const skills = candidateProfile.skills ?? [];
      skills.forEach((s: string) => {
        if (jdRequirements.toLowerCase().includes(s.toLowerCase())) matches++;
      });
      const score = skills.length > 0 ? Math.min(60 + (matches / skills.length) * 40, 100) : 75;
      return {
        matchScore: Math.round(score),
        analysis: `Candidate has skills (${skills.join(", ")}). Match evaluation indicates suitable technical alignment with core JD requirements.`,
      };
    }

    try {
      const model = this.genAI!.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" },
      });
      const userPrompt = `JD Requirements:\n${jdRequirements}\n\nCandidate Profile:\n${JSON.stringify(candidateProfile)}`;
      const response = await model.generateContent([{ text: systemPrompt }, { text: userPrompt }]);
      const parsed = JSON.parse(response.response.text());
      return {
        matchScore: Number(parsed.matchScore ?? 50),
        analysis: String(parsed.analysis ?? ""),
      };
    } catch (err) {
      this.logger.error(`Error matching candidate JD: ${err}`);
      throw err;
    }
  }

  async generateInterviewQuestion(
    personaPrompt: string,
    history: Array<{ speaker: string; text: string }>,
    jdContext?: string,
    candidateContext?: string,
    nextCuratedQuestion?: string,
  ): Promise<string> {
    if (!this.hasClient()) {
      this.logger.log("[AI Mock] Generating next interview question mock");
      if (history.length === 0) {
        return "Hello! Thank you for joining today. To start off, could you briefly tell me about your background and experience?";
      }
      if (nextCuratedQuestion) {
        return nextCuratedQuestion;
      }
      return "That sounds very interesting. Could you elaborate on how you handled scalability and error logging in that project?";
    }

    try {
      const systemParts = [personaPrompt, `You are asking questions to the candidate.`];
      if (jdContext) systemParts.push(`Job description Context:\n${jdContext}`);
      if (candidateContext) systemParts.push(`Candidate Profile Context:\n${candidateContext}`);

      if (nextCuratedQuestion) {
        systemParts.push(
          `NEXT DIRECTIVE/QUESTION (incorporate or rephrase naturally in your interviewer voice): "${nextCuratedQuestion}"`,
        );
      } else {
        systemParts.push(
          "Curated questions lists are empty or complete. Switch to adaptive follow-up mode probing on previous responses.",
        );
      }
      systemParts.push(
        "Return ONLY the interviewer text. No markdown structure, no quotes, no JSON.",
      );

      const model = this.genAI!.getGenerativeModel({
        model: "gemini-2.5-flash",
      });
      const contents = [{ role: "user", parts: [{ text: systemParts.join("\n\n") }] }];
      history.forEach((h) => {
        contents.push({
          role: h.speaker === "candidate" ? "user" : "model",
          parts: [{ text: h.text }],
        });
      });

      const response = await model.generateContent({ contents } as any);
      return response.response.text().trim();
    } catch (err) {
      this.logger.error(`Error generating interview question: ${err}`);
      return "Could you please explain that concept in a bit more depth?";
    }
  }

  async evaluateInterview(
    rubric: any,
    turns: Array<{ speaker: string; text: string }>,
    integrityFlags: Record<string, number>,
  ): Promise<EvaluationResult> {
    const systemPrompt = await this.promptLibrary.getPrompt("EVALUATION_AGENT");
    if (!this.hasClient()) {
      this.logger.log("[AI Mock] Evaluating interview turns mock");
      const tabSwitches = integrityFlags["tab_switch"] ?? 0;
      const integrityScore = Math.max(100 - tabSwitches * 10, 50);
      return {
        overallScore: 82,
        recommendation: "hire",
        strengths: [
          "Demonstrated solid modular programming practices",
          "Clear communication style",
        ],
        concerns: ["Slight hesitation when discussing asynchronous event handling loops"],
        summary:
          "The candidate exhibited good core capability suitable for web applications. Integrity was clear with minor tabs switches.",
        competencyScores: {
          "Technical Skills": 85,
          Communication: 80,
          "Problem Solving": 82,
        },
        integrityScore,
      };
    }

    try {
      const model = this.genAI!.getGenerativeModel({
        model: "gemini-2.5-pro", // Using Gemini 2.5 Pro for detailed grade analysis
        generationConfig: { responseMimeType: "application/json" },
      });
      const transcript = turns.map((t) => `${t.speaker.toUpperCase()}: ${t.text}`).join("\n");
      const userPrompt = `Rubric:\n${JSON.stringify(rubric)}\n\nIntegrity Violations Summary:\n${JSON.stringify(integrityFlags)}\n\nTranscript:\n${transcript}`;

      const response = await model.generateContent([{ text: systemPrompt }, { text: userPrompt }]);
      const parsed = JSON.parse(response.response.text());
      return {
        overallScore: Number(parsed.overallScore ?? 50),
        recommendation: parsed.recommendation ?? "hire",
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
        concerns: Array.isArray(parsed.concerns) ? parsed.concerns.map(String) : [],
        summary: String(parsed.summary ?? ""),
        competencyScores: parsed.competencyScores ?? {},
        integrityScore: Number(parsed.integrityScore ?? 100),
      };
    } catch (err) {
      this.logger.error(`Error evaluating interview: ${err}`);
      throw err;
    }
  }

  async generateReportMarkdown(
    candidateInfo: any,
    jdContext: any,
    evaluation: EvaluationResult,
  ): Promise<string> {
    const systemPrompt = await this.promptLibrary.getPrompt("REPORT_AGENT");
    if (!this.hasClient()) {
      this.logger.log("[AI Mock] Generating report markdown details");
      return `# Candidate Assessment Report: ${candidateInfo.name}
## Recommendation: ${evaluation.recommendation.toUpperCase()} (Score: ${evaluation.overallScore}/100)

### Executive Summary
${evaluation.summary}

### Key Strengths
${evaluation.strengths.map((s) => `- ${s}`).join("\n")}

### Concerns
${evaluation.concerns.map((c) => `- ${c}`).join("\n")}

### Competency Evaluation Scores
- Technical: ${evaluation.competencyScores["Technical Skills"] ?? 80}
- Communication: ${evaluation.competencyScores["Communication"] ?? 80}
- Integrity Assessment: ${evaluation.integrityScore}/100
`;
    }

    try {
      const model = this.genAI!.getGenerativeModel({
        model: "gemini-2.5-flash",
      });
      const userPrompt = `Candidate Details:\n${JSON.stringify(candidateInfo)}\n\nJD Info:\n${JSON.stringify(jdContext)}\n\nEvaluation Details:\n${JSON.stringify(evaluation)}`;
      const response = await model.generateContent([{ text: systemPrompt }, { text: userPrompt }]);
      return response.response.text();
    } catch (err) {
      this.logger.error(`Error generating report markdown: ${err}`);
      throw err;
    }
  }
}
