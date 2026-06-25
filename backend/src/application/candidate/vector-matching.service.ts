import { Injectable, Inject, Logger, forwardRef, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { IAIOrchestrator, IAIOrchestratorToken } from "../common/ai/ai-orchestrator.interface";
import { CandidateWorkflowService } from "./candidate-workflow.service";
import {
  ICandidateRepository,
  ICandidateRepositoryToken,
} from "../../domain/candidate/candidate.repository.interface";
import { IQueueService, IQueueServiceToken } from "../common/queue/queue.service";

@Injectable()
export class VectorMatchingService implements OnModuleInit {
  private readonly logger = new Logger(VectorMatchingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(IAIOrchestratorToken)
    private readonly aiOrchestrator: IAIOrchestrator,
    private readonly workflow: CandidateWorkflowService,
    @Inject(ICandidateRepositoryToken)
    private readonly candidateRepo: ICandidateRepository,
    @Inject(IQueueServiceToken)
    private readonly queue: IQueueService,
  ) {}

  onModuleInit() {
    this.queue.registerProcessor("match-candidate-jd", async (payload: { candidateId: string }) => {
      await this.matchCandidateToAllJobs(payload.candidateId);
    });
  }

  async matchCandidateToAllJobs(candidateId: string): Promise<void> {
    this.logger.log(`Matching candidate [${candidateId}] against open roles...`);
    const candidate = await this.candidateRepo.findById(candidateId);
    if (!candidate) return;

    const query: any = {
      org_id: candidate.orgId,
      deleted_at: null,
    };
    if (candidate.jobId) {
      query.id = candidate.jobId;
    } else {
      query.status = "open";
    }

    const jds = await this.prisma.jobDescription.findMany({
      where: query,
    });

    if (jds.length === 0) {
      this.logger.log(`No open job descriptions found in organization: ${candidate.orgId}`);
      await this.workflow.transition(
        candidateId,
        "jd_matched",
        "JD compatibility matching complete. No active roles currently published.",
        { matchesCount: 0 },
      );
      return;
    }

    let highestScore = 0;
    let bestMatchJobTitle = "";

    for (const jd of jds) {
      let jdRequirements = `${jd.title}\nRequirements: ${jd.requirements || ""}\nDescription: ${jd.description || ""}`;
      if (jd.competencies) {
        try {
          const comp = (typeof jd.competencies === "string" ? JSON.parse(jd.competencies) : jd.competencies) as any;
          if (comp) {
            if (Array.isArray(comp.requiredSkills) && comp.requiredSkills.length > 0) {
              jdRequirements += `\nRequired Skills: ${comp.requiredSkills.join(", ")}`;
            }
            if (Array.isArray(comp.technicalSkills) && comp.technicalSkills.length > 0) {
              jdRequirements += `\nTechnical Skills: ${comp.technicalSkills.join(", ")}`;
            }
            if (Array.isArray(comp.softSkills) && comp.softSkills.length > 0) {
              jdRequirements += `\nSoft Skills: ${comp.softSkills.join(", ")}`;
            }
            if (Array.isArray(comp.minimumQualifications) && comp.minimumQualifications.length > 0) {
              jdRequirements += `\nMinimum Qualifications: ${comp.minimumQualifications.join(", ")}`;
            }
          }
        } catch (e) {
          // ignore parsing issues
        }
      }

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
      "jd_matched",
      `Calculated match metrics. Best fit: "${bestMatchJobTitle}" (${highestScore}% match score).`,
      { highestScore, bestMatchJobTitle },
    );

    // Auto-shortlist threshold
    if (highestScore >= 80) {
      await this.workflow.transition(
        candidateId,
        "shortlisted",
        `Auto-shortlisted candidate due to highly compatible skill vector score of ${highestScore}% for "${bestMatchJobTitle}".`,
      );
    }
  }
}
