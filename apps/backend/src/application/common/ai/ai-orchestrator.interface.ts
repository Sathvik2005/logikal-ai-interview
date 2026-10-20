export interface ParsedResume {
  name: string;
  email: string;
  phone: string | null;
  experienceYears: number;
  skills: string[];
  resumeSummary: string;
  technicalSkills?: string[];
  softSkills?: string[];
  currentRole?: string;
  previousCompanies?: string[];
  education?: string;
  certifications?: string[];
  projects?: string[];
  toolsTechnologies?: string[];
  domainExpertise?: string[];
  languages?: string[];
  suggestedSeniority?: string;
  resumeKeywords?: string[];
  jdMatchSuggestions?: string;
}

export interface SuggestedJd {
  description: string;
  requirements: string;
}

export interface JdMatchResult {
  matchScore: number;
  analysis: string;
  missingSkills?: string[];
  strengths?: string[];
  focusAreas?: string[];
}

export interface EvaluationResult {
  overallScore: number;
  recommendation: "strong_hire" | "hire" | "no_hire" | "strong_no_hire";
  strengths: string[];
  concerns: string[];
  summary: string;
  competencyScores: Record<string, number>;
  integrityScore: number;
}

export interface IAIOrchestrator {
  parseResume(
    resumeText: string,
    mimeType?: string,
    fileBuffer?: Buffer,
    jdContext?: string,
  ): Promise<ParsedResume>;
  suggestJd(title: string, department?: string): Promise<SuggestedJd>;
  matchJdCandidate(jdRequirements: string, candidateProfile: any): Promise<JdMatchResult>;
  generateInterviewQuestion(
    personaPrompt: string,
    history: Array<{ speaker: string; text: string }>,
    jdContext?: string,
    candidateContext?: string,
    nextCuratedQuestion?: string,
  ): Promise<string>;
  evaluateInterview(
    rubric: any,
    turns: Array<{ speaker: string; text: string }>,
    integrityFlags: Record<string, number>,
  ): Promise<EvaluationResult>;
  generateReportMarkdown(
    candidateInfo: any,
    jdContext: any,
    evaluation: EvaluationResult,
  ): Promise<string>;
  generatePersonaPrompt(params: {
    name: string;
    role: string;
    domain: string;
    style: string;
    strictness: string;
    tone: string;
    difficulty: string;
    responsibilities: string;
  }): Promise<string>;
  generateJDAssist(params: {
    title: string;
    department?: string;
    experienceLevel: string;
    location?: string;
    employmentType: string;
  }): Promise<JDAssistResult>;
}

export interface JDAssistResult {
  description: string;
  requirements: string;
  keyResponsibilities: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  technicalSkills: string[];
  softSkills: string[];
  minimumQualifications: string[];
  preferredQualifications: string[];
  experienceRequirements: string;
  interviewFocusAreas: string[];
  evaluationCriteria: string[];
  suggestedCompetencies: string[];
  suggestedKeywords: string[];
  suggestedQuestionCategories: string[];
}

export const IAIOrchestratorToken = Symbol("IAIOrchestrator");
