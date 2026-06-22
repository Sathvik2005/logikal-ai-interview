export interface ParsedResume {
  name: string;
  email: string;
  phone: string | null;
  experienceYears: number;
  skills: string[];
  resumeSummary: string;
}

export interface SuggestedJd {
  description: string;
  requirements: string;
}

export interface JdMatchResult {
  matchScore: number;
  analysis: string;
}

export interface EvaluationResult {
  overallScore: number;
  recommendation: 'strong_hire' | 'hire' | 'no_hire' | 'strong_no_hire';
  strengths: string[];
  concerns: string[];
  summary: string;
  competencyScores: Record<string, number>;
  integrityScore: number;
}

export interface IAIOrchestrator {
  parseResume(resumeText: string): Promise<ParsedResume>;
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
}

export const IAIOrchestratorToken = Symbol('IAIOrchestrator');
