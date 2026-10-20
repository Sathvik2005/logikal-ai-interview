// Shared mock data + helpers for the recruiter module (Phase 2).
// Real DB-backed data layer is wired through @/integrations/supabase/client;
// these mocks fill the demo gaps for screens that aren't backed by tables yet
// (question banks, live monitor stream, analytics aggregates).

export type Candidate = {
  id: string;
  name: string;
  email: string;
  role: string;
  status:
    | "new"
    | "screening"
    | "interviewing"
    | "evaluated"
    | "offer"
    | "hired"
    | "rejected"
    | "archived";
  score: number;
  avatar: string;
  appliedAt: string;
  skills: string[];
  experienceYears: number;
};

export type RecordingTurn = { t: number; who: "AI" | "Candidate"; text: string };

export type Recording = {
  durationSec: number;
  transcript: RecordingTurn[];
};

export type Interview = {
  id: string;
  candidateId: string;
  candidateName: string;
  role: string;
  scheduledAt: string;
  durationMin: number;
  persona: string;
  status: "scheduled" | "live" | "completed" | "cancelled";
  score?: number;
  recording?: Recording;
  jobId?: string | null;
  personaId?: string | null;
  questionIds?: string[];
  customQuestions?: string[];
};

export const MOCK_CANDIDATES: Candidate[] = [
  {
    id: "c1",
    name: "Sarah Jenkins",
    email: "sarah.j@example.com",
    role: "Senior Software Engineer",
    status: "evaluated",
    score: 92,
    avatar: "SJ",
    appliedAt: "2026-05-28",
    skills: ["TypeScript", "React", "AWS", "System Design"],
    experienceYears: 7,
  },
  {
    id: "c2",
    name: "Marcus Chen",
    email: "m.chen@example.com",
    role: "Product Manager",
    status: "interviewing",
    score: 84,
    avatar: "MC",
    appliedAt: "2026-05-30",
    skills: ["Roadmapping", "Analytics", "Stakeholder Mgmt"],
    experienceYears: 5,
  },
  {
    id: "c3",
    name: "Priya Patel",
    email: "priya.p@example.com",
    role: "Data Scientist",
    status: "screening",
    score: 78,
    avatar: "PP",
    appliedAt: "2026-06-01",
    skills: ["Python", "ML", "SQL"],
    experienceYears: 4,
  },
  {
    id: "c4",
    name: "James O'Brien",
    email: "j.obrien@example.com",
    role: "DevOps Engineer",
    status: "new",
    score: 0,
    avatar: "JO",
    appliedAt: "2026-06-03",
    skills: ["Kubernetes", "Terraform", "CI/CD"],
    experienceYears: 6,
  },
  {
    id: "c5",
    name: "Aisha Khan",
    email: "aisha.k@example.com",
    role: "Senior Software Engineer",
    status: "offer",
    score: 95,
    avatar: "AK",
    appliedAt: "2026-05-20",
    skills: ["Go", "Distributed Systems", "Kafka"],
    experienceYears: 8,
  },
  {
    id: "c6",
    name: "Diego Ramirez",
    email: "d.ramirez@example.com",
    role: "UX Designer",
    status: "rejected",
    score: 62,
    avatar: "DR",
    appliedAt: "2026-05-22",
    skills: ["Figma", "User Research"],
    experienceYears: 3,
  },
];

