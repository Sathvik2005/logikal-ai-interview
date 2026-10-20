import { DomainEvent } from "../../common/domain-event.base";

export class CandidateAppliedEvent extends DomainEvent {
  constructor(
    public readonly candidateId: string,
    public readonly name: string,
    public readonly email: string,
  ) {
    super();
  }
  getEventName(): string {
    return "CandidateAppliedEvent";
  }
}

export class ResumeParsedEvent extends DomainEvent {
  constructor(
    public readonly candidateId: string,
    public readonly name: string,
    public readonly skills: string[],
    public readonly experienceYears: number,
  ) {
    super();
  }
  getEventName(): string {
    return "ResumeParsedEvent";
  }
}

export class JdMatchedEvent extends DomainEvent {
  constructor(
    public readonly candidateId: string,
    public readonly jobId: string,
    public readonly score: number,
  ) {
    super();
  }
  getEventName(): string {
    return "JdMatchedEvent";
  }
}
