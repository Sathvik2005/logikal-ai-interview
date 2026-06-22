import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type InterviewExtras = {
  personaName: string | null;
  jobTitle: string | null;
  curatedQuestionCount: number;
};

async function enrichInterview(supabase: { from: (t: string) => unknown }, base: Record<string, unknown>): Promise<Record<string, unknown> & InterviewExtras> {
  const personaId = base.persona_id as string | null | undefined;
  const jobId = base.job_id as string | null | undefined;
  const interviewId = base.id as string;

  const [{ data: persona }, { data: job }, { count }] = await Promise.all([
    personaId
      ? (supabase.from("personas") as { select: (s: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { name: string } | null }> } } })
          .select("name").eq("id", personaId).maybeSingle()
      : Promise.resolve({ data: null }),
    jobId
      ? (supabase.from("job_descriptions") as { select: (s: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { title: string } | null }> } } })
          .select("title").eq("id", jobId).maybeSingle()
      : Promise.resolve({ data: null }),
    (supabase.from("interview_questions") as { select: (s: string, o: { count: "exact"; head: true }) => { eq: (k: string, v: string) => Promise<{ count: number | null }> } })
      .select("question_id", { count: "exact", head: true }).eq("interview_id", interviewId),
  ]);

  return {
    ...base,
    personaName: (persona as { name: string } | null)?.name ?? null,
    jobTitle: (job as { title: string } | null)?.title ?? null,
    curatedQuestionCount: count ?? 0,
  };
}

export type EnrichInterviewDTO = {
  id: string;
  status: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
  persona_id: string | null;
  job_id: string | null;
  personaName: string | null;
  jobTitle: string | null;
  curatedQuestionCount: number;
  candidate: { id: string; full_name: string; role_applied: string | null };
};

// Resolves the most relevant interview for the signed-in candidate user.
// If interviewId is supplied, prefer that specific interview (and verify ownership).
export const getMyCandidateInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ interviewId: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<EnrichInterviewDTO | null> => {
    const { data: candidate, error: cErr } = await context.supabase
      .from("candidates")
      .select("id, full_name, role_applied")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!candidate) return null;

    if (data.interviewId) {
      const { data: specific } = await context.supabase
        .from("interviews")
        .select("id, status, scheduled_at, duration_minutes, persona_id, job_id, candidate_id")
        .eq("id", data.interviewId)
        .eq("candidate_id", candidate.id)
        .maybeSingle();
      if (specific) {
        const enriched = await enrichInterview(context.supabase as unknown as { from: (t: string) => unknown }, specific as Record<string, unknown>);
        return { ...enriched, candidate } as unknown as EnrichInterviewDTO;
      }
    }

    const { data: scheduled } = await context.supabase
      .from("interviews")
      .select("id, status, scheduled_at, duration_minutes, persona_id, job_id, candidate_id")
      .eq("candidate_id", candidate.id)
      .in("status", ["scheduled", "in_progress"])
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (scheduled) {
      const enriched = await enrichInterview(context.supabase as unknown as { from: (t: string) => unknown }, scheduled as Record<string, unknown>);
      return { ...enriched, candidate } as unknown as EnrichInterviewDTO;
    }

    const { data: latest } = await context.supabase
      .from("interviews")
      .select("id, status, scheduled_at, duration_minutes, persona_id, job_id, candidate_id")
      .eq("candidate_id", candidate.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latest) return null;
    const enriched = await enrichInterview(context.supabase as unknown as { from: (t: string) => unknown }, latest as Record<string, unknown>);
    return { ...enriched, candidate } as unknown as EnrichInterviewDTO;
  });


export type CandidateInterviewSummary = {
  id: string;
  status: string;
  scheduledAt: string | null;
  durationMinutes: number;
  role: string;
  personaName: string;
};

export const getMyUpcomingInterviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{
    upcoming: CandidateInterviewSummary[];
    past: CandidateInterviewSummary[];
  }> => {
    const { data: candidate } = await context.supabase
      .from("candidates")
      .select("id, role_applied")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!candidate) return { upcoming: [], past: [] };

    const { data: rows } = await context.supabase
      .from("interviews")
      .select("id, status, scheduled_at, duration_minutes, candidates(role_applied), personas(name)")
      .eq("candidate_id", candidate.id)
      .order("scheduled_at", { ascending: true, nullsFirst: false });

    const mapped: CandidateInterviewSummary[] = (rows ?? []).map((r) => {
      const row = r as unknown as {
        id: string;
        status: string;
        scheduled_at: string | null;
        duration_minutes: number | null;
        candidates: { role_applied: string | null } | null;
        personas: { name: string } | null;
      };
      return {
        id: row.id,
        status: row.status,
        scheduledAt: row.scheduled_at,
        durationMinutes: row.duration_minutes ?? 45,
        role: row.candidates?.role_applied ?? "—",
        personaName: row.personas?.name ?? "AI Interviewer",
      };
    });

    const upcoming = mapped.filter((m) => m.status === "scheduled" || m.status === "in_progress");
    const past = mapped.filter((m) => m.status !== "scheduled" && m.status !== "in_progress");
    return { upcoming, past };
  });
