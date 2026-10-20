import { Injectable, Inject, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { IAIOrchestrator, IAIOrchestratorToken } from "../common/ai/ai-orchestrator.interface";
import { CandidateWorkflowService } from "../candidate/candidate-workflow.service";
import { IQueueService, IQueueServiceToken } from "../common/queue/queue.service";
import { InMemoryQueueService } from "../../infrastructure/queue/in-memory-queue.service";
import { IEventBus, IEventBusToken } from "../common/event-bus/event-bus.interface";
import { EvaluationCompletedEvent } from "../../domain/interview/events/interview-events";

@Injectable()
export class EvaluationService implements OnModuleInit {
  private readonly logger = new Logger(EvaluationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(IAIOrchestratorToken)
    private readonly aiOrchestrator: IAIOrchestrator,
    private readonly workflow: CandidateWorkflowService,
    @Inject(IQueueServiceToken)
    private readonly queue: IQueueService,
    @Inject(IEventBusToken)
    private readonly eventBus: IEventBus,
  ) {}

  onModuleInit() {
    if (this.queue instanceof InMemoryQueueService) {
      this.queue.registerProcessor("finalize-evaluation", async (payload: any) => {
        await this.finalizeEvaluation(payload.interviewId, payload.sessionId);
      });
    }
  }

  async finalizeEvaluation(interviewId: string, sessionId: string): Promise<void> {
    this.logger.log(`Starting background AI evaluation grading for interview: ${interviewId}`);

    await this.prisma.interview.update({
      where: { id: interviewId },
      data: { evaluation_status: "running" },
    });

    try {
      // 1. Gather all transcript turns
      const turns = await this.prisma.interviewTurn.findMany({
        where: { session_id: sessionId },
        orderBy: { started_at: "asc" },
      });

      // 2. Gather all integrity events
      const events = await this.prisma.interviewEvent.findMany({
        where: { session_id: sessionId },
      });

      const integrityFlags: Record<string, number> = {};
      events.forEach((e) => {
        integrityFlags[e.type] = (integrityFlags[e.type] ?? 0) + 1;
      });

      // 3. Load rubric contexts
      const interview = await this.prisma.interview.findUnique({
        where: { id: interviewId },
        include: { candidate: true, job: true, template: true },
      });
      if (!interview) throw new Error("Interview not found");

      const rubric = interview.template?.evaluation_criteria || {};

      // 4. Call AI Evaluation Agent
      const turnsPayload = turns.map((t) => ({ speaker: t.speaker, text: t.text }));
      const evaluation = await this.aiOrchestrator.evaluateInterview(
        rubric,
        turnsPayload,
        integrityFlags,
      );

      // 5. Update interview record
      await this.prisma.interview.update({
        where: { id: interviewId },
        data: {
          status: "completed",
          evaluation_status: "done",
          overall_score: evaluation.overallScore,
          integrity_score: evaluation.integrityScore,
          recommendation: evaluation.recommendation,
          evaluation: evaluation as any,
        },
      });

      // 6. Generate detailed report
      let jdContext: any = {};
      if (interview.job) {
        jdContext = { title: interview.job.title, requirements: interview.job.requirements };
      } else if (interview.candidate && (interview.candidate as any).custom_role) {
        const cr = (interview.candidate as any).custom_role as any;
        if (cr && cr.roleTitle) {
          jdContext = {
            title: cr.roleTitle,
            requirements: `Department: ${cr.department || "N/A"}
Experience Level: ${cr.experienceLevel || "N/A"}
Employment Type: ${cr.employmentType || "N/A"}
Location: ${cr.location || "N/A"}
Skills: ${Array.isArray(cr.skills) ? cr.skills.join(", ") : (cr.skills || "")}
Responsibilities: ${cr.responsibilities || ""}
Notes: ${cr.notes || ""}`
          };
        }
      }

      const reportMarkdown = await this.aiOrchestrator.generateReportMarkdown(
        { name: interview.candidate.full_name, email: interview.candidate.email },
        jdContext,
        evaluation,
      );

      // 7. Write scorecard to database
      const report = await this.prisma.interviewReport.create({
        data: {
          org_id: interview.org_id || "00000000-0000-0000-0000-000000000000",
          interview_id: interviewId,
          executive_summary: reportMarkdown,
          scores: evaluation.competencyScores as any,
          strengths: evaluation.strengths as any,
          weaknesses: evaluation.concerns as any,
          integrity_score: evaluation.integrityScore,
          recommendation: evaluation.recommendation,
        },
      });

      // 8. Move candidate state to recruiter review
      await this.workflow.transition(
        interview.candidate_id,
        "recruiter_review",
        "AI Evaluation engine completed grading. Report metrics available.",
        { score: evaluation.overallScore, recommendation: evaluation.recommendation },
      );

      // 9. Dispatch event
      this.eventBus.publish(
        new EvaluationCompletedEvent(
          interviewId,
          report.id,
          evaluation.overallScore,
          evaluation.recommendation,
        ),
      );

      // 10. Queue email delivery
      await this.queue.enqueue("send-notification", {
        orgId: interview.org_id,
        kind: "interview_report_ready",
        recipientEmail: interview.candidate.email,
        payload: {
          candidateName: interview.candidate.full_name,
          score: evaluation.overallScore,
          interviewId,
        },
      });
    } catch (err) {
      this.logger.error(`AI Evaluation task failed: ${err}`);
      await this.prisma.interview.update({
        where: { id: interviewId },
        data: { evaluation_status: "failed" },
      });
      throw err;
    }
  }
}
