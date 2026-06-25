import { Injectable, Inject, Logger } from "@nestjs/common";
import {
  ICandidateRepository,
  ICandidateRepositoryToken,
} from "../../domain/candidate/candidate.repository.interface";
import { Candidate, CandidateStatus } from "../../domain/candidate/candidate.entity";
import { IEventBus, IEventBusToken } from "../common/event-bus/event-bus.interface";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { CandidateAppliedEvent } from "../../domain/candidate/events/candidate-events";
import { IQueueService, IQueueServiceToken } from "../common/queue/queue.service";

@Injectable()
export class CandidateWorkflowService {
  private readonly logger = new Logger(CandidateWorkflowService.name);

  constructor(
    @Inject(ICandidateRepositoryToken)
    private readonly candidateRepo: ICandidateRepository,
    @Inject(IEventBusToken)
    private readonly eventBus: IEventBus,
    private readonly prisma: PrismaService,
    @Inject(IQueueServiceToken)
    private readonly queue: IQueueService,
  ) {}

  async apply(
    orgId: string,
    name: string,
    email: string,
    phone?: string,
    roleApplied?: string,
    skills?: string[],
    experienceYears?: number,
    resumeSummary?: string,
    jobId?: string,
    customRole?: any,
    resumeAnalysis?: any,
  ): Promise<string> {
    const id = crypto.randomUUID();
    const candidate = new Candidate(
      id,
      orgId,
      name,
      email,
      "applied",
      phone || null,
      skills || [],
      experienceYears || 0,
      null, // resumeUrl
      resumeSummary || null,
      roleApplied || null,
      jobId || null,
      customRole || null,
      resumeAnalysis || null,
    );
    await this.candidateRepo.create(candidate);

    // Log timeline
    await this.logTimeline(
      id,
      "applied",
      "Application Submitted",
      "Candidate profile registered on the recruitment intelligence platform.",
    );

    // Dispatch domain event
    this.eventBus.publish(new CandidateAppliedEvent(id, name, email));

    return id;
  }

  async transition(
    candidateId: string,
    newStatus: CandidateStatus,
    details?: string,
    meta?: any,
  ): Promise<void> {
    const candidate = await this.candidateRepo.findById(candidateId);
    if (!candidate) {
      throw new Error(`Candidate with ID ${candidateId} not found.`);
    }

    const oldStatus = candidate.status;
    candidate.transitionTo(newStatus);
    await this.candidateRepo.save(candidate);

    const title = this.getStatusTitle(newStatus);
    const description = details || `Candidate moved from status ${oldStatus} to ${newStatus}.`;
    await this.logTimeline(candidateId, newStatus, title, description, meta);

    this.logger.log(`Workflow State Changed [${candidateId}]: ${oldStatus} -> ${newStatus}`);
  }

  async logTimeline(
    candidateId: string,
    eventType: string,
    title: string,
    description: string,
    meta?: any,
  ): Promise<void> {
    await this.prisma.candidateTimeline.create({
      data: {
        candidate_id: candidateId,
        event_type: eventType,
        title,
        description,
        meta: meta || {},
      },
    });
  }

  private getStatusTitle(status: CandidateStatus): string {
    switch (status) {
      case "applied":
        return "Application Received";
      case "resume_imported":
        return "Resume Document Uploaded";
      case "resume_parsed":
        return "Resume Profile Extracted";
      case "jd_matched":
        return "Job Description Matched";
      case "shortlisted":
        return "Candidate Shortlisted";
      case "interview_assigned":
        return "Interview Template Assigned";
      case "interview_scheduled":
        return "Interview Slot Scheduled";
      case "invitation_sent":
        return "Invitation Invitation Sent";
      case "interview_started":
        return "Interview Session Started";
      case "interview_running":
        return "Interview Session In Progress";
      case "evaluation_processing":
        return "Grading Evaluation Processing";
      case "recruiter_review":
        return "Report Under Review";
      case "hiring_decision":
        return "Hiring Verdict Decided";
      case "archived":
        return "Candidate Profile Archived";
      default:
        return "Workflow Stage Updated";
    }
  }

  async bulkImport(
    orgId: string,
    userId: string,
    rows: any[],
    jobId?: string | null,
  ): Promise<{ imported: number; skipped: number; candidateIds: string[] }> {
    const emails = rows.map((r) => r.email.trim().toLowerCase());
    
    // Find existing candidates with the same emails in this org
    const existing = await this.prisma.candidate.findMany({
      where: {
        org_id: orgId,
        email: { in: emails },
        deleted_at: null,
      },
      select: { email: true },
    });
    
    const existingEmails = new Set(existing.map((e) => e.email.toLowerCase()));
    
    const toInsert = rows.filter((r) => !existingEmails.has(r.email.trim().toLowerCase()));
    
    const importedIds: string[] = [];
    
    for (const row of toInsert) {
      const id = crypto.randomUUID();
      const hasResume = !!row.resumeUrl;
      const initialAnalysis = hasResume ? { processingStatus: "queued" } : { processingStatus: "completed" };
      
      const candidate = new Candidate(
        id,
        orgId,
        row.name,
        row.email.trim().toLowerCase(),
        "applied",
        row.phone || null,
        row.skills || [],
        row.experienceYears || 0,
        row.resumeUrl || null,
        row.resumeSummary || null,
        row.role || null,
        jobId || null,
        null,
        initialAnalysis,
      );
      
      await this.candidateRepo.create(candidate);
      importedIds.push(id);
      
      // Log timeline
      await this.logTimeline(
        id,
        "applied",
        "Application Submitted (Bulk Import)",
        "Candidate profile created via bulk CSV import.",
      );
      
      if (hasResume) {
        // Enqueue background resume parsing
        await this.queue.enqueue("process-candidate-resume", { candidateId: id });
      } else {
        // Enqueue background matching directly
        await this.queue.enqueue("match-candidate-jd", { candidateId: id });
      }
    }
    
    if (importedIds.length > 0) {
      // Audit
      await this.prisma.auditEvent.create({
        data: {
          org_id: orgId,
          actor_id: userId,
          entity_type: "candidate",
          entity_id: importedIds[0],
          action: "bulk_import",
          diff: { count: importedIds.length, jobId: jobId || null } as any,
        },
      });
    }
    
    return {
      imported: importedIds.length,
      skipped: rows.length - importedIds.length,
      candidateIds: importedIds,
    };
  }
}
