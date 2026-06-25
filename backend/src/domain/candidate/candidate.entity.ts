import { DomainEvent } from "../common/domain-event.base";

export type CandidateStatus =
  | "applied"
  | "resume_imported"
  | "resume_parsed"
  | "jd_matched"
  | "shortlisted"
  | "interview_assigned"
  | "interview_scheduled"
  | "invitation_sent"
  | "interview_started"
  | "interview_running"
  | "evaluation_processing"
  | "recruiter_review"
  | "hiring_decision"
  | "archived";

export class Candidate {
  private readonly events: DomainEvent[] = [];

  constructor(
    public readonly id: string,
    public readonly orgId: string,
    public name: string,
    public email: string,
    public status: CandidateStatus,
    public phone: string | null = null,
    public skills: string[] = [],
    public experienceYears: number = 0,
    public resumeUrl: string | null = null,
    public resumeSummary: string | null = null,
    public roleApplied: string | null = null,
    public jobId: string | null = null,
    public customRole: any = null,
    public resumeAnalysis: any = null,
  ) {}

  addEvent(event: DomainEvent): void {
    this.events.push(event);
  }

  getEvents(): DomainEvent[] {
    return this.events;
  }

  clearEvents(): void {
    this.events.length = 0;
  }

  transitionTo(newStatus: CandidateStatus): void {
    const validTransitions: Record<CandidateStatus, CandidateStatus[]> = {
      applied: ["resume_imported", "archived"],
      resume_imported: ["resume_parsed", "archived"],
      resume_parsed: ["jd_matched", "archived"],
      jd_matched: ["shortlisted", "archived"],
      shortlisted: ["interview_assigned", "archived"],
      interview_assigned: ["interview_scheduled", "archived"],
      interview_scheduled: ["invitation_sent", "archived"],
      invitation_sent: ["interview_started", "archived"],
      interview_started: ["interview_running", "archived"],
      interview_running: ["evaluation_processing", "archived"],
      evaluation_processing: ["recruiter_review", "archived"],
      recruiter_review: ["hiring_decision", "archived"],
      hiring_decision: ["archived"],
      archived: ["applied", "resume_imported", "resume_parsed"],
    };

    const allowed = validTransitions[this.status] ?? [];
    if (!allowed.includes(newStatus) && this.status !== newStatus) {
      throw new Error(
        `Invalid candidate workflow transition from '${this.status}' to '${newStatus}'`,
      );
    }

    this.status = newStatus;
  }
}
