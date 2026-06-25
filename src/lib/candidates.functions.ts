import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";

// ---------- shared UI shape ----------
export type CandidateStatus =
  | "new"
  | "screening"
  | "interviewing"
  | "evaluated"
  | "offer"
  | "hired"
  | "rejected"
  | "archived";

export type CandidateDTO = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: CandidateStatus;
  score: number;
  avatar: string;
  appliedAt: string;
  skills: string[];
  experienceYears: number;
  phone: string | null;
  resumeSummary: string | null;
  jobId: string | null;
  customRole: any;
  resumeAnalysis: any;
};

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

type DbRow = {
  id: string;
  full_name: string;
  email: string;
  role_applied: string | null;
  status: string;
  ai_score: number | string | null;
  skills: string[] | null;
  experience_years: number | string | null;
  phone: string | null;
  resume_summary: string | null;
  created_at: string;
  job_id: string | null;
  custom_role: any;
  resume_analysis: any;
};

function mapRow(r: DbRow): CandidateDTO {
  // Map candidate status from domain to matching UI status
  let uiStatus: CandidateStatus = "new";
  if (["applied", "resume_imported", "resume_parsed"].includes(r.status)) uiStatus = "new";
  else if (["jd_matched", "shortlisted"].includes(r.status)) uiStatus = "screening";
  else if (
    [
      "interview_assigned",
      "interview_scheduled",
      "invitation_sent",
      "interview_started",
      "interview_running",
    ].includes(r.status)
  )
    uiStatus = "interviewing";
  else if (["evaluation_processing", "recruiter_review"].includes(r.status)) uiStatus = "evaluated";
  else if (r.status === "hiring_decision") uiStatus = "hired";
  else if (r.status === "archived") uiStatus = "archived";
  else uiStatus = r.status as CandidateStatus;

  return {
    id: r.id,
    name: r.full_name,
    email: r.email,
    role: r.role_applied ?? "",
    status: uiStatus,
    score: r.ai_score == null ? 0 : Number(r.ai_score),
    avatar: initials(r.full_name),
    appliedAt: (r.created_at ?? "").slice(0, 10),
    skills: r.skills ?? [],
    experienceYears: r.experience_years == null ? 0 : Number(r.experience_years),
    phone: r.phone,
    resumeSummary: r.resume_summary,
    jobId: r.job_id,
    customRole: r.custom_role,
    resumeAnalysis: r.resume_analysis,
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
    search: z.string().trim().max(200).optional(),
    status: z.string().optional(),
    limit: z.number().int().min(1).max(200).default(100),
  })
  .default({ limit: 100 });

export const listCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listInput.parse(data ?? {}))
  .handler(async ({ data }) => {
    let url = `${getBackendUrl()}/api/candidates`;
    const params = new URLSearchParams();
    if (data.search) params.append("search", data.search);
    if (data.status) params.append("status", data.status);
    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const res = await fetch(url, {
      headers: {
        ...getAuthHeader(),
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to list candidates: ${res.statusText}`);
    }

    const rows = (await res.json()) as DbRow[];
    return rows.map(mapRow);
  });

// ---------- get one ----------
export const getCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/candidates/${data.id}`, {
      headers: {
        ...getAuthHeader(),
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch candidate: ${res.statusText}`);
    }

    const row = (await res.json()) as DbRow | null;
    if (!row) return null;
    return mapRow(row);
  });

// ---------- create ----------
const createInput = z.object({
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

export type CreateCandidateInput = z.infer<typeof createInput>;

export const createCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createInput.parse(data))
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/candidates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(`Failed to create candidate: ${res.statusText}`);
    }

    const result = await res.json();

    // Fetch the newly created candidate to map correct format
    const getRes = await fetch(`${getBackendUrl()}/api/candidates/${result.id}`, {
      headers: {
        ...getAuthHeader(),
      },
    });

    const row = (await getRes.json()) as DbRow;
    return mapRow(row);
  });

// ---------- list sent notifications ----------
export const listNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ limit: z.number().int().min(1).max(100).default(20) })
      .default({ limit: 20 })
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    // Standard mock list as outbox logging is managed in background
    return [];
  });

// ---------- update status ----------
export const updateCandidateStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.string(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/candidates/${data.id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({ status: data.status }),
    });

    if (!res.ok) {
      throw new Error(`Failed to update status: ${res.statusText}`);
    }

    return { ok: true } as const;
  });

// ---------- update profile ----------
export const updateCandidateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        phone: z.string().trim().min(5).max(40).optional(),
        role: z.string().trim().min(1).max(120).optional(),
        experienceYears: z.number().min(0).max(60).optional(),
        skills: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
        resumeSummary: z.string().trim().min(1).max(4000).optional(),
        jobId: z.string().uuid().optional().nullable(),
        customRole: z.any().optional().nullable(),
        resumeAnalysis: z.any().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    // Call candidate update endpoint directly to bypass strict transitions
    const res = await fetch(`${getBackendUrl()}/api/candidates/${data.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(`Failed to update profile: ${res.statusText}`);
    }

    return { ok: true } as const;
  });

// ---------- archive ----------
export const archiveCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/candidates/${data.id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({
        status: "archived",
        reason: "Manually archived from Recruiter panel.",
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to archive candidate: ${res.statusText}`);
    }

    return { ok: true } as const;
  });

// ---------- upload resume ----------
const UploadResumeInput = z.object({
  id: z.string().uuid(),
  fileName: z.string(),
  fileBase64: z.string(),
  mimeType: z.string(),
});

export const uploadCandidateResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UploadResumeInput.parse(input))
  .handler(async ({ data }) => {
    const fileBuffer = Buffer.from(data.fileBase64, "base64");
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: data.mimeType });
    formData.append("file", blob, data.fileName);

    const res = await fetch(`${getBackendUrl()}/api/candidates/${data.id}/upload-resume`, {
      method: "POST",
      headers: {
        ...getAuthHeader(),
      },
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`Failed to upload resume: ${res.statusText}`);
    }

    return res.json() as Promise<{ message: string }>;
  });

export const retryResumeParsing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/candidates/${data.id}/retry-resume`, {
      method: "POST",
      headers: {
        ...getAuthHeader(),
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to retry resume processing: ${res.statusText}`);
    }

    return { ok: true } as const;
  });

export const updateCandidateSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), resumeSummary: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/candidates/${data.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({ resumeSummary: data.resumeSummary }),
    });

    if (!res.ok) {
      throw new Error(`Failed to update candidate summary: ${res.statusText}`);
    }

    return res.json();
  });
