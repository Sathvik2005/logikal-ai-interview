import { Injectable, Inject, Logger } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import {
  IInterviewRepository,
  IInterviewRepositoryToken,
} from "../../domain/interview/interview.repository.interface";
import { Interview, InterviewStatus } from "../../domain/interview/interview.entity";
import { CandidateWorkflowService } from "../candidate/candidate-workflow.service";
import { IAIOrchestrator, IAIOrchestratorToken } from "../common/ai/ai-orchestrator.interface";
import { IQueueService, IQueueServiceToken } from "../common/queue/queue.service";

@Injectable()
export class InterviewEngineService {
  private readonly logger = new Logger(InterviewEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(IInterviewRepositoryToken)
    private readonly interviewRepo: IInterviewRepository,
    private readonly candidateWorkflow: CandidateWorkflowService,
    @Inject(IAIOrchestratorToken)
    private readonly aiOrchestrator: IAIOrchestrator,
    @Inject(IQueueServiceToken)
    private readonly queue: IQueueService,
  ) {}

  async startSession(interviewId: string, deviceInfo?: any): Promise<any> {
    this.logger.log(`Starting interview session: ${interviewId}`);
    const interview = await this.interviewRepo.findById(interviewId);
    if (!interview) {
      throw new Error(`Interview not found: ${interviewId}`);
    }

    interview.transitionTo("in_progress");
    await this.interviewRepo.save(interview);

    // Create session row
    const session = await this.prisma.interviewSession.create({
      data: {
        interview_id: interviewId,
        org_id: interview.orgId,
        device_info: deviceInfo || {},
      },
    });

    // Update candidate state
    await this.candidateWorkflow.transition(
      interview.candidateId,
      "interview_started",
      "Candidate joined the interview room and initialized their session.",
      { sessionId: session.id },
    );

    return {
      id: session.id,
      interviewId: session.interview_id,
      startedAt: session.started_at,
    };
  }

  async appendTurn(
    sessionId: string,
    speaker: "candidate" | "persona" | "system",
    text: string,
    audioPath?: string,
  ): Promise<any> {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new Error("Session not found");

    const turn = await this.prisma.interviewTurn.create({
      data: {
        session_id: sessionId,
        speaker,
        text,
        audio_path: audioPath || null,
        started_at: new Date(),
        ended_at: new Date(),
      },
    });

    // Record turn to timeline
    const interview = await this.prisma.interview.findUnique({
      where: { id: session.interview_id },
    });
    if (interview) {
      await this.candidateWorkflow.logTimeline(
        interview.candidate_id,
        `turn_${speaker}`,
        `${speaker.toUpperCase()} Turn`,
        text.slice(0, 150) + (text.length > 150 ? "..." : ""),
      );
    }

    return turn;
  }

