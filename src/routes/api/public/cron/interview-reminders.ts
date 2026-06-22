import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron-triggered endpoint that queues interview reminder emails (24h + 1h before
 * scheduled_at) into notification_outbox, and marks long-overdue invitations
 * as expired. Auth: Supabase anon key in `apikey` header (matches /api/public/* pattern).
 *
 * Template variables for `interview_reminder` payload:
 *   - candidateName, role, personaName, scheduledAt (ISO), durationMinutes
 *   - joinUrl, when ("24h" | "1h"), interviewId
 */

type IvRow = {
  id: string;
  email: string | null;
  token: string;
  org_id: string | null;
  status: string;
  interview_id: string;
  interview: {
    id: string;
    scheduled_at: string | null;
    duration_minutes: number | null;
    candidates: { full_name: string | null; role_applied: string | null } | null;
    personas: { name: string | null } | null;
  } | null;
};

export const Route = createFileRoute("/api/public/cron/interview-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Verify Supabase anon key (cron passes it via `apikey` header).
        const apikey = request.headers.get("apikey") ?? request.headers.get("x-api-key");
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ||
          process.env.SUPABASE_ANON_KEY ||
          "";
        if (!apikey || !expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const now = Date.now();
        const horizonStart = new Date(now - 5 * 60_000).toISOString();
        const horizonEnd = new Date(now + 26 * 60 * 60_000).toISOString();

        // Pull candidate invitations with a scheduled interview in the next 26h
        const { data: rows, error } = await supabaseAdmin
          .from("interview_invitations")
          .select(
            `id, email, token, org_id, status, interview_id,
             interview:interviews!inner(
               id, scheduled_at, duration_minutes,
               candidates(full_name, role_applied),
               personas(name)
             )`,
          )
          .in("status", ["pending", "sent", "opened"])
          .gte("interview.scheduled_at", horizonStart)
          .lte("interview.scheduled_at", horizonEnd);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        const origin = new URL(request.url).origin;
        const queued: Array<{ id: string; when: "24h" | "1h" }> = [];

        for (const r of (rows ?? []) as unknown as IvRow[]) {
          if (!r.interview?.scheduled_at || !r.email || !r.org_id) continue;
          const schedMs = new Date(r.interview.scheduled_at).getTime();
          const minsUntil = (schedMs - now) / 60_000;

          // Window targeting: 24h (between 23h45 and 24h05) and 1h (between 55min and 65min)
          const want: "24h" | "1h" | null =
            minsUntil > 24 * 60 - 5 && minsUntil < 24 * 60 + 5
              ? "24h"
              : minsUntil > 55 && minsUntil < 65
                ? "1h"
                : null;
          if (!want) continue;

          // De-dupe: skip if a reminder for this interview/window was already queued
          const { data: existing } = await supabaseAdmin
            .from("notification_outbox")
            .select("id")
            .eq("kind", "interview_reminder")
            .eq("recipient_email", r.email)
            .contains("payload", { interviewId: r.interview_id, when: want })
            .maybeSingle();
          if (existing) continue;

          await supabaseAdmin.from("notification_outbox").insert({
            org_id: r.org_id,
            kind: "interview_reminder",
            recipient_email: r.email,
            payload: {
              interviewId: r.interview_id,
              candidateName: r.interview.candidates?.full_name ?? "Candidate",
              role: r.interview.candidates?.role_applied ?? "your interview",
              personaName: r.interview.personas?.name ?? "AI Interviewer",
              scheduledAt: r.interview.scheduled_at,
              durationMinutes: r.interview.duration_minutes ?? 45,
              joinUrl: `${origin}/join/${r.token}`,
              when: want,
            } as never,
          });
          queued.push({ id: r.id, when: want });
        }

        // Expire invitations whose window has fully closed (>2h past scheduled_at + duration)
        const expiredCutoff = new Date(now - 2 * 60 * 60_000).toISOString();
        const { data: expirable } = await supabaseAdmin
          .from("interview_invitations")
          .select("id, interview:interviews!inner(scheduled_at, duration_minutes)")
          .in("status", ["pending", "sent", "opened"])
          .lt("interview.scheduled_at", expiredCutoff);

        const expiredIds: string[] = [];
        for (const row of (expirable ?? []) as Array<{
          id: string;
          interview: { scheduled_at: string | null; duration_minutes: number | null } | null;
        }>) {
          const sa = row.interview?.scheduled_at;
          if (!sa) continue;
          const endMs = new Date(sa).getTime() + (row.interview?.duration_minutes ?? 45) * 60_000;
          if (now > endMs + 30 * 60_000) expiredIds.push(row.id);
        }
        if (expiredIds.length > 0) {
          await supabaseAdmin
            .from("interview_invitations")
            .update({ status: "expired" })
            .in("id", expiredIds);
        }

        return new Response(
          JSON.stringify({
            ok: true,
            queued,
            expired: expiredIds.length,
          }),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
