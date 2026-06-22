import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LiveInterviewDTO = {
  id: string;
  candidateName: string;
  candidateEmail: string;
  role: string;
  personaName: string;
  scheduledAt: string | null;
  durationMinutes: number;
  status: string;
  sessionId: string | null;
};

export type MonitorTurn = {
  id: string;
  who: "AI" | "Candidate";
  text: string;
  at: string;
};

export type MonitorEvent = {
  id: string;
  type: string;
  payload: string | null;
  at: string;
};

export type MonitorSessionDTO = {
  interview: LiveInterviewDTO;
  session: { id: string; startedAt: string | null; endedAt: string | null } | null;
  turns: MonitorTurn[];
  events: MonitorEvent[];
};

export type RecordedSessionDTO = {
  id: string;
  interviewId: string;
  candidateName: string;
  role: string;
  personaName: string;
  durationSec: number;
  scheduledAt: string | null;
  score: number | null;
};

type IvRow = {
  id: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
  status: string;
  overall_score: number | string | null;
  candidates: { full_name: string; email: string; role_applied: string | null } | null;
  personas: { name: string } | null;
};

function liveFromRow(r: IvRow, sessionId: string | null = null): LiveInterviewDTO {
  return {
    id: r.id,
    candidateName: r.candidates?.full_name ?? "Candidate",
    candidateEmail: r.candidates?.email ?? "",
    role: r.candidates?.role_applied ?? "Interview",
    personaName: r.personas?.name ?? "AI Interviewer",
    scheduledAt: r.scheduled_at,
    durationMinutes: r.duration_minutes ?? 45,
    status: r.status,
    sessionId,
  };
}

export const listLiveInterviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const now = new Date();
    const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const { data, error } = await context.supabase
      .from("interviews")
      .select(
        "id, scheduled_at, duration_minutes, status, overall_score, candidates(full_name, email, role_applied), personas(name)",
      )
      .is("deleted_at", null)
      .in("status", ["scheduled", "in_progress"])
      .lte("scheduled_at", horizon.toISOString())
      .order("scheduled_at", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as IvRow[];
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const { data: sessions } = await context.supabase
      .from("interview_sessions")
      .select("id, interview_id")
      .in("interview_id", ids);
    const sessByIv = new Map<string, string>();
    (sessions ?? []).forEach((s: { id: string; interview_id: string }) =>
      sessByIv.set(s.interview_id, s.id),
    );
    return rows.map((r) => liveFromRow(r, sessByIv.get(r.id) ?? null));
  });

export const getMonitorSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ interviewId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: iv, error } = await context.supabase
      .from("interviews")
      .select(
        "id, scheduled_at, duration_minutes, status, overall_score, candidates(full_name, email, role_applied), personas(name)",
      )
      .eq("id", data.interviewId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!iv) throw new Error("Interview not found");
    const { data: sess } = await context.supabase
      .from("interview_sessions")
      .select("id, started_at, ended_at")
      .eq("interview_id", data.interviewId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sessionId = sess?.id ?? null;
    const interview = liveFromRow(iv as unknown as IvRow, sessionId);
    let turns: MonitorTurn[] = [];
    let events: MonitorEvent[] = [];
    if (sessionId) {
      const [{ data: tRows }, { data: eRows }] = await Promise.all([
        context.supabase
          .from("interview_turns")
          .select("id, speaker, text, created_at, started_at")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true }),
        context.supabase
          .from("interview_events")
          .select("id, type, payload, at")
          .eq("session_id", sessionId)
          .order("at", { ascending: true }),
      ]);
      turns = (
        (tRows ?? []) as {
          id: string;
          speaker: string | null;
          text: string | null;
          created_at: string;
          started_at: string | null;
        }[]
      ).map((t) => ({
        id: t.id,
        who: t.speaker === "candidate" ? "Candidate" : "AI",
        text: t.text ?? "",
        at: t.started_at ?? t.created_at,
      }));
      events = ((eRows ?? []) as { id: string; type: string; payload: unknown; at: string }[]).map(
        (e) => ({
          id: e.id,
          type: e.type,
          payload: e.payload == null ? null : JSON.stringify(e.payload),
          at: e.at,
        }),
      );
    }
    return {
      interview,
      session: sess
        ? { id: sess.id, startedAt: sess.started_at ?? null, endedAt: sess.ended_at ?? null }
        : null,
      turns,
      events,
    } satisfies MonitorSessionDTO;
  });

export const listRecordedSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("interviews")
      .select(
        "id, scheduled_at, duration_minutes, status, overall_score, candidates(full_name, email, role_applied), personas(name)",
      )
      .is("deleted_at", null)
      .in("status", ["completed", "evaluation_pending"])
      .order("scheduled_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as IvRow[];
    if (rows.length === 0) return [] as RecordedSessionDTO[];
    const ids = rows.map((r) => r.id);
    const { data: sessions } = await context.supabase
      .from("interview_sessions")
      .select("id, interview_id, started_at, ended_at")
      .in("interview_id", ids);
    const sessByIv = new Map<string, { id: string; durationSec: number }>();
    (sessions ?? []).forEach(
      (s: {
        id: string;
        interview_id: string;
        started_at: string | null;
        ends?: string;
        ended_at: string | null;
      }) => {
        const start = s.started_at ? new Date(s.started_at).getTime() : 0;
        const end = s.ended_at ? new Date(s.ended_at).getTime() : 0;
        const sec = end > start ? Math.round((end - start) / 1000) : 0;
        sessByIv.set(s.interview_id, { id: s.id, durationSec: sec });
      },
    );
    return rows.map((r) => {
      const s = sessByIv.get(r.id);
      return {
        id: s?.id ?? r.id,
        interviewId: r.id,
        candidateName: r.candidates?.full_name ?? "Candidate",
        role: r.candidates?.role_applied ?? "Interview",
        personaName: r.personas?.name ?? "AI Interviewer",
        durationSec: s?.durationSec ?? (r.duration_minutes ?? 45) * 60,
        scheduledAt: r.scheduled_at,
        score:
          r.overall_score === null || r.overall_score === undefined
            ? null
            : Number(r.overall_score),
      } satisfies RecordedSessionDTO;
    });
  });

export const flagSessionEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        note: z.string().trim().min(1).max(1000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("interview_events").insert({
      session_id: data.sessionId,
      type: "manual_flag",
      payload: { note: data.note, flagged_by: context.userId } as never,
    });
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });
