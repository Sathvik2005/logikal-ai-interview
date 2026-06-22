import { Controller, Get, Post, Param, Body, Req, UseGuards, Inject } from '@nestjs/common';
import { SupabaseAuthGuard } from '../guards/supabase-auth.guard';
import { Roles, RolesGuard } from '../guards/roles.guard';
import { InterviewEngineService } from '../../application/interview/interview-engine.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CandidateWorkflowService } from '../../application/candidate/candidate-workflow.service';
import { IQueueService, IQueueServiceToken } from '../../application/common/queue/queue.service';

@Controller('interviews')
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
  async list(@Req() req: any) {
    const orgId = req.user.orgId || '00000000-0000-0000-0000-000000000000';
    return this.prisma.interview.findMany({
      where: { org_id: orgId, deleted_at: null },
      include: { candidate: true, job: true, template: true },
      orderBy: { created_at: 'desc' },
    });
  }

  @Post()
  @Roles('recruiter', 'admin')
  async schedule(@Req() req: any, @Body() body: any) {
    const orgId = req.user.orgId || '00000000-0000-0000-0000-000000000000';
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
          difficulty: body.difficulty || 'medium',
          meeting_provider: body.meetingProvider || 'teams',
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
        status: 'scheduled',
      },
    });

    // 3. Update candidate workflow timelines
    await this.workflow.transition(
      body.candidateId,
      'interview_assigned',
      'Assigned interview template to candidate. Link is ready.',
      { interviewId: interview.id }
    );

    if (body.scheduledAt) {
      await this.workflow.transition(
        body.candidateId,
        'interview_scheduled',
        `Scheduled interview window starting at ${body.scheduledAt}.`
      );
    }

    // 4. Send email invitation outbox
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: body.candidateId },
    });
    
    if (candidate) {
      await this.workflow.transition(
        body.candidateId,
        'invitation_sent',
        'Dispatched interview invitation email with entry instructions.'
      );
      
      await this.queue.enqueue('send-notification', {
        orgId,
        kind: 'interview_invitation',
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

  @Post('session/start')
  async start(@Body() body: { interviewId: string; deviceInfo?: any }) {
    return this.engine.startSession(body.interviewId, body.deviceInfo);
  }

  @Post('session/end')
  async end(@Body() body: { sessionId: string }) {
    await this.engine.endSession(body.sessionId);
    return { status: 'success' };
  }

  @Get('session/:sessionId/turns')
  async getTurns(@Param('sessionId') sessionId: string) {
    return this.prisma.interviewTurn.findMany({
      where: { session_id: sessionId },
      orderBy: { started_at: 'asc' },
    });
  }

  @Post('session/:sessionId/turn')
  async appendTurn(
    @Param('sessionId') sessionId: string,
    @Body() body: { speaker: 'candidate' | 'persona' | 'system'; text: string; audioPath?: string },
  ) {
    return this.engine.appendTurn(sessionId, body.speaker, body.text, body.audioPath);
  }

  @Post('session/:sessionId/next-question')
  async getNextQuestion(@Param('sessionId') sessionId: string) {
    return this.engine.getNextQuestion(sessionId);
  }

  @Post('session/:sessionId/event')
  async logEvent(@Param('sessionId') sessionId: string, @Body() body: { type: string; payload?: any }) {
    await this.engine.recordEvent(sessionId, body.type, body.payload);
    return { status: 'success' };
  }

  @Post(':id/finalize-evaluation')
  @Roles('recruiter', 'admin')
  async finalizeEvaluation(@Param('id') id: string, @Body() body: { sessionId: string }) {
    await this.queue.enqueue('finalize-evaluation', {
      interviewId: id,
      sessionId: body.sessionId,
    });
    return { status: 'queued' };
  }

  @Get(':id/evaluation')
  async getEvaluation(@Param('id') id: string) {
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
}