export const MOCK_INTERVIEWS: Interview[] = [
  {
    id: "i1",
    candidateId: "c1",
    candidateName: "Sarah Jenkins",
    role: "Senior Software Engineer",
    scheduledAt: "2026-06-05T14:00:00Z",
    durationMin: 60,
    persona: "Principal Engineer",
    status: "live",
    score: undefined,
  },
  {
    id: "i2",
    candidateId: "c2",
    candidateName: "Marcus Chen",
    role: "Product Manager",
    scheduledAt: "2026-06-05T16:30:00Z",
    durationMin: 45,
    persona: "Product Director",
    status: "scheduled",
  },
  {
    id: "i3",
    candidateId: "c3",
    candidateName: "Priya Patel",
    role: "Data Scientist",
    scheduledAt: "2026-06-06T10:00:00Z",
    durationMin: 60,
    persona: "ML Tech Lead",
    status: "scheduled",
  },
  {
    id: "i4",
    candidateId: "c5",
    candidateName: "Aisha Khan",
    role: "Senior Software Engineer",
    scheduledAt: "2026-06-04T11:00:00Z",
    durationMin: 60,
    persona: "Principal Engineer",
    status: "completed",
    score: 95,
    recording: {
      durationSec: 1820,
      transcript: [
        {
          t: 4,
          who: "AI",
          text: "Welcome Aisha. Walk me through a distributed system you've designed end-to-end.",
        },
        {
          t: 22,
          who: "Candidate",
          text: "Sure — at my last role I designed an event-driven payments ledger on Kafka serving ~40k TPS.",
        },
        { t: 95, who: "AI", text: "How did you ensure exactly-once semantics across consumers?" },
        {
          t: 118,
          who: "Candidate",
          text: "We used idempotency keys plus a transactional outbox; the consumer side dedupes via a Redis-backed seen-set.",
        },
        {
          t: 240,
          who: "AI",
          text: "What was your failure mode the day the outbox table grew unbounded?",
        },
        {
          t: 268,
          who: "Candidate",
          text: "We added partitioned archival and a back-pressure signal to the producers; latency stayed under 200ms p99.",
        },
        { t: 520, who: "AI", text: "Last question — what would you redesign today?" },
        {
          t: 548,
          who: "Candidate",
          text: "I'd lean on a managed CDC pipeline instead of the hand-rolled outbox; the operational burden wasn't worth it.",
        },
      ],
    },
  },
  {
    id: "i5",
    candidateId: "c6",
    candidateName: "Diego Ramirez",
    role: "UX Designer",
    scheduledAt: "2026-06-03T13:00:00Z",
    durationMin: 45,
    persona: "Design Lead",
    status: "completed",
    score: 62,
    recording: {
      durationSec: 1410,
      transcript: [
        { t: 3, who: "AI", text: "Hi Diego — tell me about a recent project you're proud of." },
        {
          t: 18,
          who: "Candidate",
          text: "I redesigned the onboarding flow for a fintech app, lifting activation by 18%.",
        },
        {
          t: 120,
          who: "AI",
          text: "How did you measure activation, and what did you change first?",
        },
        {
          t: 142,
          who: "Candidate",
          text: "Activation = funded account within 7 days. We cut the KYC step from 6 screens to 2.",
        },
        {
          t: 360,
          who: "AI",
          text: "Walk me through how you handled a stakeholder who disagreed with the simplification.",
        },
        {
          t: 388,
          who: "Candidate",
          text: "I ran a moderated test with 8 users; the data settled the debate.",
        },
        { t: 780, who: "AI", text: "What's the design tradeoff you regret most?" },
        {
          t: 802,
          who: "Candidate",
          text: "Dropping the progress indicator — users felt lost; we shipped a fix the next sprint.",
        },
      ],
    },
  },
];

export const STATUS_TONE: Record<Candidate["status"], string> = {
  new: "bg-surface-container-high text-on-surface-variant",
  screening: "bg-secondary-fixed text-on-secondary-fixed-variant",
  interviewing: "bg-primary-fixed text-on-primary-fixed-variant",
  evaluated: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
  offer: "bg-secondary-container text-on-secondary-container",
  hired: "bg-secondary-container text-on-secondary-container",
  rejected: "bg-error-container text-on-error-container",
  archived: "bg-surface-container-high text-on-surface-variant",
};

export function scoreColor(score: number): string {
  if (score >= 85) return "text-secondary";
  if (score >= 70) return "text-primary";
  if (score >= 50) return "text-tertiary";
  return "text-error";
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
