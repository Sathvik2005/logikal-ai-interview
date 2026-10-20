import { Candidate, CandidateStatus } from "./candidate.entity";
import { DomainEvent } from "../common/domain-event.base";

class MockDomainEvent extends DomainEvent {
  constructor(public readonly candidateId: string) {
    super();
  }

  getEventName(): string {
    return "MockDomainEvent";
  }
}

describe("Candidate Entity State Machine", () => {
  it("should construct a candidate correctly", () => {
    const candidate = new Candidate(
      "cand-123",
      "org-456",
      "Alice Smith",
      "alice@example.com",
      "applied",
      "+15551234",
      ["React", "Node"],
      3,
      "https://supabase.co/resume.pdf",
      "React developer"
    );

    expect(candidate.id).toBe("cand-123");
    expect(candidate.orgId).toBe("org-456");
    expect(candidate.name).toBe("Alice Smith");
    expect(candidate.email).toBe("alice@example.com");
    expect(candidate.status).toBe("applied");
    expect(candidate.phone).toBe("+15551234");
    expect(candidate.skills).toEqual(["React", "Node"]);
    expect(candidate.experienceYears).toBe(3);
    expect(candidate.resumeUrl).toBe("https://supabase.co/resume.pdf");
    expect(candidate.resumeSummary).toBe("React developer");
    expect(candidate.getEvents()).toEqual([]);
  });

  it("should record, retrieve, and clear domain events", () => {
    const candidate = new Candidate("cand-123", "org-456", "Alice Smith", "alice@example.com", "applied");
    const event = new MockDomainEvent("cand-123");
    
    candidate.addEvent(event);
    expect(candidate.getEvents()).toHaveLength(1);
    expect(candidate.getEvents()[0]).toBe(event);

    candidate.clearEvents();
    expect(candidate.getEvents()).toHaveLength(0);
  });

  it("should transition states along valid workflow paths", () => {
    const candidate = new Candidate("cand-123", "org-456", "Alice Smith", "alice@example.com", "applied");

    // applied -> resume_imported
    candidate.transitionTo("resume_imported");
    expect(candidate.status).toBe("resume_imported");

    // resume_imported -> resume_parsed
    candidate.transitionTo("resume_parsed");
    expect(candidate.status).toBe("resume_parsed");

    // resume_parsed -> jd_matched
    candidate.transitionTo("jd_matched");
    expect(candidate.status).toBe("jd_matched");

    // jd_matched -> shortlisted
    candidate.transitionTo("shortlisted");
    expect(candidate.status).toBe("shortlisted");

    // shortlisted -> interview_assigned
    candidate.transitionTo("interview_assigned");
    expect(candidate.status).toBe("interview_assigned");

    // interview_assigned -> interview_scheduled
    candidate.transitionTo("interview_scheduled");
    expect(candidate.status).toBe("interview_scheduled");

    // interview_scheduled -> invitation_sent
    candidate.transitionTo("invitation_sent");
    expect(candidate.status).toBe("invitation_sent");

    // invitation_sent -> interview_started
    candidate.transitionTo("interview_started");
    expect(candidate.status).toBe("interview_started");

    // interview_started -> interview_running
    candidate.transitionTo("interview_running");
    expect(candidate.status).toBe("interview_running");

    // interview_running -> evaluation_processing
    candidate.transitionTo("evaluation_processing");
    expect(candidate.status).toBe("evaluation_processing");

    // evaluation_processing -> recruiter_review
    candidate.transitionTo("recruiter_review");
    expect(candidate.status).toBe("recruiter_review");

    // recruiter_review -> hiring_decision
    candidate.transitionTo("hiring_decision");
    expect(candidate.status).toBe("hiring_decision");

    // hiring_decision -> archived
    candidate.transitionTo("archived");
    expect(candidate.status).toBe("archived");
  });

  it("should allow transitioning from archived back to applied/imported/parsed", () => {
    const candidate = new Candidate("cand-123", "org-456", "Alice", "alice@example.com", "archived");
    
    candidate.transitionTo("applied");
    expect(candidate.status).toBe("applied");

    candidate.transitionTo("archived");
    candidate.transitionTo("resume_imported");
    expect(candidate.status).toBe("resume_imported");

    candidate.transitionTo("resume_parsed"); // allowed transition for testing
  });

  it("should throw an error for invalid state transitions", () => {
    const candidate = new Candidate("cand-123", "org-456", "Alice Smith", "alice@example.com", "applied");
    
    expect(() => {
      candidate.transitionTo("hiring_decision");
    }).toThrow("Invalid candidate workflow transition from 'applied' to 'hiring_decision'");
  });
});
