import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DashboardCandidate = {
  id: string;
  name: string;
  role: string;
  score: number;
  status: string;
  avatar: string;
};

export type DashboardInterview = {
  id: string;
  candidateName: string;
  role: string;
  scheduledAt: string | null;
  status: string;
};

export type RecruiterDashboardDTO = {
  pipelineCount: number;
  interviewsThisWeek: number;
  evaluatedCount: number;
  liveOrScheduledCount: number;
  todaysInterviews: DashboardInterview[];
  topCandidates: DashboardCandidate[];
};

function initials(n: string): string {
  return n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export const getRecruiterDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const weekFrom = new Date(); weekFrom.setHours(0, 0, 0, 0); weekFrom.setDate(weekFrom.getDate() - weekFrom.getDay());
    const weekTo = new Date(weekFrom); weekTo.setDate(weekTo.getDate() + 7);

    const [{ data: cands }, { data: ivs }, { data: tops }] = await Promise.all([
      context.supabase.from("candidates")
        .select("id, status")
        .is("deleted_at", null),
      context.supabase.from("interviews")
        .select("id, scheduled_at, status, candidates(full_name, role_applied)")
        .is("deleted_at", null)
        .gte("scheduled_at", weekFrom.toISOString())
        .lt("scheduled_at", weekTo.toISOString())
        .order("scheduled_at", { ascending: true }),
      context.supabase.from("candidates")
        .select("id, full_name, role_applied, ai_score, status")
        .is("deleted_at", null)
        .order("ai_score", { ascending: false, nullsFirst: false })
        .limit(5),
    ]);

    const pipelineCount = cands?.length ?? 0;
    const evaluatedCount = (cands ?? []).filter((c: { status: string }) =>
      c.status === "evaluated" || c.status === "offer" || c.status === "hired",
    ).length;
    const interviewsThisWeek = ivs?.length ?? 0;
    const liveOrScheduledCount = (ivs ?? []).filter((i: { status: string }) =>
      i.status === "scheduled" || i.status === "in_progress",
    ).length;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const todaysInterviews: DashboardInterview[] = (ivs ?? [])
      .filter((i: { scheduled_at: string | null }) =>
        i.scheduled_at && new Date(i.scheduled_at) >= today && new Date(i.scheduled_at) < tomorrow)
      .map((i: { id: string; scheduled_at: string | null; status: string; candidates: { full_name: string; role_applied: string | null } | null }) => ({
        id: i.id,
        candidateName: i.candidates?.full_name ?? "Candidate",
        role: i.candidates?.role_applied ?? "—",
        scheduledAt: i.scheduled_at,
        status: i.status,
      }));

    const topCandidates: DashboardCandidate[] = ((tops ?? []) as { id: string; full_name: string; role_applied: string | null; ai_score: number | string | null; status: string }[])
      .map((c) => ({
        id: c.id,
        name: c.full_name,
        role: c.role_applied ?? "—",
        score: c.ai_score === null ? 0 : Number(c.ai_score),
        status: c.status,
        avatar: initials(c.full_name),
      }));

    return {
      pipelineCount,
      interviewsThisWeek,
      evaluatedCount,
      liveOrScheduledCount,
      todaysInterviews,
      topCandidates,
    } satisfies RecruiterDashboardDTO;
  });
