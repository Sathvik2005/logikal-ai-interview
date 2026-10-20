import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { CandidateWorkflowService } from "./candidate-workflow.service";

export type Decision = "hire" | "hold" | "reject";
export const DECISIONS: readonly Decision[] = ["hire", "hold", "reject"];

const POSITIVE_AI = new Set(["strong_hire", "hire"]);
const NEGATIVE_AI = new Set(["strong_no_hire", "no_hire"]);
export const MIN_NOTE_LENGTH = 10;

/** True when the human's decision goes against the AI recommendation (or there is no AI view at all). */
export function isOverride(decision: Decision, aiRecommendation: string | null): boolean {
  if (!aiRecommendation) return decision !== "hold";
  if (decision === "hire") return NEGATIVE_AI.has(aiRecommendation);
  if (decision === "reject") return POSITIVE_AI.has(aiRecommendation);
  return false;
}

export type DecisionActor = { userId: string; email?: string | null; orgId: string };

/**
 * The only way a candidate reaches a final outcome. The AI can recommend; a named person decides.
 * - Only candidates in `recruiter_review` (AI evaluation finished) can be hired or rejected.
 * - A note is mandatory for rejections, holds and any decision that overrides the AI.
 * - Every decision is stored with who, when, the AI recommendation and whether it was overridden.
 */
@Injectable()
export class HiringDecisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: CandidateWorkflowService,
  ) {}

  /** Candidates whose AI evaluation is done and who are waiting for a human decision. */
  async awaiting(orgId?: string) {
    const candidates = await this.prisma.candidate.findMany({
      where: { status: "recruiter_review", deleted_at: null, ...(orgId ? { org_id: orgId } : {}) },
      orderBy: { updated_at: "asc" },
      take: 200,
    });
    return Promise.all(
      candidates.map(async (c) => {
        const ctx = await this.context(c.id);
        return {
          candidateId: c.id,
          name: c.full_name,
          email: c.email,
          role: c.role_applied,
          waitingSince: c.updated_at,
          ...ctx,
        };
      }),
    );
  }

  /** AI recommendation/score for the candidate's latest completed report. */
  async context(candidateId: string) {
    const interview = await this.prisma.interview.findFirst({
      where: { candidate_id: candidateId, reports: { isNot: null } },
      orderBy: { created_at: "desc" },
      include: { reports: true },
    });
    const scores = (interview?.reports?.scores ?? {}) as Record<string, number>;
    const values = Object.values(scores).filter((n) => typeof n === "number");
    return {
      interviewId: interview?.id ?? null,
      aiRecommendation: interview?.reports?.recommendation ?? null,
      aiScore: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null,
      integrityScore: interview?.reports?.integrity_score
        ? Number(interview.reports.integrity_score)
        : null,
    };
  }

  /** Everything the decision panel needs: whether a decision is due, the AI view, and past decisions. */
  async state(candidateId: string) {
    const [candidate, history, context] = await Promise.all([
      this.prisma.candidate.findUnique({ where: { id: candidateId }, select: { status: true } }),
      this.history(candidateId),
      this.context(candidateId),
    ]);
    return { awaiting: candidate?.status === "recruiter_review", history, context };
  }

  async history(candidateId: string) {
    return this.prisma.candidateDecision.findMany({
      where: { candidate_id: candidateId },
      orderBy: { decided_at: "desc" },
    });
  }

  async decide(
    candidateId: string,
    decision: Decision,
    note: string | undefined,
    actor: DecisionActor,
  ) {
    if (!DECISIONS.includes(decision)) {
      throw new BadRequestException("Decision must be hire, hold or reject.");
    }
    const candidate = await this.prisma.candidate.findUnique({ where: { id: candidateId } });
    if (!candidate || candidate.deleted_at) throw new BadRequestException("Candidate not found.");
    if (candidate.status !== "recruiter_review") {
      throw new ConflictException(
        "This candidate is not awaiting a decision (the interview must be evaluated first).",
      );
    }

    const ctx = await this.context(candidateId);
    const overrode = isOverride(decision, ctx.aiRecommendation);
    const trimmed = (note ?? "").trim();
    const noteRequired = decision !== "hire" || overrode;
    if (noteRequired && trimmed.length < MIN_NOTE_LENGTH) {
      throw new BadRequestException(
        overrode
          ? `Add a note (at least ${MIN_NOTE_LENGTH} characters) explaining why you are overriding the AI recommendation.`
          : `Add a note (at least ${MIN_NOTE_LENGTH} characters) explaining this decision.`,
      );
    }

    const record = await this.prisma.candidateDecision.create({
      data: {
        org_id: candidate.org_id ?? actor.orgId,
        candidate_id: candidateId,
        interview_id: ctx.interviewId,
        decision,
        note: trimmed || null,
        ai_recommendation: ctx.aiRecommendation,
        ai_score: ctx.aiScore,
        overrode_ai: overrode,
        decided_by: actor.userId,
        decided_by_email: actor.email ?? null,
      },
    });

    const meta = {
      decisionId: record.id,
      decision,
      decidedBy: actor.email ?? actor.userId,
      overrodeAi: overrode,
    };
    if (decision === "hire") {
      await this.workflow.transition(
        candidateId,
        "hiring_decision",
        trimmed || "Approved for hire.",
        meta,
      );
    } else if (decision === "reject") {
      await this.workflow.transition(candidateId, "archived", `Rejected: ${trimmed}`, meta);
    } else {
      // "hold": stays in review, but the decision (and reason) is on the timeline.
      await this.workflow.logTimeline(
        candidateId,
        "decision_hold",
        "Decision on hold",
        trimmed,
        meta,
      );
    }
    return record;
  }
}
