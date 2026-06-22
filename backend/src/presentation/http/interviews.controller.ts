import { Controller, Get, Post, Patch, Param, Body, Query, Req, UseGuards, Inject } from "@nestjs/common";
import { SupabaseAuthGuard } from "../guards/supabase-auth.guard";
import { Roles, RolesGuard } from "../guards/roles.guard";
import { InterviewEngineService } from "../../application/interview/interview-engine.service";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { CandidateWorkflowService } from "../../application/candidate/candidate-workflow.service";
import { IQueueService, IQueueServiceToken } from "../../application/common/queue/queue.service";

@Controller("interviews")
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class InterviewsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: InterviewEngineService,
    private readonly workflow: CandidateWorkflowService,
    @Inject(IQueueServiceToken)
    private readonly queue: IQueueService,
  ) {}

  @Get()
  async list(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    const orgId = req.user.orgId || "00000000-0000-0000-0000-000000000000";
    const where: any = { org_id: orgId, deleted_at: null };
    if (status) {
      where.status = status;
    }
    if (from || to) {
      where.scheduled_at = {};
      if (from) where.scheduled_at.gte = new Date(from);
      if (to) where.scheduled_at.lte = new Date(to);
    }
    const lim = limit ? parseInt(limit, 10) : 100;
    return this.prisma.interview.findMany({
      where,
      include: { candidate: true, job: true, template: true },
      orderBy: { scheduled_at: "asc" },
      take: Math.min(lim, 200),
    });
  }

  @Post()
  @Roles("recruiter", "admin")
  async schedule(@Req() req: any, @Body() body: any) {
    const orgId = req.user.orgId || "00000000-0000-0000-0000-000000000000";
    const userId = req.user.userId;

    // 1. Create or Find Interview Template
    let templateId = body.templateId;
    if (!templateId) {
      // Auto-create a template mapping the configured components
      const temp = await this.prisma.interviewTemplate.create({
        data: {
          name: `Template for candidate ${body.candidateId}`,
          org_id: orgId,
          job_id: body.jobId || null,
          persona_id: body.personaId || null,
          question_bank_ids: body.questionIds || [],
          duration_minutes: body.durationMinutes || 45,
          difficulty: body.difficulty || "medium",
          meeting_provider: body.meetingProvider || "teams",
          proctoring_policy: body.proctoringPolicy || {},
          report_template: body.reportTemplate || {},
        },
      });
      templateId = temp.id;
    }

    // 2. Create Interview linking to Template
    const interview = await this.prisma.interview.create({
      data: {
        org_id: orgId,
        created_by: userId,
        candidate_id: body.candidateId,
        job_id: body.jobId || null,
        persona_id: body.personaId || null,
        template_id: templateId,
        scheduled_at: body.scheduledAt ? new Date(body.scheduledAt) : null,
        duration_minutes: body.durationMinutes || 45,
        status: "scheduled",
      },
    });

    // 3. Update candidate workflow timelines
    await this.workflow.transition(
      body.candidateId,
      "interview_assigned",
      "Assigned interview template to candidate. Link is ready.",
      { interviewId: interview.id },
    );

    if (body.scheduledAt) {
      await this.workflow.transition(
        body.candidateId,
        "interview_scheduled",
        `Scheduled interview window starting at ${body.scheduledAt}.`,
      );
    }

    // 4. Send email invitation outbox
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: body.candidateId },
    });

    if (candidate) {
      await this.workflow.transition(
        body.candidateId,
        "invitation_sent",
        "Dispatched interview invitation email with entry instructions.",
      );

      await this.queue.enqueue("send-notification", {
        orgId,
        kind: "interview_invitation",
        recipientEmail: candidate.email,
        payload: {
          candidateName: candidate.full_name,
          interviewId: interview.id,
          role: candidate.role_applied,
        },
      });
    }

    return interview;
  }

  @Post("session/start")
  async start(@Body() body: { interviewId: string; deviceInfo?: any }) {
    return this.engine.startSession(body.interviewId, body.deviceInfo);
  }

  @Post("session/end")
  async end(@Body() body: { sessionId: string }) {
    await this.engine.endSession(body.sessionId);
    return { status: "success" };
  }

  @Get("session/:sessionId/turns")
  async getTurns(@Param("sessionId") sessionId: string) {
    return this.prisma.interviewTurn.findMany({
      where: { session_id: sessionId },
      orderBy: { started_at: "asc" },
    });
  }

  @Post("session/:sessionId/turn")
  async appendTurn(
    @Param("sessionId") sessionId: string,
    @Body() body: { speaker: "candidate" | "persona" | "system"; text: string; audioPath?: string },
  ) {
    return this.engine.appendTurn(sessionId, body.speaker, body.text, body.audioPath);
  }

  @Post("session/:sessionId/next-question")
  async getNextQuestion(@Param("sessionId") sessionId: string) {
    return this.engine.getNextQuestion(sessionId);
  }

  @Post("session/:sessionId/event")
  async logEvent(
    @Param("sessionId") sessionId: string,
    @Body() body: { type: string; payload?: any },
  ) {
    await this.engine.recordEvent(sessionId, body.type, body.payload);
    return { status: "success" };
  }

  @Post(":id/finalize-evaluation")
  @Roles("recruiter", "admin")
  async finalizeEvaluation(@Param("id") id: string, @Body() body: { sessionId: string }) {
    await this.queue.enqueue("finalize-evaluation", {
      interviewId: id,
      sessionId: body.sessionId,
    });
    return { status: "queued" };
  }

  @Get(":id/evaluation")
  async getEvaluation(@Param("id") id: string) {
    return this.prisma.interview.findUnique({
      where: { id },
      select: {
        id: true,
        evaluation: true,
        overall_score: true,
        recommendation: true,
        integrity_score: true,
        evaluation_status: true,
        status: true,
      },
    });
  }

  @Get(":id")
  async getOne(@Param("id") id: string) {
    return this.prisma.interview.findUnique({
      where: { id },
      include: { candidate: true, job: true, template: true, persona: true },
    });
  }

  @Patch(":id/reschedule")
  @Roles("recruiter", "admin")
  async reschedule(
    @Param("id") id: string,
    @Body() body: { scheduledAt: string; durationMinutes?: number; reason?: string },
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    const existing = await this.prisma.interview.findUnique({
      where: { id },
    });
    if (!existing) throw new Error("Interview not found");
    if (existing.status === "completed" || existing.status === "evaluation_pending") {
      throw new Error(`Cannot reschedule a completed or pending evaluation interview`);
    }

    const duration = body.durationMinutes ?? existing.duration_minutes ?? 45;

    await this.prisma.interview.update({
      where: { id },
      data: {
        scheduled_at: new Date(body.scheduledAt),
        duration_minutes: duration,
        status: "scheduled",
      },
    });

    await this.prisma.interviewReschedule.create({
      data: {
        interview_id: id,
        from_at: existing.scheduled_at,
        to_at: new Date(body.scheduledAt),
        reason: body.reason ?? null,
        actor_id: userId,
      },
    });

    const candidate = await this.prisma.candidate.findUnique({
      where: { id: existing.candidate_id },
    });

    if (candidate) {
      await this.workflow.transition(
        existing.candidate_id,
        "interview_scheduled",
        `Rescheduled interview window starting at ${body.scheduledAt}.`,
      );

      await this.queue.enqueue("send-notification", {
        orgId: existing.org_id,
        kind: "reschedule",
        recipientEmail: candidate.email,
        payload: {
          interviewId: id,
          candidateName: candidate.full_name,
          from: existing.scheduled_at ? existing.scheduled_at.toISOString() : null,
          to: body.scheduledAt,
          reason: body.reason ?? null,
        },
      });
    }

    return { ok: true };
  }

  @Patch(":id/cancel")
  @Roles("recruiter", "admin")
  async cancel(
    @Param("id") id: string,
    @Body() body: { reason?: string },
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    const existing = await this.prisma.interview.findUnique({
      where: { id },
    });
    if (!existing) throw new Error("Interview not found");
    if (existing.status === "completed" || existing.status === "evaluation_pending") {
      throw new Error(`Cannot cancel a completed or pending evaluation interview`);
    }

    await this.prisma.interview.update({
      where: { id },
      data: { status: "cancelled" },
    });

    const candidate = await this.prisma.candidate.findUnique({
      where: { id: existing.candidate_id },
    });

    if (candidate) {
      await this.workflow.transition(
        existing.candidate_id,
        "archived",
        `Cancelled interview. Reason: ${body.reason ?? "None provided"}`,
      );

      await this.queue.enqueue("send-notification", {
        orgId: existing.org_id,
        kind: "cancel",
        recipientEmail: candidate.email,
        payload: {
          interviewId: id,
          candidateName: candidate.full_name,
          scheduledAt: existing.scheduled_at ? existing.scheduled_at.toISOString() : null,
          reason: body.reason ?? null,
        },
      });
    }

    return { ok: true };
  }

  @Get("live")
  async listLive(@Req() req: any) {
    const orgId = req.user.orgId || "00000000-0000-0000-0000-000000000000";
    const now = new Date();
    const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const interviews = await this.prisma.interview.findMany({
      where: {
        org_id: orgId,
        deleted_at: null,
        status: { in: ["scheduled", "in_progress"] },
        scheduled_at: { lte: horizon },
      },
      include: {
        candidate: {
          select: {
            full_name: true,
            email: true,
            role_applied: true,
          },
        },
        persona: {
          select: {
            name: true,
          },
        },
        sessions: {
          select: {
            id: true,
          },
          orderBy: { started_at: "desc" },
          take: 1,
        },
      },
      orderBy: { scheduled_at: "asc" },
    });

    return interviews.map((iv) => ({
      id: iv.id,
      candidateName: iv.candidate?.full_name ?? "Candidate",
      candidateEmail: iv.candidate?.email ?? "",
      role: iv.candidate?.role_applied ?? "Interview",
      personaName: iv.persona?.name ?? "AI Interviewer",
      scheduledAt: iv.scheduled_at ? iv.scheduled_at.toISOString() : null,
      durationMinutes: iv.duration_minutes ?? 45,
      status: iv.status,
      sessionId: iv.sessions[0]?.id ?? null,
    }));
  }

  @Get("recorded")
  async listRecorded(@Req() req: any) {
    const orgId = req.user.orgId || "00000000-0000-0000-0000-000000000000";

    const interviews = await this.prisma.interview.findMany({
      where: {
        org_id: orgId,
        deleted_at: null,
        status: { in: ["completed", "evaluation_pending"] },
      },
      include: {
        candidate: {
          select: {
            full_name: true,
            email: true,
            role_applied: true,
          },
        },
        persona: {
          select: {
            name: true,
          },
        },
        sessions: {
          select: {
            id: true,
            started_at: true,
            ended_at: true,
          },
          orderBy: { started_at: "desc" },
          take: 1,
        },
      },
      orderBy: { scheduled_at: "desc" },
      take: 60,
    });

    return interviews.map((iv) => {
      const s = iv.sessions[0];
      const start = s?.started_at ? s.started_at.getTime() : 0;
      const end = s?.ended_at ? s.ended_at.getTime() : 0;
      const durationSec = end > start ? Math.round((end - start) / 1000) : (iv.duration_minutes ?? 45) * 60;

      return {
        id: s?.id ?? iv.id,
        interviewId: iv.id,
        candidateName: iv.candidate?.full_name ?? "Candidate",
        role: iv.candidate?.role_applied ?? "Interview",
        personaName: iv.persona?.name ?? "AI Interviewer",
        durationSec,
        scheduledAt: iv.scheduled_at ? iv.scheduled_at.toISOString() : null,
        score: iv.overall_score ? Number(iv.overall_score) : null,
      };
    });
  }

  @Get("monitor/:interviewId")
  async getMonitorSession(@Param("interviewId") interviewId: string) {
    const iv = await this.prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        candidate: {
          select: {
            full_name: true,
            email: true,
            role_applied: true,
          },
        },
        persona: {
          select: {
            name: true,
          },
        },
      },
    });
    if (!iv) throw new Error("Interview not found");

    const sess = await this.prisma.interviewSession.findFirst({
      where: { interview_id: interviewId },
      orderBy: { started_at: "desc" },
    });

    const sessionId = sess?.id ?? null;
    const interview = {
      id: iv.id,
      candidateName: iv.candidate?.full_name ?? "Candidate",
      candidateEmail: iv.candidate?.email ?? "",
      role: iv.candidate?.role_applied ?? "Interview",
      personaName: iv.persona?.name ?? "AI Interviewer",
      scheduledAt: iv.scheduled_at ? iv.scheduled_at.toISOString() : null,
      durationMinutes: iv.duration_minutes ?? 45,
      status: iv.status,
      sessionId,
    };

    let turns: any[] = [];
    let events: any[] = [];
    if (sessionId) {
      const [tRows, eRows] = await Promise.all([
        this.prisma.interviewTurn.findMany({
          where: { session_id: sessionId },
          orderBy: { created_at: "asc" },
        }),
        this.prisma.interviewEvent.findMany({
          where: { session_id: sessionId },
          orderBy: { at: "asc" },
        }),
      ]);

      turns = tRows.map((t) => ({
        id: t.id,
        who: t.speaker === "candidate" ? "Candidate" : "AI",
        text: t.text ?? "",
        at: t.started_at ? t.started_at.toISOString() : t.created_at.toISOString(),
      }));

      events = eRows.map((e) => ({
        id: e.id,
        type: e.type,
        payload: e.payload == null ? null : JSON.stringify(e.payload),
        at: e.at.toISOString(),
      }));
    }

    return {
      interview,
      session: sess
        ? {
            id: sess.id,
            startedAt: sess.started_at ? sess.started_at.toISOString() : null,
            endedAt: sess.ended_at ? sess.ended_at.toISOString() : null,
          }
        : null,
      turns,
      events,
    };
  }

  @Post("session/:sessionId/flag")
  async flagSessionEvent(
    @Param("sessionId") sessionId: string,
    @Body() body: { note: string },
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    await this.prisma.interviewEvent.create({
      data: {
        session_id: sessionId,
        type: "manual_flag",
        payload: { note: body.note, flagged_by: userId },
      },
    });
    return { ok: true };
  }
}
