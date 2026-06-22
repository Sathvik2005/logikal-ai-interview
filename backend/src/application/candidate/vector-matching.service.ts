import { Injectable, Inject, Logger, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { IAIOrchestrator, IAIOrchestratorToken } from '../common/ai/ai-orchestrator.interface';
import { CandidateWorkflowService } from './candidate-workflow.service';
import { ICandidateRepository, ICandidateRepositoryToken } from '../../domain/candidate/candidate.repository.interface';

@Injectable()
export class VectorMatchingService {
  private readonly logger = new Logger(VectorMatchingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(IAIOrchestratorToken)
    private readonly aiOrchestrator: IAIOrchestrator,
    private readonly workflow: CandidateWorkflowService,
    @Inject(ICandidateRepositoryToken)
    private readonly candidateRepo: ICandidateRepository,
  ) {}

  async matchCandidateToAllJobs(candidateId: string): Promise<void> {
    this.logger.log(`Matching candidate [${candidateId}] against open roles...`);
    const candidate = await this.candidateRepo.findById(candidateId);
    if (!candidate) return;

    const jds = await this.prisma.jobDescription.findMany({
      where: {
        org_id: candidate.orgId,
        status: 'open',
        deleted_at: null,
      },
    });

    if (jds.length === 0) {
      this.logger.log(`No open job descriptions found in organization: ${candidate.orgId}`);
      await this.workflow.transition(
        candidateId,
        'jd_matched',
        'JD compatibility matching complete. No active roles currently published.',
        { matchesCount: 0 }
      );
      return;
    }

    let highestScore = 0;
    let bestMatchJobTitle = '';

    for (const jd of jds) {
      const jdRequirements = `${jd.title}\nRequirements: ${jd.requirements || ''}\nDescription: ${jd.description || ''}`;
      
      const candidateProfile = {
        name: candidate.name,
        skills: candidate.skills,
        experienceYears: candidate.experienceYears,
        summary: candidate.resumeSummary,
      };

      const result = await this.aiOrchestrator.matchJdCandidate(jdRequirements, candidateProfile);

      // Save match record
      await this.prisma.jdCandidateMatch.create({
        data: {
          job_id: jd.id,
          candidate_id: candidateId,
          match_score: result.matchScore,
          analysis: { explanation: result.analysis } as any,
        },
      });

      if (result.matchScore > highestScore) {
        highestScore = result.matchScore;
        bestMatchJobTitle = jd.title;
      }
    }

    // Save highest score back to candidate row
    await this.prisma.candidate.update({
      where: { id: candidateId },
      data: { ai_score: highestScore },
    });

    await this.workflow.transition(
      candidateId,
      'jd_matched',
      `Calculated match metrics. Best fit: "${bestMatchJobTitle}" (${highestScore}% match score).`,
      { highestScore, bestMatchJobTitle }
    );

    // Auto-shortlist threshold
    if (highestScore >= 80) {
      await this.workflow.transition(
        candidateId,
        'shortlisted',
        `Auto-shortlisted candidate due to highly compatible skill vector score of ${highestScore}% for "${bestMatchJobTitle}".`
      );
    }
  }
}