  async recordEvent(sessionId: string, type: string, payload?: any): Promise<void> {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: { interview: true },
    });
    if (!session) throw new Error("Session not found");

    await this.prisma.interviewEvent.create({
      data: {
        session_id: sessionId,
        type,
        payload: payload || {},
        at: new Date(),
      },
    });

    // Log integrity signals on timeline
    if (["tab_switch", "devtools", "focus_loss", "multi_face"].includes(type)) {
      await this.candidateWorkflow.logTimeline(
        session.interview.candidate_id,
        `integrity_violation`,
        `Integrity Signal: ${type}`,
        `Suspicious activity caught: ${type} event recorded during session.`,
        payload,
      );
    }
  }

  async getNextQuestion(sessionId: string): Promise<any> {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: { interview: true },
    });
    if (!session) throw new Error("Session not found");

    const interviewId = session.interview_id;
    const interview = session.interview;

    // Load AI Persona details
    let personaPrompt =
      "You are a professional AI interviewer. Ask one focused question at a time.";
    let personaName = "Ava";
    if (interview.persona_version_id) {
      const pv = await this.prisma.personaVersion.findUnique({
        where: { id: interview.persona_version_id },
        include: { persona: true },
      });
      if (pv) {
        personaPrompt = pv.system_prompt;
        personaName = pv.persona.name;
      }
    } else if (interview.persona_id) {
      const p = await this.prisma.persona.findUnique({
        where: { id: interview.persona_id },
      });
      if (p) {
        personaPrompt = p.prompt || personaPrompt;
        personaName = p.name;
      }
    }

    // Load Candidate Context
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: interview.candidate_id },
    });
    let candidateContext = "";
    if (candidate) {
      candidateContext = `Candidate Name: ${candidate.full_name}\nResume Summary: ${candidate.resume_summary || ""}\nSkills: ${candidate.skills.join(", ")}`;
    }

    // Load Job Description context
    let jdContext = "";
    if (interview.job_id) {
      const jd = await this.prisma.jobDescription.findUnique({
        where: { id: interview.job_id },
      });
      if (jd) {
        jdContext = `Job Title: ${jd.title}\nRequirements: ${jd.requirements || ""}`;
      }
    } else if (candidate && (candidate as any).custom_role) {
      const cr = (candidate as any).custom_role as any;
      if (cr && cr.roleTitle) {
        jdContext = `Job Title (Custom Candidate Role): ${cr.roleTitle}
Department: ${cr.department || "N/A"}
Experience Level: ${cr.experienceLevel || "N/A"}
Employment Type: ${cr.employmentType || "N/A"}
Location: ${cr.location || "N/A"}
Skills: ${Array.isArray(cr.skills) ? cr.skills.join(", ") : (cr.skills || "")}
Responsibilities: ${cr.responsibilities || ""}
Notes: ${cr.notes || ""}`;
      }
    }

    // Fetch previous turns in the session
    const turns = await this.prisma.interviewTurn.findMany({
      where: { session_id: sessionId },
      orderBy: { started_at: "asc" },
    });

    const history = turns.map((t) => ({
      speaker: t.speaker,
      text: t.text,
    }));

    // Check curated questions queue
    const personaTurns = turns.filter((t) => t.speaker === "persona");
    const curatedQuestions = await this.prisma.interviewQuestion.findMany({
      where: { interview_id: interviewId },
      orderBy: { ordering: "asc" },
      include: { question: true },
    });

    let nextCuratedQuestion: string | undefined;
    if (personaTurns.length < curatedQuestions.length) {
      nextCuratedQuestion = curatedQuestions[personaTurns.length].question.prompt;
    }

    this.logger.log(
      `Generating next question. Curated turns: ${personaTurns.length}/${curatedQuestions.length}`,
    );
    const questionText = await this.aiOrchestrator.generateInterviewQuestion(
      personaPrompt,
      history,
      jdContext,
      candidateContext,
      nextCuratedQuestion,
    );

    // Save generated question turn
    const turn = await this.appendTurn(sessionId, "persona", questionText);
    return {
      id: turn.id,
      speaker: "persona",
      text: questionText,
    };
  }

  async endSession(sessionId: string): Promise<void> {
    this.logger.log(`Ending session: ${sessionId}`);
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: { interview: true },
    });
    if (!session) throw new Error("Session not found");

    await this.prisma.interviewSession.update({
      where: { id: sessionId },
      data: { ended_at: new Date() },
    });

    const interview = await this.interviewRepo.findById(session.interview_id);
    if (interview) {
      interview.transitionTo("evaluation_pending");
      await this.interviewRepo.save(interview);

      await this.prisma.interview.update({
        where: { id: session.interview_id },
        data: { evaluation_status: "queued" },
      });

      // Update candidate workflow
      await this.candidateWorkflow.transition(
        interview.candidateId,
        "evaluation_processing",
        "Interview room closed. Enqueuing AI evaluation pipeline.",
        { sessionId },
      );

      // Dispatch to background queue
      await this.queue.enqueue("finalize-evaluation", {
        interviewId: interview.id,
        sessionId: sessionId,
      });
    }
  }
}
