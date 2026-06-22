import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WindowState = "too_early" | "open" | "closed" | "cancelled";

export type InvitationLookup = {
  status: string;
  windowState: WindowState;
  interview: {
    id: string;
    candidateName: string;
    role: string;
    personaName: string;
    scheduledAt: string | null;
    durationMinutes: number;
    status: string;
  };
  email: string;
};

function computeWindow(
  scheduledAt: string | null,
  durationMinutes: number,
  status: string,
): WindowState {
  if (status === "cancelled") return "cancelled";
  if (!scheduledAt) return "open"; // ad-hoc interviews can join any time
  const start = new Date(scheduledAt).getTime();
  const end = start + durationMinutes * 60_000;
  const now = Date.now();
  if (now < start - 10 * 60_000) return "too_early";
  if (now > end + 30 * 60_000) return "closed";
  return "open";
}

// ---------- Public token validation (no auth) ----------
export const validateInvitationToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<InvitationLookup | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Cheap rate limit by token prefix
    try {
      await supabaseAdmin.rpc("check_rate_limit", {
        _key: `invite-validate:${data.token.slice(0, 8)}`,
        _max: 30,
        _window_seconds: 60,
      });
    } catch {
      /* non-fatal */
    }

    const { data: row } = await supabaseAdmin
      .from("interview_invitations")
      .select("id, status, email, interview_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!row) return null;

    const { data: iv } = await supabaseAdmin
      .from("interviews")
      .select(
        "id, scheduled_at, duration_minutes, status, candidates(full_name, role_applied), personas(name)",
      )
      .eq("id", row.interview_id)
      .maybeSingle();
    if (!iv) return null;

    const ivRow = iv as unknown as {
      id: string;
      scheduled_at: string | null;
      duration_minutes: number | null;
      status: string;
      candidates: { full_name: string; role_applied: string | null } | null;
      personas: { name: string } | null;
    };

    // Mark opened (best-effort)
    if (row.status === "pending" || row.status === "sent") {
      await supabaseAdmin
        .from("interview_invitations")
        .update({ status: "opened", opened_at: new Date().toISOString() })
        .eq("id", row.id);
    }

    const duration = ivRow.duration_minutes ?? 45;
    return {
      status: row.status,
      windowState: computeWindow(ivRow.scheduled_at, duration, ivRow.status),
      interview: {
        id: ivRow.id,
        candidateName: ivRow.candidates?.full_name ?? "Candidate",
        role: ivRow.candidates?.role_applied ?? "—",
        personaName: ivRow.personas?.name ?? "AI Interviewer",
        scheduledAt: ivRow.scheduled_at,
        durationMinutes: duration,
        status: ivRow.status,
      },
      email: row.email ?? "",
    };
  });

// ---------- Claim invitation (auth required) ----------
export const claimInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("claim_invitation_for_user", {
      _token: data.token,
    });
    if (error) throw new Error(error.message);
    const first = (rows as Array<{ interview_id: string; status: string }> | null)?.[0];
    if (!first) throw new Error("Could not claim invitation");
    return { interviewId: first.interview_id } as const;
  });

// ---------- Recruiter: create / resend invitation ----------
async function createOrRefreshInvitation(interviewId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: iv, error } = await supabaseAdmin
    .from("interviews")
    .select(
      "id, org_id, candidate_id, scheduled_at, duration_minutes, candidates(email, full_name)",
    )
    .eq("id", interviewId)
    .maybeSingle();
  if (error) throw error;
  if (!iv) throw new Error("Interview not found");
  const interview = iv as unknown as {
    id: string;
    org_id: string | null;
    candidate_id: string;
    scheduled_at: string | null;
    duration_minutes: number | null;
    candidates: { email: string; full_name: string } | null;
  };
  if (!interview.candidates?.email) throw new Error("Candidate has no email on file");

  // Expire 7d after scheduled_at, fallback 30d from now
  const baseMs = interview.scheduled_at ? new Date(interview.scheduled_at).getTime() : Date.now();
  const expiresAt = new Date(baseMs + 7 * 24 * 3600 * 1000).toISOString();

  // Reuse existing row if present
  const { data: existing } = await supabaseAdmin
    .from("interview_invitations")
    .select("id, token")
    .eq("interview_id", interviewId)
    .maybeSingle();

  if (existing) {
    await supabaseAdmin
      .from("interview_invitations")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        expires_at: expiresAt,
        email: interview.candidates.email,
        org_id: interview.org_id,
        candidate_id: interview.candidate_id,
      })
      .eq("id", existing.id);

    await supabaseAdmin.from("notification_outbox").insert({
      org_id: interview.org_id as string,
      kind: "interview_invite",
      recipient_email: interview.candidates.email,
      payload: {
        interviewId,
        candidateName: interview.candidates.full_name,
        scheduledAt: interview.scheduled_at,
        joinUrl: `/join/${existing.token}`,
        resent: true,
      } as never,
    });

    return { token: existing.token as string, email: interview.candidates.email as string };
  }

  // create new
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("interview_invitations")
    .insert({
      interview_id: interviewId,
      candidate_id: interview.candidate_id,
      org_id: interview.org_id,
      email: interview.candidates.email,
      candidate_token_hash: crypto.randomUUID(), // legacy NOT NULL column
      expires_at: expiresAt,
      status: "sent",
      sent_at: new Date().toISOString(),
    })
    .select("id, token")
    .single();
  if (insErr) throw insErr;

  await supabaseAdmin.from("notification_outbox").insert({
    org_id: interview.org_id as string,
    kind: "interview_invite",
    recipient_email: interview.candidates.email,
    payload: {
      interviewId,
      candidateName: interview.candidates.full_name,
      scheduledAt: interview.scheduled_at,
      joinUrl: `/join/${inserted.token}`,
      createdBy: userId,
    } as never,
  });

  return { token: inserted.token as string, email: interview.candidates.email as string };
}

export const createInterviewInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ interviewId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    return await createOrRefreshInvitation(data.interviewId, context.userId);
  });

export const resendInterviewInvitation = createInterviewInvitation;

// ---------- Recruiter: get share URL ----------
export const getInvitationLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ interviewId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("interview_invitations")
      .select("token, email, status")
      .eq("interview_id", data.interviewId)
      .maybeSingle();
    if (row?.token) {
      return { token: row.token as string, email: row.email ?? "", status: row.status as string };
    }
    // No invite yet → create on demand
    const fresh = await createOrRefreshInvitation(data.interviewId, context.userId);
    return { token: fresh.token, email: fresh.email, status: "sent" };
  });
