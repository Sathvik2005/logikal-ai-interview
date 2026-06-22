import { Injectable } from '@nestjs/common';

@Injectable()
export class AppConfigService {
  get(key: string, defaultValue?: string): string {
    const val = process.env[key];
    if (val === undefined) {
      return defaultValue ?? '';
    }
    return val;
  }

  getGeminiApiKey(): string {
    return this.get('GEMINI_API_KEY', '');
  }

  getEvaluationWeights(): { technical: number; behavioral: number; communication: number } {
    return {
      technical: parseFloat(this.get('WEIGHT_TECHNICAL', '0.4')),
      behavioral: parseFloat(this.get('WEIGHT_BEHAVIORAL', '0.3')),
      communication: parseFloat(this.get('WEIGHT_COMMUNICATION', '0.3')),
    };
  }

  getQuestionLimits(): number {
    return parseInt(this.get('QUESTION_LIMITS', '10'), 10);
  }

  getTimeouts(): number {
    return parseInt(this.get('INTERVIEW_TIMEOUT_SECONDS', '1800'), 10);
  }
}
