import { DomainEvent } from "../../common/domain-event.base";

export class InterviewScheduledEvent extends DomainEvent {
  constructor(
    public readonly interviewId: string,
    public readonly candidateId: string,
    public readonly scheduledAt: Date,
  ) {
    super();
  }
  getEventName(): string {
    return "InterviewScheduledEvent";
  }
}

export class InterviewStartedEvent extends DomainEvent {
  constructor(
    public readonly interviewId: string,
    public readonly sessionId: string,
  ) {
    super();
  }
  getEventName(): string {
    return "InterviewStartedEvent";
  }
}

export class InterviewCompletedEvent extends DomainEvent {
  constructor(
    public readonly interviewId: string,
    public readonly sessionId: string,
  ) {
    super();
  }
  getEventName(): string {
    return "InterviewCompletedEvent";
  }
}

export class EvaluationCompletedEvent extends DomainEvent {
  constructor(
    public readonly interviewId: string,
    public readonly reportId: string,
    public readonly score: number,
    public readonly recommendation: string,
  ) {
    super();
  }
  getEventName(): string {
    return "EvaluationCompletedEvent";
  }
}
