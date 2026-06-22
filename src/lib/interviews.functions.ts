import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- DTOs ----------
export type InterviewStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show"
  | "evaluation_pending";

export type InterviewDTO = {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  jobId: string | null;
  personaId: string | null;
  scheduledAt: string | null;
  durationMinutes: number;
  status: InterviewStatus;
  recruiterId: string | null;
};

type Row = {
  id: string;
  candidate_id: string;
  job_id: string | null;
  persona_id: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  status: InterviewStatus;
  recruiter_id: string | null;
  candidates?: { full_name: string; email: string } | null;
};

function mapRow(r: Row): InterviewDTO {
  return {
    id: r.id,
    candidateId: r.candidate_id,
    candidateName: r.candidates?.full_name ?? "",
    candidateEmail: r.candidates?.email ?? "",
    jobId: r.job_id,
    personaId: r.persona_id,
    scheduledAt: r.scheduled_at,
    durationMinutes: r.duration_minutes ?? 45,
    status: r.status,
    recruiterId: r.recruiter_id,
  };
}

function isOverlapError(err: unknown): boolean {
  const m = (err as { message?: string; code?: string } | null)?.message ?? "";
  const code = (err as { code?: string } | null)?.code ?? "";
  return code === "23P01" || /interviews_no_(recruiter|candidate)_overlap/.test(m);
}

async function enqueueNotification(opts: {
  orgId: string;
  kind: "interview_invite" | "reschedule" | "cancel" | "reminder";
  recipientEmail: string;
  payload: Record<string, unknown>;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("notification_outbox").insert({
    org_id: opts.orgId,
    kind: opts.kind,
    recipient_email: opts.recipientEmail,
    payload: opts.payload as never,
  });

}

async function loadOrgForCandidate(candidateId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("candidates")
    .select("id, org_id, full_name, email")
    .eq("id", candidateId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.org_id) throw new Error("Candidate not found or missing org");
  return data as { id: string; org_id: string; full_name: string; email: string };
}

// ---------- list ----------
const listInput = z
  .object({
    status: z
      .enum(["scheduled", "in_progress", "completed", "cancelled", "no_show", "evaluation_pending"])
      .optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    limit: z.number().int().min(1).max(200).default(100),
  })
  .default({ limit: 100 });

export const listInterviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listInput.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("interviews")
      .select(
        "id, candidate_id, job_id, persona_id, scheduled_at, duration_minutes, status, recruiter_id, candidates ( full_name, email )",
      )
      .is("deleted_at", null)
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(data.limit);

    if (data.status) q = q.eq("status", data.status);
    if (data.from) q = q.gte("scheduled_at", data.from);
    if (data.to) q = q.lte("scheduled_at", data.to);

    const { data: rows, error } = await q;
    if (error) throw error;
    return (rows ?? []).map((r) => mapRow(r as unknown as Row));
  });

// ---------- schedule ----------
const scheduleInput = z.object({
  candidateId: z.string().uuid(),
  jobId: z.string().uuid().optional().nullable(),
  personaId: z.string().uuid().optional().nullable(),
  personaVersionId: z.string().uuid().optional().nullable(),
  questionIds: z.array(z.string().uuid()).optional(),
  customQuestions: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(240).default(45),
});

