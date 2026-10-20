import { Injectable } from "@nestjs/common";
import { IInterviewRepository } from "../../../domain/interview/interview.repository.interface";
import { Interview, InterviewStatus } from "../../../domain/interview/interview.entity";
import { PrismaService } from "../prisma.service";

@Injectable()
export class PrismaInterviewRepository implements IInterviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Interview | null> {
    const row = await this.prisma.interview.findUnique({
      where: { id },
    });
    if (!row) return null;
    return new Interview(
      row.id,
      row.org_id || "",
      row.candidate_id,
      row.status as InterviewStatus,
      row.scheduled_at,
      row.duration_minutes || 45,
      row.overall_score ? Number(row.overall_score) : null,
      row.integrity_score ? Number(row.integrity_score) : null,
      row.recommendation,
    );
  }

  async create(interview: Interview): Promise<void> {
    await this.prisma.interview.create({
      data: {
        id: interview.id,
        org_id: interview.orgId || null,
        created_by: "00000000-0000-0000-0000-000000000000",
        candidate_id: interview.candidateId,
        status: interview.status,
        scheduled_at: interview.scheduledAt,
        duration_minutes: interview.durationMinutes,
      },
    });
  }

  async save(interview: Interview): Promise<void> {
    await this.prisma.interview.update({
      where: { id: interview.id },
      data: {
        status: interview.status,
        scheduled_at: interview.scheduledAt,
        duration_minutes: interview.durationMinutes,
        overall_score: interview.overallScore,
        integrity_score: interview.integrityScore,
        recommendation: interview.recommendation,
        updated_at: new Date(),
      },
    });
  }
}
