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
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { SupabaseAuthGuard } from "../guards/supabase-auth.guard";
import { Roles, RolesGuard } from "../guards/roles.guard";
import { CandidateWorkflowService } from "../../application/candidate/candidate-workflow.service";
import { FileProcessingPipelineService } from "../../application/candidate/file-processing-pipeline.service";
import { PrismaService } from "../../infrastructure/database/prisma.service";

@Controller("candidates")
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class CandidatesController {
  constructor(
    private readonly workflow: CandidateWorkflowService,
    private readonly filePipeline: FileProcessingPipelineService,
    private readonly prisma: PrismaService,
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

  @Get(":id")
  async getOne(@Param("id") id: string) {
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
    const id = await this.workflow.apply(orgId, body.name, body.email, body.phone);
    return { id, message: "Candidate profile registered successfully." };
  }

  @Patch(":id/status")
  @Roles("recruiter", "admin")
  async updateStatus(@Param("id") id: string, @Body() body: { status: any; reason?: string }) {
    await this.workflow.transition(id, body.status, body.reason);
    return { message: "Candidate state transitioned successfully." };
  }

  @Post(":id/upload-resume")
  @Roles("recruiter", "admin")
  @UseInterceptors(FileInterceptor("file"))
  async uploadResume(
    @Req() req: any,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const orgId = req.user.orgId || "00000000-0000-0000-0000-000000000000";
    await this.filePipeline.processResume(orgId, id, file.originalname, file.buffer, file.mimetype);
    return { message: "Resume file uploaded and parsed by pipeline." };
  }

  @Get(":id/timeline")
  async getTimeline(@Param("id") id: string) {
    return this.prisma.candidateTimeline.findMany({
      where: { candidate_id: id },
      orderBy: { created_at: "asc" },
    });
  }

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
}