export const scheduleInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => scheduleInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const candidate = await loadOrgForCandidate(data.candidateId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // --- Cross-org ownership checks: prevent passing another org's persona/job ids
    if (data.personaId) {
      const { data: pOwn } = await supabaseAdmin
        .from("personas").select("org_id").eq("id", data.personaId).maybeSingle();
      if (!pOwn || (pOwn as { org_id: string | null }).org_id !== candidate.org_id) {
        throw new Error("Persona does not belong to this organization");
      }
    }
    if (data.jobId) {
      const { data: jOwn } = await supabaseAdmin
        .from("job_descriptions").select("org_id").eq("id", data.jobId).maybeSingle();
      if (!jOwn || (jOwn as { org_id: string | null }).org_id !== candidate.org_id) {
        throw new Error("Job does not belong to this organization");
      }
    }

    // --- Resolve persona_version_id: prefer explicit; else latest snapshot for persona;
    //     else mint one from the current personas.prompt (so historical pinning works).
    let personaVersionId: string | null = data.personaVersionId ?? null;
    if (data.personaId && !personaVersionId) {
      const { data: latest } = await supabaseAdmin
        .from("persona_versions")
        .select("id, version")
        .eq("persona_id", data.personaId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest) {
        personaVersionId = (latest as { id: string }).id;
      } else {
        const { data: persona } = await supabaseAdmin
          .from("personas").select("prompt").eq("id", data.personaId).maybeSingle();
        const sys = (persona as { prompt: string | null } | null)?.prompt ?? "";
        const { data: snap } = await supabaseAdmin
          .from("persona_versions")
          .insert({
            persona_id: data.personaId,
            org_id: candidate.org_id,
            version: 1,
            system_prompt: sys,
            rubric: {} as never,
            created_by: userId,
          })
          .select("id")
          .maybeSingle();
        personaVersionId = (snap as { id: string } | null)?.id ?? null;
      }
    }

    const { data: row, error } = await supabaseAdmin
      .from("interviews")
      .insert({
        org_id: candidate.org_id,
        created_by: userId,
        recruiter_id: userId,
        candidate_id: data.candidateId,
        job_id: data.jobId ?? null,
        persona_id: data.personaId ?? null,
        persona_version_id: personaVersionId,
        scheduled_at: data.scheduledAt,
        duration_minutes: data.durationMinutes,
        status: "scheduled",
      })
      .select(
        "id, candidate_id, job_id, persona_id, scheduled_at, duration_minutes, status, recruiter_id",
      )
      .single();

    if (error) {
      if (isOverlapError(error)) {
        throw new Error("That time conflicts with another interview for the recruiter or candidate.");
      }
      throw error;
    }

    // --- Curated question list:
    //  1) explicit questionIds and custom questions win;
    //  2) else, if persona has curated persona_questions for the pinned version, copy them;
    //  3) else, leave empty (runtime will free-style).
    let customQuestionIds: string[] = [];
    if (data.customQuestions && data.customQuestions.length > 0) {
      const inserts = data.customQuestions.map((qText) => ({
        org_id: candidate.org_id,
        created_by: userId,
        competency: "General",
        difficulty: "medium",
        type: "open",
        prompt: qText,
        expected_signals: [] as never,
      }));
      const { data: createdQ, error: createQErr } = await supabaseAdmin
        .from("questions")
        .insert(inserts)
        .select("id");
      if (createQErr) {
        console.error("[scheduleInterview] custom questions insert failed", createQErr);
        throw createQErr;
      }
      customQuestionIds = (createdQ ?? []).map((q) => q.id);
    }

    const finalQuestionIds = [
      ...(data.questionIds ?? []),
      ...customQuestionIds,
    ];

    let curated: { question_id: string; ordering: number; source: string }[] = [];
    if (finalQuestionIds.length > 0) {
      // Validate ownership of every question
      const { data: ownedQ } = await supabaseAdmin
        .from("questions")
        .select("id")
        .in("id", finalQuestionIds)
        .eq("org_id", candidate.org_id);
      const ownedSet = new Set((ownedQ ?? []).map((q: { id: string }) => q.id));
      curated = finalQuestionIds
        .filter((id) => ownedSet.has(id))
        .map((id, i) => ({ question_id: id, ordering: i, source: "wizard" }));
    } else if (personaVersionId) {
      const { data: pq } = await supabaseAdmin
        .from("persona_questions")
        .select("question_id, ordering")
        .eq("persona_version_id", personaVersionId)
        .order("ordering", { ascending: true });
      curated = (pq ?? []).map((p: { question_id: string; ordering: number | null }, i: number) => ({
        question_id: p.question_id,
        ordering: p.ordering ?? i,
        source: "persona",
        interview_id: row.id,
      }));
    }
    if (curated.length > 0) {
      const { error: qErr } = await supabaseAdmin
        .from("interview_questions")
        .insert(curated.map((c) => ({ interview_id: row.id, question_id: c.question_id, ordering: c.ordering, source: c.source })) as never);
      if (qErr) console.error("[scheduleInterview] interview_questions insert failed", qErr);
    }

    await supabaseAdmin.from("audit_events").insert({
      org_id: candidate.org_id,
      actor_id: userId,
      entity_type: "interview",
      entity_id: row.id,
      action: "schedule",
      diff: {
        scheduled_at: data.scheduledAt,
        duration_minutes: data.durationMinutes,
        persona_version_id: personaVersionId,
        curated_questions: curated.length,
      },
    });

    // Auto-create invitation with join token
    try {
      const { createInterviewInvitation } = await import("./invitations.functions");
      await createInterviewInvitation({ data: { interviewId: row.id } as never });
    } catch (e) {
      // Don't fail scheduling if invitation creation fails — surface in logs
      console.error("[scheduleInterview] invitation create failed", e);
    }

    return mapRow({ ...(row as Row), candidates: { full_name: candidate.full_name, email: candidate.email } });
  });




