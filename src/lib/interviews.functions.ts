import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";

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
  candidate?: { full_name: string; email: string } | null;
};

function mapRow(r: Row): InterviewDTO {
  return {
    id: r.id,
    candidateId: r.candidate_id,
    candidateName: r.candidate?.full_name ?? "",
    candidateEmail: r.candidate?.email ?? "",
    jobId: r.job_id,
    personaId: r.persona_id,
    scheduledAt: r.scheduled_at,
    durationMinutes: r.duration_minutes ?? 45,
    status: r.status,
    recruiterId: r.recruiter_id,
  };
}

function getBackendUrl(): string {
  return process.env.BACKEND_URL || "http://localhost:3000";
}

function getAuthHeader(): Record<string, string> {
  const request = getRequest();
  const auth = request?.headers?.get("authorization");
  return auth ? { Authorization: auth } : {};
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
  .handler(async ({ data }) => {
    let url = `${getBackendUrl()}/api/interviews`;
    const params = new URLSearchParams();
    if (data.status) params.append("status", data.status);
    if (data.from) params.append("from", data.from);
    if (data.to) params.append("to", data.to);
    params.append("limit", data.limit.toString());
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const res = await fetch(url, {
      headers: {
        ...getAuthHeader(),
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to list interviews: ${res.statusText}`);
    }

    const rows = (await res.json()) as Row[];
    return rows.map(mapRow);
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
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/interviews`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(`Failed to schedule interview: ${res.statusText}`);
    }

    const row = (await res.json()) as Row;
    return mapRow(row);
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
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/interviews/${data.id}/reschedule`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({
        scheduledAt: data.scheduledAt,
        durationMinutes: data.durationMinutes,
        reason: data.reason,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to reschedule interview: ${res.statusText}`);
    }

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
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/interviews/${data.id}/cancel`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({
        reason: data.reason,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to cancel interview: ${res.statusText}`);
    }

    return { ok: true } as const;
  });
