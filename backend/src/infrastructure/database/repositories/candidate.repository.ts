import { Injectable } from "@nestjs/common";
import { ICandidateRepository } from "../../../domain/candidate/candidate.repository.interface";
import { Candidate, CandidateStatus } from "../../../domain/candidate/candidate.entity";
import { PrismaService } from "../prisma.service";

@Injectable()
export class PrismaCandidateRepository implements ICandidateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Candidate | null> {
    const row = await this.prisma.candidate.findUnique({
      where: { id },
    });
    if (!row) return null;
    return new Candidate(
      row.id,
      row.org_id || "",
      row.full_name,
      row.email,
      row.status as CandidateStatus,
      row.phone,
      row.skills,
      row.experience_years ? Number(row.experience_years) : 0,
      row.resume_url,
      row.resume_summary,
      row.role_applied,
      row.job_id,
      row.custom_role,
      row.resume_analysis,
    );
  }

  async create(candidate: Candidate): Promise<void> {
    await this.prisma.candidate.create({
      data: {
        id: candidate.id,
        org_id: candidate.orgId || null,
        created_by: "00000000-0000-0000-0000-000000000000", // Default system boundary actor
        full_name: candidate.name,
        email: candidate.email,
        status: candidate.status,
        phone: candidate.phone,
        skills: candidate.skills,
        experience_years: candidate.experienceYears,
        resume_url: candidate.resumeUrl,
        resume_summary: candidate.resumeSummary,
        role_applied: candidate.roleApplied,
        job_id: candidate.jobId,
        custom_role: candidate.customRole || {},
        resume_analysis: candidate.resumeAnalysis || {},
      },
    });
  }

  async save(candidate: Candidate): Promise<void> {
    await this.prisma.candidate.update({
      where: { id: candidate.id },
      data: {
        full_name: candidate.name,
        email: candidate.email,
        status: candidate.status,
        phone: candidate.phone,
        skills: candidate.skills,
        experience_years: candidate.experienceYears,
        resume_url: candidate.resumeUrl,
        resume_summary: candidate.resumeSummary,
        role_applied: candidate.roleApplied,
        job_id: candidate.jobId,
        custom_role: candidate.customRole || {},
        resume_analysis: candidate.resumeAnalysis || {},
        updated_at: new Date(),
      },
    });
  }
}