// ---------- reschedule ----------
const rescheduleInput = z.object({
  id: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(240).optional(),
  reason: z.string().trim().max(500).optional(),
});

export const rescheduleInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => rescheduleInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("interviews")
      .select("id, org_id, candidate_id, scheduled_at, duration_minutes, status")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!existing) throw new Error("Interview not found");
    if (!existing.org_id) throw new Error("Interview missing org");
    const orgId = existing.org_id;

    if (existing.status === "completed" || existing.status === "evaluation_pending") {
      throw new Error(`Cannot reschedule a completed or pending evaluation interview (current status: ${existing.status})`);
    }

    const newDuration = data.durationMinutes ?? existing.duration_minutes ?? 45;

    const { error: updErr } = await supabaseAdmin
      .from("interviews")
      .update({
        scheduled_at: data.scheduledAt,
        duration_minutes: newDuration,
        status: "scheduled",
      })
      .eq("id", data.id);

    if (updErr) {
      if (isOverlapError(updErr)) {
        throw new Error("That time conflicts with another interview for the recruiter or candidate.");
      }
      throw updErr;
    }

    await supabaseAdmin.from("interview_reschedules").insert({
      interview_id: data.id,
      from_at: existing.scheduled_at,
      to_at: data.scheduledAt,
      reason: data.reason ?? null,
      actor_id: userId,
    });

    await supabaseAdmin.from("audit_events").insert({
      org_id: orgId,

      actor_id: userId,
      entity_type: "interview",
      entity_id: data.id,
      action: "reschedule",
      diff: { from: existing.scheduled_at, to: data.scheduledAt, reason: data.reason ?? null },
    });

    const candidate = await loadOrgForCandidate(existing.candidate_id);
    await enqueueNotification({
      orgId,

      kind: "reschedule",
      recipientEmail: candidate.email,
      payload: {
        interviewId: data.id,
        candidateName: candidate.full_name,
        from: existing.scheduled_at,
        to: data.scheduledAt,
        reason: data.reason ?? null,
      },
    });

    return { ok: true } as const;
  });

// ---------- cancel ----------
const cancelInput = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

export const cancelInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => cancelInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("interviews")
      .select("id, org_id, candidate_id, scheduled_at, status")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!existing) throw new Error("Interview not found");
    if (!existing.org_id) throw new Error("Interview missing org");
    const orgId = existing.org_id;

    if (existing.status === "completed" || existing.status === "evaluation_pending") {
      throw new Error(`Cannot cancel a completed or pending evaluation interview (current status: ${existing.status})`);
    }

    const { error: updErr } = await supabaseAdmin
      .from("interviews")
      .update({ status: "cancelled" })
      .eq("id", data.id);
    if (updErr) throw updErr;

    await supabaseAdmin.from("audit_events").insert({
      org_id: orgId,
      actor_id: userId,
      entity_type: "interview",
      entity_id: data.id,
      action: "cancel",
      diff: { reason: data.reason ?? null },
    });

    const candidate = await loadOrgForCandidate(existing.candidate_id);
    await enqueueNotification({
      orgId,
      kind: "cancel",
      recipientEmail: candidate.email,
      payload: {
        interviewId: data.id,
        candidateName: candidate.full_name,
        scheduledAt: existing.scheduled_at,
        reason: data.reason ?? null,
      },
    });

    return { ok: true } as const;
  });
