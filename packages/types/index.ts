import { z } from "zod";

// ---------- Candidate Workflow Status Enum ----------
export type CandidateStatus =
  | "new"
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

export const CandidateStatusList: CandidateStatus[] = [
  "new",
  "applied",
  "resume_imported",
  "resume_parsed",
  "jd_matched",
  "shortlisted",
  "interview_assigned",
  "interview_scheduled",
  "invitation_sent",
  "interview_started",
  "interview_running",
  "evaluation_processing",
  "recruiter_review",
  "hiring_decision",
  "archived",
];

// ---------- Input validation schemas (shared) ----------
export const createCandidateInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional().nullable(),
  role: z.string().trim().min(1).max(120),
  status: z.string().default("new"),
  experienceYears: z.number().min(0).max(60).default(0),
  skills: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
  notes: z.string().trim().max(2000).optional().nullable(),
  sendWelcome: z.boolean().default(true),
  jobId: z.string().uuid().optional().nullable(),
  customRole: z.any().optional().nullable(),
  resumeAnalysis: z.any().optional().nullable(),
});

export type CreateCandidateInput = z.infer<typeof createCandidateInputSchema>;
