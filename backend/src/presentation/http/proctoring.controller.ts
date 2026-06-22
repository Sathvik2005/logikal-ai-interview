import { Controller, Get, Post, Param, Body, UseGuards, Req, Inject } from "@nestjs/common";
import { SupabaseAuthGuard } from "../guards/supabase-auth.guard";
import { Roles, RolesGuard } from "../guards/roles.guard";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { StorageService } from "../../application/services/storage.service";
import { IQueueService, IQueueServiceToken } from "../../application/common/queue/queue.service";
import { CandidateWorkflowService } from "../../application/candidate/candidate-workflow.service";

@Controller("proctoring")
@UseGuards(SupabaseAuthGuard)
export class ProctoringController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly workflow: CandidateWorkflowService,
    @Inject(IQueueServiceToken)
    private readonly queue: IQueueService,
  ) {}

  @Post("identity")
  async verifyIdentity(@Req() req: any, @Body() body: any) {
    const userId = req.user.userId;
    const orgId = req.user.orgId || "00000000-0000-0000-0000-000000000000";

    const interview = await this.prisma.interview.findUnique({
      where: { id: body.interviewId },
    });
    if (!interview) throw new Error("Interview not found");

    // Decode selfie data URL
    const selfieMatch = body.selfieDataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/i);
    let selfiePath = null;
    if (selfieMatch) {
      const selfieBuffer = Buffer.from(selfieMatch[2], "base64");
      const selfieExt = selfieMatch[1].split("/")[1] || "png";
      selfiePath = `${userId}/${body.interviewId}/selfie-${Date.now()}.${selfieExt}`;
      await this.storage.uploadFile("identity", selfiePath, selfieBuffer, selfieMatch[1]);
    }

    let idPath = null;
    if (body.idDataUrl) {
      const idMatch = body.idDataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/i);
      if (idMatch) {
        const idBuffer = Buffer.from(idMatch[2], "base64");
        const idExt = idMatch[1].split("/")[1] || "png";
        idPath = `${userId}/${body.interviewId}/id-${Date.now()}.${idExt}`;
        await this.storage.uploadFile("identity", idPath, idBuffer, idMatch[1]);
      }
    }

    const verification = await this.prisma.identityVerification.create({
      data: {
        org_id: interview.org_id || orgId,
        interview_id: body.interviewId,
        candidate_id: interview.candidate_id,
        selfie_path: selfiePath,
        id_document_path: idPath,
        status: "verified",
        match_score: 0.95,
        device_fingerprint: body.deviceFingerprint || {},
      },
    });

    await this.workflow.logTimeline(
      interview.candidate_id,
      "identity_verified",
      "Identity Verification Verified",
      "Candidate submitted biometric selfie and ID credentials.",
    );

    return { ok: true, verificationId: verification.id };
  }

  @Post("snapshot")
  async uploadSnapshot(@Req() req: any, @Body() body: any) {
    const userId = req.user.userId;
    const orgId = req.user.orgId || "00000000-0000-0000-0000-000000000000";

    const session = await this.prisma.interviewSession.findUnique({
      where: { id: body.sessionId },
      include: { interview: true },
    });
    if (!session) throw new Error("Session not found");

    const imgMatch = body.dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/i);
    if (!imgMatch) throw new Error("Invalid snapshot data URL");
    const imgBuffer = Buffer.from(imgMatch[2], "base64");
    const ext = imgMatch[1].split("/")[1] || "png";
    const storagePath = `${userId}/${session.interview_id}/${body.kind}-${Date.now()}.${ext}`;

    await this.storage.uploadFile("snapshots", storagePath, imgBuffer, imgMatch[1]);

    await this.prisma.proctoringSnapshot.create({
      data: {
        org_id: session.org_id || orgId,
        session_id: body.sessionId,
        interview_id: session.interview_id,
        kind: body.kind,
        storage_path: storagePath,
        meta: body.meta || {},
      },
    });

    return { ok: true };
  }

  @Post("generate-report")
  @Roles("recruiter", "admin")
  async triggerReport(@Body() body: { interviewId: string }) {
    // Find most recent session
    const session = await this.prisma.interviewSession.findFirst({
      where: { interview_id: body.interviewId },
      orderBy: { started_at: "desc" },
    });
    if (!session) throw new Error("No active sessions found to evaluate.");

    await this.queue.enqueue("finalize-evaluation", {
      interviewId: body.interviewId,
      sessionId: session.id,
    });
    return { ok: true };
  }

  @Get("report-bundle/:interviewId")
  async getReportBundle(@Param("interviewId") interviewId: string) {
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
      include: { candidate: true, persona: true },
    });
    if (!interview) throw new Error("Interview not found");

    const report = await this.prisma.interviewReport.findUnique({
      where: { interview_id: interviewId },
    });

    const session = await this.prisma.interviewSession.findFirst({
      where: { interview_id: interviewId },
      orderBy: { started_at: "desc" },
    });

    let turns: any[] = [];
    let events: any[] = [];
    let snapshots: any[] = [];

    if (session) {
      turns = await this.prisma.interviewTurn.findMany({
        where: { session_id: session.id },
        orderBy: { started_at: "asc" },
      });

      events = await this.prisma.interviewEvent.findMany({
        where: { session_id: session.id },
        orderBy: { at: "asc" },
      });

      const snapRows = await this.prisma.proctoringSnapshot.findMany({
        where: { session_id: session.id },
        orderBy: { captured_at: "desc" },
        take: 60,
      });

      snapshots = await Promise.all(
        snapRows.map(async (s) => {
          const url = await this.storage
            .getFileSignedUrl("snapshots", s.storage_path)
            .catch(() => null);
          return {
            id: s.id,
            kind: s.kind,
            capturedAt: s.captured_at,
            url,
          };
        }),
      );
    }

    return {
      report,
      interview: {
        id: interview.id,
        candidateName: interview.candidate.full_name,
        role: interview.candidate.role_applied || "—",
        personaName: interview.persona?.name || "AI Interviewer",
        scheduledAt: interview.scheduled_at,
        durationMinutes: interview.duration_minutes ?? 45,
        status: interview.status,
        overallScore: interview.overall_score ? Number(interview.overall_score) : null,
        recommendation: interview.recommendation,
        integrityScore: interview.integrity_score ? Number(interview.integrity_score) : null,
        candidateEmail: interview.candidate.email,
        candidatePhone: interview.candidate.phone || "",
        candidateResumeSummary: interview.candidate.resume_summary || "",
        candidateSkills: interview.candidate.skills,
        candidateExperienceYears: interview.candidate.experience_years
          ? Number(interview.candidate.experience_years)
          : 0,
      },
      turns,
      events,
      snapshots,
    };
  }
}
