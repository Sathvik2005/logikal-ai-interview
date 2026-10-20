import { Interview, InterviewStatus } from "./interview.entity";
import { DomainEvent } from "../common/domain-event.base";

class MockDomainEvent extends DomainEvent {
  constructor(public readonly interviewId: string) {
    super();
  }

  getEventName(): string {
    return "MockDomainEvent";
  }
}

describe("Interview Entity State Machine", () => {
  it("should construct an interview correctly", () => {
    const date = new Date();
    const interview = new Interview(
      "int-123",
      "org-456",
      "cand-789",
      "scheduled",
      date,
      60,
      85,
      95,
      "strong_hire"
    );

    expect(interview.id).toBe("int-123");
    expect(interview.orgId).toBe("org-456");
    expect(interview.candidateId).toBe("cand-789");
    expect(interview.status).toBe("scheduled");
    expect(interview.scheduledAt).toBe(date);
    expect(interview.durationMinutes).toBe(60);
    expect(interview.overallScore).toBe(85);
    expect(interview.integrityScore).toBe(95);
    expect(interview.recommendation).toBe("strong_hire");
    expect(interview.getEvents()).toEqual([]);
  });

  it("should record, retrieve, and clear domain events", () => {
    const interview = new Interview("int-123", "org-456", "cand-789", "scheduled");
    const event = new MockDomainEvent("int-123");

    interview.addEvent(event);
    expect(interview.getEvents()).toHaveLength(1);
    expect(interview.getEvents()[0]).toBe(event);

    interview.clearEvents();
    expect(interview.getEvents()).toHaveLength(0);
  });

  it("should transition states along valid workflow paths", () => {
    const interview = new Interview("int-123", "org-456", "cand-789", "scheduled");

    // scheduled -> in_progress
    interview.transitionTo("in_progress");
    expect(interview.status).toBe("in_progress");

    // in_progress -> evaluation_pending
    interview.transitionTo("evaluation_pending");
    expect(interview.status).toBe("evaluation_pending");

    // evaluation_pending -> completed
    interview.transitionTo("completed");
    expect(interview.status).toBe("completed");
  });

  it("should support failed paths and retries", () => {
    const interview = new Interview("int-123", "org-456", "cand-789", "scheduled");

    // scheduled -> failed
    interview.transitionTo("failed");
    expect(interview.status).toBe("failed");

    // failed -> scheduled
    interview.transitionTo("scheduled");
    expect(interview.status).toBe("scheduled");
  });

  it("should throw an error for invalid state transitions", () => {
    const interview = new Interview("int-123", "org-456", "cand-789", "scheduled");

    expect(() => {
      interview.transitionTo("completed");
    }).toThrow("Invalid interview workflow transition from 'scheduled' to 'completed'");
  });
});
