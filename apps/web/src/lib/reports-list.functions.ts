import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";

export type ReportListItem = {
  id: string;
  candidateName: string;
  role: string;
  personaName: string;
  scheduledAt: string | null;
  durationMinutes: number;
  score: number | null;
  integrityScore: number | null;
  recommendation: string | null;
  status: string | null;
  recruiterName: string;
  recruiterEmail: string;
  scores: {
    technical?: number;
    behavioral?: number;
    communication?: number;
    confidence?: number;
    knowledge?: number;
  } | null;
  integrityTimeline: Array<{ type: string; at: string; payload?: any }> | null;
};

function getBackendUrl(): string {
  return process.env.BACKEND_URL || "http://localhost:3000";
}

function getAuthHeader(): Record<string, string> {
  const request = getRequest();
  const auth = request?.headers?.get("authorization");
  return auth ? { Authorization: auth } : {};
}

export const listReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const res = await fetch(`${getBackendUrl()}/api/reports`, {
      headers: {
        ...getAuthHeader(),
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to list reports: ${res.statusText}`);
    }

    const rows = (await res.json()) as any[];
    return rows.map((r) => {
      const interview = r.interview ?? {};
      const candidate = interview.candidate ?? {};
      const job = interview.job ?? {};
      return {
        id: interview.id || r.interview_id,
        candidateName: candidate.full_name || "Candidate",
        role: candidate.role_applied || job.title || "—",
        personaName: "AI Interviewer",
        scheduledAt: interview.scheduled_at,
        durationMinutes: interview.duration_minutes ?? 45,
        score: interview.overall_score ? Number(interview.overall_score) : null,
        integrityScore: interview.integrity_score ? Number(interview.integrity_score) : null,
        recommendation: interview.recommendation,
        status: interview.status,
        recruiterName: "Recruiter",
        recruiterEmail: "",
        scores: r.scores || null,
        integrityTimeline: r.integrity_timeline || null,
      } satisfies ReportListItem;
    });
  });
