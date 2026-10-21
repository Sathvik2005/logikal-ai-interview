import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  Inject,
  ServiceUnavailableException,
  BadRequestException,
  ForbiddenException,
  ParseUUIDPipe,
} from "@nestjs/common";
import { CANDIDATE_STATUSES, type CandidateStatus } from "../../domain/candidate/candidate.entity";
import { FileInterceptor } from "@nestjs/platform-express";
import { SupabaseAuthGuard } from "../guards/supabase-auth.guard";
import { Roles, RolesGuard } from "../guards/roles.guard";
import { CandidateWorkflowService } from "../../application/candidate/candidate-workflow.service";
import { FileProcessingPipelineService } from "../../application/candidate/file-processing-pipeline.service";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { StorageService } from "../../application/services/storage.service";
import {
  HiringDecisionService,
  type Decision,
} from "../../application/candidate/hiring-decision.service";
import {
  DocumentTextService,
  MAX_DOCUMENT_BYTES,
} from "../../application/services/document-text.service";
import {
  IAIOrchestrator,
  IAIOrchestratorToken,
} from "../../application/common/ai/ai-orchestrator.interface";

@Roles("recruiter", "admin")
@Controller("candidates")
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class CandidatesController {
  constructor(
    private readonly workflow: CandidateWorkflowService,
    private readonly filePipeline: FileProcessingPipelineService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly documentText: DocumentTextService,
    private readonly decisions: HiringDecisionService,
    @Inject(IAIOrchestratorToken)
    private readonly aiOrchestrator: IAIOrchestrator,
  ) {}

  @Get()
  @Roles("recruiter", "admin")
  async list(@Query("search") search?: string, @Query("status") status?: string) {
    const where: any = { deleted_at: null };
    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { full_name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { role_applied: { contains: search, mode: "insensitive" } },
      ];
    }
    return this.prisma.candidate.findMany({
      where,
      orderBy: { created_at: "desc" },
    });
  }

  /** Candidates whose AI evaluation is finished and who are waiting for a human decision. */
  @Get("awaiting-decision")
  @Roles("recruiter", "admin")
  async awaitingDecision(@Req() req: any) {
    const claimedOrg: string | undefined = req.user.orgFromProfile;
    return this.decisions.awaiting(claimedOrg);
  }

  /** Human-triggered: tell the candidate the outcome of the latest hire/reject decision (once). */
  @Post(":id/decision/notify")
  @Roles("recruiter", "admin")
  async notifyOutcome(
    @Req() req: any,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: { message?: string },
  ) {
    return this.decisions.notifyOutcome(
      id,
      {
        userId: req.user.userId,
        email: req.user.email,
        orgId: req.user.orgId || "00000000-0000-0000-0000-000000000000",
      },
      body?.message,
    );
  }

  @Get("notifications")
  @Roles("recruiter", "admin")
  async listNotifications(@Req() req: any, @Query("limit") limit?: string) {
    const orgId = req.user.orgId || "00000000-0000-0000-0000-000000000000";
    const lim = limit ? parseInt(limit, 10) : 20;
    return this.prisma.notificationOutbox.findMany({
      where: { org_id: orgId },
      orderBy: { created_at: "desc" },
      take: Math.min(lim, 100),
    });
  }

  @Get(":id/decisions")
  @Roles("recruiter", "admin")
  async decisionState(@Param("id", ParseUUIDPipe) id: string) {
    return this.decisions.state(id);
  }

  /** The only route that can hire or reject a candidate. Records who decided, when and why. */
  @Post(":id/decision")
  @Roles("recruiter", "admin")
  async decide(
    @Req() req: any,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: { decision: Decision; note?: string },
  ) {
    return this.decisions.decide(id, body?.decision, body?.note, {
      userId: req.user.userId,
      email: req.user.email,
      orgId: req.user.orgId || "00000000-0000-0000-0000-000000000000",
    });
  }

  @Get(":id")
  async getOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.prisma.candidate.findUnique({
      where: { id },
      include: {
        timeline: true,
        matches: {
          include: {
            job: true,
          },
        },
      },
    });
  }

  @Post()
  @Roles("recruiter", "admin")
  async create(@Req() req: any, @Body() body: any) {
    const orgId = req.user.orgId || "00000000-0000-0000-0000-000000000000";
    const id = await this.workflow.apply(
      orgId,
      body.name,
      body.email,
      body.phone,
      body.role,
      body.skills,
      body.experienceYears,
      body.notes,
      body.jobId,
      body.customRole,
      body.resumeAnalysis,
    );
    return { id, message: "Candidate profile registered successfully." };
  }

  @Patch(":id")
  @Roles("recruiter", "admin")
  async updateCandidate(@Param("id", ParseUUIDPipe) id: string, @Body() body: any) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id },
    });
    if (!candidate) throw new Error("Candidate not found");

    const updated = await this.prisma.candidate.update({
      where: { id },
      data: {
        full_name: body.name !== undefined ? body.name : candidate.full_name,
        email: body.email !== undefined ? body.email : candidate.email,
        phone: body.phone !== undefined ? body.phone : candidate.phone,
        skills: body.skills !== undefined ? body.skills : candidate.skills,
        experience_years:
          body.experienceYears !== undefined ? body.experienceYears : candidate.experience_years,
        resume_summary:
          body.resumeSummary !== undefined ? body.resumeSummary : candidate.resume_summary,
        role_applied: body.role !== undefined ? body.role : candidate.role_applied,
        job_id: body.jobId !== undefined ? body.jobId : candidate.job_id,
        custom_role:
          body.customRole !== undefined ? body.customRole : (candidate.custom_role ?? {}),
        resume_analysis:
          body.resumeAnalysis !== undefined
            ? body.resumeAnalysis
            : (candidate.resume_analysis ?? {}),
      },
    });
    return updated;
  }

  @Patch(":id/status")
  @Roles("recruiter", "admin")
  async updateStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: { status: CandidateStatus; reason?: string; advance?: boolean },
  ) {
    if (body?.status === "hiring_decision") {
      throw new ForbiddenException(
        "A hiring decision must be made by a person. Use POST /candidates/:id/decision.",
      );
    }
    if (!CANDIDATE_STATUSES.includes(body?.status)) {
      throw new BadRequestException(`Invalid candidate status "${body?.status}".`);
    }
    if (body.advance) {
      await this.workflow.advanceTo(id, body.status, body.reason);
    } else {
      await this.workflow.transition(id, body.status, body.reason);
    }
    return { message: "Candidate state transitioned successfully." };
  }

  /**
   * Read an uploaded resume and return the extracted profile fields so the "Add candidate" form can be
   * pre-filled. Nothing is stored or created here.
   */
  @Post("parse-resume")
  @Roles("recruiter", "admin")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_DOCUMENT_BYTES } }))
  async parseResume(@UploadedFile() file: Express.Multer.File) {
    if (!this.aiOrchestrator.isAvailable()) {
      throw new ServiceUnavailableException(
        "Resume parsing is not available because AI is not configured.",
      );
    }
    const doc = await this.documentText.extract(file);
    return this.aiOrchestrator.parseResume(doc.text, doc.mimeType, file.buffer);
  }

  @Post(":id/upload-resume")
  @Roles("recruiter", "admin")
  @UseInterceptors(FileInterceptor("file"))
  async uploadResume(
    @Req() req: any,
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const orgId = req.user.orgId || "00000000-0000-0000-0000-000000000000";
    await this.filePipeline.processResume(orgId, id, file.originalname, file.buffer, file.mimetype);
    return { message: "Resume file uploaded and parsed by pipeline." };
  }

  @Get(":id/timeline")
  async getTimeline(@Param("id", ParseUUIDPipe) id: string) {
    return this.prisma.candidateTimeline.findMany({
      where: { candidate_id: id },
      orderBy: { created_at: "asc" },
    });
  }

  @Roles("candidate", "recruiter", "admin")
  @Get(":id/resume-url")
  async getResumeUrl(@Req() req: any, @Param("id", ParseUUIDPipe) id: string) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id },
    });
    if (!candidate || !candidate.resume_url) return { url: null };

    const isRecruiterOrAdmin = req.user.role === "recruiter" || req.user.role === "admin";
    const isSelf = candidate.user_id === req.user.userId;

    if (!isRecruiterOrAdmin && !isSelf) {
      throw new Error("Unauthorized to access this resume URL");
    }

    const fileKey = this.storage.extractKey(candidate.resume_url, "resumes");
    if (!fileKey) return { url: candidate.resume_url };

    const url = await this.storage.getFileSignedUrl("resumes", fileKey);
    return { url };
  }

  @Roles("candidate", "recruiter", "admin")
  @Get("self/interview")
  async getSelfInterview(@Req() req: any, @Query("interviewId") interviewId?: string) {
    const userId = req.user.userId;
    const candidate = await this.prisma.candidate.findFirst({
      where: { user_id: userId },
    });
    if (!candidate) return null;

    let interview: any = null;
    if (interviewId && interviewId !== "undefined") {
      interview = await this.prisma.interview.findFirst({
        where: { id: interviewId, candidate_id: candidate.id },
        include: { job: true, persona: true, questions: true },
      });
    }

    if (!interview) {
      interview = await this.prisma.interview.findFirst({
        where: { candidate_id: candidate.id, status: { in: ["scheduled", "in_progress"] } },
        include: { job: true, persona: true, questions: true },
        orderBy: { scheduled_at: "asc" },
      });
    }

    if (!interview) {
      interview = await this.prisma.interview.findFirst({
        where: { candidate_id: candidate.id },
        include: { job: true, persona: true, questions: true },
        orderBy: { created_at: "desc" },
      });
    }

    if (!interview) return null;

    return {
      id: interview.id,
      status: interview.status,
      scheduled_at: interview.scheduled_at,
      duration_minutes: interview.duration_minutes,
      persona_id: interview.persona_id,
      job_id: interview.job_id,
      personaName: interview.persona?.name || null,
      jobTitle: interview.job?.title || null,
      curatedQuestionCount: interview.questions.length,
      candidate: {
        id: candidate.id,
        full_name: candidate.full_name,
        role_applied: candidate.role_applied,
      },
    };
  }

  @Roles("candidate", "recruiter", "admin")
  @Get("self/upcoming")
  async getSelfUpcoming(@Req() req: any) {
    const userId = req.user.userId;
    const candidate = await this.prisma.candidate.findFirst({
      where: { user_id: userId },
    });
    if (!candidate) return { upcoming: [], past: [] };

    const interviews = await this.prisma.interview.findMany({
      where: { candidate_id: candidate.id },
      include: { persona: true },
      orderBy: { scheduled_at: "asc" },
    });

    const mapped = interviews.map((i) => ({
      id: i.id,
      status: i.status,
      scheduledAt: i.scheduled_at,
      durationMinutes: i.duration_minutes ?? 45,
      role: candidate.role_applied || "—",
      personaName: i.persona?.name || "AI Interviewer",
    }));

    return {
      upcoming: mapped.filter((i) => i.status === "scheduled" || i.status === "in_progress"),
      past: mapped.filter((i) => i.status !== "scheduled" && i.status !== "in_progress"),
    };
  }

  @Post("bulk-import")
  @Roles("recruiter", "admin")
  async bulkImport(@Req() req: any, @Body() body: any) {
    const orgId = req.user.orgId || "00000000-0000-0000-0000-000000000000";
    const userId = req.user.userId;
    return this.workflow.bulkImport(orgId, userId, body.rows, body.jobId);
  }

  @Post(":id/retry-resume")
  @Roles("recruiter", "admin")
  async retryResume(@Param("id", ParseUUIDPipe) id: string) {
    await this.filePipeline.queueResumeParsing(id);
    return { message: "Candidate resume processing re-queued successfully." };
  }
}
