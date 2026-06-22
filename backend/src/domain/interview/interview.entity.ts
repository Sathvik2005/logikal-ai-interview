import { DomainEvent } from "../common/domain-event.base";

export type InterviewStatus =
  | "scheduled"
  | "in_progress"
  | "evaluation_pending"
  | "completed"
  | "failed";

export class Interview {
  private readonly events: DomainEvent[] = [];

  constructor(
    public readonly id: string,
    public readonly orgId: string,
    public readonly candidateId: string,
    public status: InterviewStatus,
    public scheduledAt: Date | null = null,
    public durationMinutes: number = 45,
    public overallScore: number | null = null,
    public integrityScore: number | null = null,
    public recommendation: string | null = null,
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

  transitionTo(newStatus: InterviewStatus): void {
    const validTransitions: Record<InterviewStatus, InterviewStatus[]> = {
      scheduled: ["in_progress", "failed"],
      in_progress: ["evaluation_pending", "failed"],
      evaluation_pending: ["completed", "failed"],
      completed: [],
      failed: ["scheduled"],
    };

    const allowed = validTransitions[this.status] ?? [];
    if (!allowed.includes(newStatus) && this.status !== newStatus) {
      throw new Error(
        `Invalid interview workflow transition from '${this.status}' to '${newStatus}'`,
      );
    }

    this.status = newStatus;
  }
}
