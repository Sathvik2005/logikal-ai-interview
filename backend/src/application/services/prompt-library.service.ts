import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class PromptLibraryService implements OnModuleInit {
  private readonly logger = new Logger(PromptLibraryService.name);

  private readonly defaultPrompts = [
    {
      name: 'INTERVIEW_AGENT',
      prompt_type: 'interview',
      prompt_text: 'You are Aria, a warm, professional AI interviewer. Ask one focused question at a time. Probe with brief follow-ups. Keep questions under 40 words.',
    },
    {
      name: 'RESUME_PARSE_AGENT',
      prompt_type: 'resume_parse',
      prompt_text: 'Extract the candidate\'s full name, email, phone number, experience years, skills (as list of strings), and a short resume summary paragraph. Return ONLY a JSON object with keys: "name", "email", "phone", "experienceYears", "skills", "resumeSummary".',
    },
    {
      name: 'JD_MATCHING_AGENT',
      prompt_type: 'jd_matching',
      prompt_text: 'Compare this candidate\'s parsed profile against this job description title and requirements. Output a percentage score (0-100) and a brief fit analysis paragraph. Return JSON format with keys: "matchScore", "analysis".',
    },
    {
      name: 'EVALUATION_AGENT',
      prompt_type: 'evaluation',
      prompt_text: 'You are a rigorous interview evaluator. Read the transcript and return a JSON object with EXACTLY this shape:\n{\n  "overallScore": number 0-100,\n  "recommendation": "strong_hire" | "hire" | "no_hire" | "strong_no_hire",\n  "strengths": string[],\n  "concerns": string[],\n  "summary": string,\n  "competencyScores": { [competency: string]: number 0-100 },\n  "integrityScore": number 0-100\n}\nBe honest and grounded in the transcript. Penalize the integrity score for repeated tab switches or focus loss.',
    },
    {
      name: 'REPORT_AGENT',
      prompt_type: 'report',
      prompt_text: 'Generate a comprehensive professional evaluation report based on candidate details, job description context, and overall evaluation scores. Output in markdown style summarizing candidate strengths and fitting qualifications.',
    },
  ];

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedPrompts();
  }

  private async seedPrompts() {
    this.logger.log('Checking prompt library seeds...');
    for (const dp of this.defaultPrompts) {
      const existing = await this.prisma.promptLibrary.findUnique({
        where: { name: dp.name },
      });
      if (!existing) {
        await this.prisma.promptLibrary.create({
          data: dp,
        });
        this.logger.log(`Seeded prompt template: ${dp.name}`);
      }
    }
  }

  async getPrompt(name: string): Promise<string> {
    const record = await this.prisma.promptLibrary.findUnique({
      where: { name },
    });
    if (!record) {
      const defaultDp = this.defaultPrompts.find((p) => p.name === name);
      if (defaultDp) return defaultDp.prompt_text;
      throw new Error(`Prompt template ${name} not found in library.`);
    }
    return record.prompt_text;
  }

  async updatePrompt(name: string, text: string): Promise<void> {
    await this.prisma.promptLibrary.update({
      where: { name },
      data: { prompt_text: text, updated_at: new Date() },
    });
    this.logger.log(`Updated prompt template: ${name}`);
  }
}
