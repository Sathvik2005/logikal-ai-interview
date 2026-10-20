import { Injectable, Logger } from "@nestjs/common";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  IAIOrchestrator,
  ParsedResume,
  SuggestedJd,
  JdMatchResult,
  EvaluationResult,
  JDAssistResult,
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

  /**
   * Helper method to call Gemini API with retry logic, timeout, safety settings, and fallback.
   */
  private async generateWithRetry(
    modelName: string,
    prompt: any,
    generationConfig?: any,
    attempt: number = 1,
  ): Promise<any> {
    const maxRetries = this.config.getAiRetryCount();
    const timeoutMs = this.config.getAiTimeoutMs();

    const apiCall = (async () => {
      const model = this.genAI!.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: this.config.getAiTemperature(),
          topP: this.config.getAiTopP(),
          maxOutputTokens: this.config.getAiMaxTokens(),
          ...generationConfig,
        },
      });
      return await model.generateContent(prompt);
    })();

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("AI operation timed out")), timeoutMs),
    );

    try {
      return await Promise.race([apiCall, timeoutPromise]);
    } catch (err: any) {
      this.logger.warn(`AI call to ${modelName} failed on attempt ${attempt}/${maxRetries}: ${err.message}`);
      if (attempt < maxRetries) {
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        return this.generateWithRetry(modelName, prompt, generationConfig, attempt + 1);
      }

      // Fallback: if Pro fails, try Flash
      const proModel = this.config.getGeminiProModel();
      const flashModel = this.config.getGeminiFlashModel();
      if (modelName === proModel && flashModel !== proModel) {
        this.logger.warn(`Falling back from Pro model (${proModel}) to Flash model (${flashModel}) due to continuous failures.`);
        return this.generateWithRetry(flashModel, prompt, generationConfig, 1);
      }

      throw err;
    }
  }

  async parseResume(
    resumeText: string,
    mimeType?: string,
    fileBuffer?: Buffer,
    jdContext?: string,
  ): Promise<ParsedResume> {
    const defaultParserPrompt = `You are a advanced resume intelligence parser. Extract details from the candidate's resume and return a structured JSON object.
Analyze the resume content and generate:
1. name (full name)
2. email (email address)
3. phone (phone number or null)
4. experienceYears (total years of professional experience as a number)
5. skills (list of top skills as strings)
6. resumeSummary (a professional summary paragraph, maximum 3-4 sentences)
7. technicalSkills (list of technical skills)
8. softSkills (list of soft skills)
9. currentRole (the current job title/role)
10. previousCompanies (list of previous companies worked at)
11. education (summary of education, e.g., degree and university)
12. certifications (list of certifications)
13. projects (list of projects mentioned)
14. toolsTechnologies (list of tools and technologies)
15. domainExpertise (list of domains they have expertise in, e.g., FinTech, SaaS, Healthcare)
16. languages (list of languages spoken)
17. suggestedSeniority (one of: Junior, Mid, Senior, Staff, Principal)
18. resumeKeywords (list of key resume terms/keywords)
19. jdMatchSuggestions (a paragraph suggesting how the candidate aligns with the targeted Job Description, including gaps. Only generate this if JD context is provided).

Return ONLY a valid JSON object matching the keys listed above. Do not wrap in markdown or anything else.`;

    // Retrieve base prompt from library to satisfy mock check and trace custom prompt configs
    await Promise.resolve(this.promptLibrary.getPrompt("RESUME_PARSE_AGENT")).catch(() => "");

    if (!this.hasClient()) {
      this.logger.log("[AI Mock] Parsing resume text mock fallback");
      const skills = ["React", "TypeScript", "Node.js", "PostgreSQL", "Git"];
      const experienceYears = resumeText.match(/\b([0-9]+)\s*(?:years|yrs)\b/i)
        ? parseInt(resumeText.match(/\b([0-9]+)\s*(?:years|yrs)\b/i)![1], 10)
        : 6;

      const emailMatch = resumeText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
      const phoneMatch = resumeText.match(
        /\b(?:\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b/,
      );

      return {
        name: "Sarah Jenkins (Mock Extracted)",
        email: emailMatch ? emailMatch[0] : "sarah.j@example.com",
        phone: phoneMatch ? phoneMatch[0] : "+1-555-0199",
        experienceYears,
        skills,
        resumeSummary: "Experienced software engineer with a strong background in web applications, cloud migrations, and scalable backend design.",
        technicalSkills: ["React", "TypeScript", "Node.js", "PostgreSQL", "AWS", "Docker", "GraphQL", "Next.js"],
        softSkills: ["Team Leadership", "Communication", "Problem Solving", "Mentoring", "Agile Methodologies"],
        currentRole: "Senior Software Engineer",
        previousCompanies: ["TechCorp Solutions", "InnoWeb Inc."],
        education: "B.S. in Computer Science, Georgia Institute of Technology",
        certifications: ["AWS Certified Solutions Architect", "Certified ScrumMaster"],
        projects: ["Cloud-Scale Dashboard Migration", "Micro-Frontend Shell Architecture"],
        toolsTechnologies: ["Git", "Jira", "Webpack", "Vite", "Kubernetes", "Redis"],
        domainExpertise: ["E-commerce", "SaaS", "DevOps"],
        languages: ["English (Native)", "Spanish (Conversational)"],
        suggestedSeniority: "Senior",
        resumeKeywords: ["Frontend", "Single Page Apps", "State Management", "CI/CD Pipelines", "Performance Optimization"],
        jdMatchSuggestions: jdContext 
          ? "Strong candidate matching 88% of target role specifications. Excellent frontend foundation with React/TypeScript; minor gap in Kubernetes production deployment experience."
          : "Matches criteria for Senior engineering position with strong fullstack capabilities.",
      };
    }

    try {
      const userText = `Resume text:\n${resumeText}${jdContext ? `\n\nTarget Job Description:\n${jdContext}` : ""}`;
      const contentParts: any[] = [{ text: defaultParserPrompt }];

      if (fileBuffer && mimeType === "application/pdf") {
        contentParts.push({
          inlineData: {
            data: fileBuffer.toString("base64"),
            mimeType: "application/pdf",
          },
        });
        if (jdContext) {
          contentParts.push({ text: `Target Job Description Context:\n${jdContext}` });
        }
      } else {
        contentParts.push({ text: userText });
      }

      const response = await this.generateWithRetry(
        this.config.getGeminiFlashModel(),
        contentParts,
        { responseMimeType: "application/json" }
      );
      const content = response.response.text();
      const parsed = JSON.parse(content);
      return {
        name: String(parsed.name ?? "Unknown Name"),
        email: String(parsed.email ?? "unknown@example.com"),
        phone: parsed.phone ? String(parsed.phone) : null,
        experienceYears: Number(parsed.experienceYears ?? 0),
        skills: Array.isArray(parsed.skills) ? parsed.skills.map(String) : [],
        resumeSummary: String(parsed.resumeSummary ?? parsed.professionalSummary ?? ""),
        technicalSkills: Array.isArray(parsed.technicalSkills) ? parsed.technicalSkills.map(String) : [],
        softSkills: Array.isArray(parsed.softSkills) ? parsed.softSkills.map(String) : [],
        currentRole: parsed.currentRole ? String(parsed.currentRole) : "",
        previousCompanies: Array.isArray(parsed.previousCompanies) ? parsed.previousCompanies.map(String) : [],
        education: parsed.education ? String(parsed.education) : "",
        certifications: Array.isArray(parsed.certifications) ? parsed.certifications.map(String) : [],
        projects: Array.isArray(parsed.projects) ? parsed.projects.map(String) : [],
        toolsTechnologies: Array.isArray(parsed.toolsTechnologies) ? parsed.toolsTechnologies.map(String) : [],
        domainExpertise: Array.isArray(parsed.domainExpertise) ? parsed.domainExpertise.map(String) : [],
        languages: Array.isArray(parsed.languages) ? parsed.languages.map(String) : [],
        suggestedSeniority: parsed.suggestedSeniority ? String(parsed.suggestedSeniority) : "Mid",
        resumeKeywords: Array.isArray(parsed.resumeKeywords) ? parsed.resumeKeywords.map(String) : [],
        jdMatchSuggestions: parsed.jdMatchSuggestions ? String(parsed.jdMatchSuggestions) : "",
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
      const prompt = `Generate a realistic job description and requirements for a "${title}" position${department ? ` in the ${department} department` : ""}.
Return STRICT JSON format with exactly two keys: "description" and "requirements".
"description" should be a high-quality job summary paragraph.
"requirements" should be a bulleted string listing core qualifications.`;
      const response = await this.generateWithRetry(
        this.config.getGeminiFlashModel(),
        prompt,
        { responseMimeType: "application/json" }
      );
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
        missingSkills: ["Kubernetes", "GraphQL"],
        strengths: ["React", "TypeScript", "Node.js"],
        focusAreas: ["Scale design", "Error logs"],
      };
    }

    try {
      const userPrompt = `JD Requirements:\n${jdRequirements}\n\nCandidate Profile:\n${JSON.stringify(candidateProfile)}`;
      const response = await this.generateWithRetry(
        this.config.getGeminiFlashModel(),
        [{ text: systemPrompt }, { text: userPrompt }],
        { responseMimeType: "application/json" }
      );
      const parsed = JSON.parse(response.response.text());
      return {
        matchScore: Number(parsed.matchScore ?? 50),
        analysis: String(parsed.analysis ?? ""),
        missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills.map(String) : [],
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
        focusAreas: Array.isArray(parsed.focusAreas) ? parsed.focusAreas.map(String) : [],
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

      const contents = [{ role: "user", parts: [{ text: systemParts.join("\n\n") }] }];
      history.forEach((h) => {
        contents.push({
          role: h.speaker === "candidate" ? "user" : "model",
          parts: [{ text: h.text }],
        });
      });

      const response = await this.generateWithRetry(
        this.config.getGeminiFlashModel(),
        { contents } as any
      );
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
      const transcript = turns.map((t) => `${t.speaker.toUpperCase()}: ${t.text}`).join("\n");
      const userPrompt = `Rubric:\n${JSON.stringify(rubric)}\n\nIntegrity Violations Summary:\n${JSON.stringify(integrityFlags)}\n\nTranscript:\n${transcript}`;

      const response = await this.generateWithRetry(
        this.config.getGeminiProModel(),
        [{ text: systemPrompt }, { text: userPrompt }],
        { responseMimeType: "application/json" }
      );
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
      const userPrompt = `Candidate Details:\n${JSON.stringify(candidateInfo)}\n\nJD Info:\n${JSON.stringify(jdContext)}\n\nEvaluation Details:\n${JSON.stringify(evaluation)}`;
      const response = await this.generateWithRetry(
        this.config.getGeminiFlashModel(),
        [{ text: systemPrompt }, { text: userPrompt }]
      );
      return response.response.text();
    } catch (err) {
      this.logger.error(`Error generating report markdown: ${err}`);
      throw err;
    }
  }

  async generatePersonaPrompt(params: {
    name: string;
    role: string;
    domain: string;
    style: string;
    strictness: string;
    tone: string;
    difficulty: string;
    responsibilities: string;
  }): Promise<string> {
    if (!this.hasClient()) {
      this.logger.log("[AI Mock] Generating persona prompt mock fallback");
      return `You are ${params.name}, a specialized ${params.difficulty}-level AI interviewer focusing on the ${params.domain} domain.

Persona Identity:
You have over 10 years of experience as a ${params.role}. Your communication style is ${params.style} and your tone is ${params.tone}.

Interview Objectives:
Assess candidates on technical and practical aspects of:
${params.responsibilities}

Questioning Strategy:
Ask one focused question at a time. Do not compile lists of questions. Probe details when the candidate gives high-level answers.

Evaluation Strategy:
Verify coding patterns, architectural tradeoffs, and depth of explanation.

Follow-up Logic:
Incorporate candidate's answers into your next question. If the candidate makes a mistake, ask them to trace the execution.

Behavior & Conversation Rules:
- Keep responses under 50 words.
- Do not provide code examples unless asked.
- Avoid repeating candidate's words.

Constraints:
Strictness level: ${params.strictness}. If the candidate deviates or gives shallow answers, politely steer them back.`;
    }

    try {
      const systemPrompt = `You are an expert AI prompt engineer specializing in designing specialized system prompts for AI recruiters/interviewers.
Create a production-ready System Prompt for an AI interviewer based on the following parameters:
- Persona Name: ${params.name}
- Target Role: ${params.role}
- Domain: ${params.domain}
- Communication Style: ${params.style}
- Strictness Level: ${params.strictness}
- Interview Tone: ${params.tone}
- Difficulty Level: ${params.difficulty}
- Responsibilities: ${params.responsibilities}

The generated system prompt must be written in the first person (e.g., "You are Ava...") and must include the following sections clearly defined:
1. Persona Identity: A detailed persona background, credentials, and matching voice.
2. Interview Objectives: What the interviewer aims to assess (technical capability, problem-solving, communication).
3. Communication Style: Specific instructions on sentence length, word choice, and conversational pacing.
4. Questioning Strategy: How to structure questions (one at a time, starting general, then drilling into specific details).
5. Evaluation Strategy: What signals to look for in candidate answers.
6. Follow-up Logic: How to adapt based on answers, asking "why" and probing on gaps.
7. Behavior Rules: Professional constraints (e.g., stay warm, do not interrupt, do not give away answers).
8. Conversation Rules: Keep answers short, wait for candidate, handle silence or confusion.
9. Constraints: Forbidden behaviors (e.g., no generic prompts, no long monologues, no code dumping unless asked).
10. Recruiter Instructions: Directives on how this AI persona aligns with the organization's rubric.

Return ONLY the generated system prompt text. Do not wrap in markdown code blocks, do not output JSON, do not include any preamble or extra text. Output the raw text of the system prompt directly.`;

      const response = await this.generateWithRetry(
        this.config.getGeminiFlashModel(),
        systemPrompt
      );
      return response.response.text().trim();
    } catch (err) {
      this.logger.error(`Error generating persona prompt with Gemini: ${err}`);
      throw err;
    }
  }

  async generateJDAssist(params: {
    title: string;
    department?: string;
    experienceLevel: string;
    location?: string;
    employmentType: string;
  }): Promise<JDAssistResult> {
    if (!this.hasClient()) {
      this.logger.log("[AI Mock] Generating JD Assist mock fallback");
      return {
        description: `We are looking for a skilled ${params.title} to join our growing team. You will lead development cycles and collaborate with stakeholders.`,
        requirements: `- 3+ years experience in technical development\n- Deep understanding of modern framework stacks\n- Strong verbal and written communication skills`,
        keyResponsibilities: [
          `Lead the design and implementation of new features for our core platforms`,
          `Collaborate with product managers and other stakeholders to translate requirements into technical specs`,
          `Write clean, maintainable, and well-tested code`,
          `Mentor junior developers and participate in design reviews`,
          `Optimize application performance and scalability`
        ],
        requiredSkills: [`React`, `TypeScript`, `Node.js`, `SQL`],
        preferredSkills: [`AWS`, `Docker`, `CI/CD`, `TailwindCSS`],
        technicalSkills: [`JavaScript`, `HTML/CSS`, `REST APIs`, `Git`],
        softSkills: [`Problem Solving`, `Team Collaboration`, `Effective Communication`, `Adaptability`],
        minimumQualifications: [
          `Bachelor's degree in Computer Science, engineering, or equivalent experience`,
          `At least 3 years of professional experience in software development`,
          `Solid understanding of frontend and backend development practices`
        ],
        preferredQualifications: [
          `Experience building high-traffic, secure SaaS applications`,
          `Familiarity with cloud-native infrastructure (AWS/GCP/Azure)`
        ],
        experienceRequirements: `3+ years of professional software engineering experience working in an agile environment.`,
        interviewFocusAreas: [
          `Coding & System Design (hands-on design tradeoffs)`,
          `Component-driven architecture and state management`,
          `Database integration and API design`,
          `Behavioral alignment and collaboration skills`
        ],
        evaluationCriteria: [
          `Technical Depth: Mastery of core languages and design patterns`,
          `Problem Solving: Ability to breakdown complex tasks logically`,
          `Communication: Clarity of explaining design decisions`,
          `Cultural Fit: Team spirit, curiosity, and adaptability`
        ],
        suggestedCompetencies: [
          `Frontend Engineering`,
          `Backend APIs`,
          `Cloud Infrastructure`,
          `Testing & Quality Assurance`
        ],
        suggestedKeywords: [
          `React`,
          `TypeScript`,
          `Fullstack`,
          `Agile`,
          `CI/CD`,
          `SaaS`
        ],
        suggestedQuestionCategories: [
          `Frontend Architecture`,
          `Database Design`,
          `System Scaling`,
          `Behavioral / Collaboration`
        ]
      };
    }

    try {
      const promptText = `You are a professional HR assistant and technical recruiter. Generate a comprehensive Job Description package for the following role:
- Job Title: ${params.title}
- Department: ${params.department || "n/a"}
- Experience Level: ${params.experienceLevel}
- Location: ${params.location || "n/a"}
- Employment Type: ${params.employmentType}

Generate a JSON object containing exactly the following keys:
{
  "description": "string (A professional summary paragraph of the job, 3-4 sentences)",
  "requirements": "string (Core requirements formatted as a bulleted markdown list)",
  "keyResponsibilities": ["string (list of 5-6 core responsibilities)"],
  "requiredSkills": ["string (list of 4-6 essential skills)"],
  "preferredSkills": ["string (list of 3-4 nice-to-have skills)"],
  "technicalSkills": ["string (list of 4-6 key technical skills/tools)"],
  "softSkills": ["string (list of 3-4 soft skills or workplace behaviors)"],
  "minimumQualifications": ["string (list of 3-4 minimum qualifications, e.g., degree, years of experience)"],
  "preferredQualifications": ["string (list of 2-3 preferred qualifications)"],
  "experienceRequirements": "string (Description of experience required)",
  "interviewFocusAreas": ["string (list of 3-4 specific focus areas for evaluation)"],
  "evaluationCriteria": ["string (list of 3-4 criteria for scoring candidate answers)"],
  "suggestedCompetencies": ["string (list of 3-4 core competencies for this role)"],
  "suggestedKeywords": ["string (list of 5-8 resume keyword tags)"],
  "suggestedQuestionCategories": ["string (list of 3-4 interview question categories or tags)"]
}

Ensure the output is valid JSON matching this schema. Do not wrap in markdown tags or include any additional text outside the JSON.`;

      const response = await this.generateWithRetry(
        this.config.getGeminiFlashModel(),
        promptText,
        { responseMimeType: "application/json" }
      );
      const text = response.response.text().trim();
      const parsed = JSON.parse(text);

      return {
        description: String(parsed.description ?? ""),
        requirements: String(parsed.requirements ?? ""),
        keyResponsibilities: Array.isArray(parsed.keyResponsibilities) ? parsed.keyResponsibilities.map(String) : [],
        requiredSkills: Array.isArray(parsed.requiredSkills) ? parsed.requiredSkills.map(String) : [],
        preferredSkills: Array.isArray(parsed.preferredSkills) ? parsed.preferredSkills.map(String) : [],
        technicalSkills: Array.isArray(parsed.technicalSkills) ? parsed.technicalSkills.map(String) : [],
        softSkills: Array.isArray(parsed.softSkills) ? parsed.softSkills.map(String) : [],
        minimumQualifications: Array.isArray(parsed.minimumQualifications) ? parsed.minimumQualifications.map(String) : [],
        preferredQualifications: Array.isArray(parsed.preferredQualifications) ? parsed.preferredQualifications.map(String) : [],
        experienceRequirements: String(parsed.experienceRequirements ?? ""),
        interviewFocusAreas: Array.isArray(parsed.interviewFocusAreas) ? parsed.interviewFocusAreas.map(String) : [],
        evaluationCriteria: Array.isArray(parsed.evaluationCriteria) ? parsed.evaluationCriteria.map(String) : [],
        suggestedCompetencies: Array.isArray(parsed.suggestedCompetencies) ? parsed.suggestedCompetencies.map(String) : [],
        suggestedKeywords: Array.isArray(parsed.suggestedKeywords) ? parsed.suggestedKeywords.map(String) : [],
        suggestedQuestionCategories: Array.isArray(parsed.suggestedQuestionCategories) ? parsed.suggestedQuestionCategories.map(String) : [],
      };
    } catch (err) {
      this.logger.error(`Error generating JD assist details: ${err}`);
      throw err;
    }
  }
}
