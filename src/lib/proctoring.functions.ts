import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";

type JsonValue = string | number | boolean | null | { [k: string]: JsonValue } | JsonValue[];

export type InterviewReportBundle = {
  report: JsonValue;
  interview: {
    id: string;
    candidateName: string;
    role: string;
    personaName: string;
    scheduledAt: string | null;
    durationMinutes: number;
    status: string;
    overallScore: number | null;
    recommendation: string | null;
    integrityScore: number | null;
    candidateEmail: string;
    candidatePhone: string;
    candidateResumeSummary: string;
    candidateSkills: string[];
    candidateExperienceYears: number;
  };
  turns: Array<{ id: string; speaker: string; text: string; started_at: string }>;
  events: Array<{ type: string; at: string; payload: JsonValue }>;
  snapshots: Array<{ id: string; kind: string; capturedAt: string; url: string | null }>;
};

function getBackendUrl(): string {
  return process.env.BACKEND_URL || "http://localhost:3000";
}

function getAuthHeader(): Record<string, string> {
  const request = getRequest();
  const auth = request?.headers?.get("authorization");
  return auth ? { Authorization: auth } : {};
}

// ---------- Identity ----------
export const startIdentityVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        interviewId: z.string().uuid(),
        selfieDataUrl: z.string().startsWith("data:image/"),
        idDataUrl: z.string().startsWith("data:image/").optional(),
        deviceFingerprint: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/proctoring/identity`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new Error(`Failed to verify identity: ${res.statusText}`);
    }
    return await res.json();
  });

// ---------- Snapshot upload ----------
export const uploadProctoringSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        kind: z.enum(["webcam", "screen"]),
        dataUrl: z.string().startsWith("data:image/"),
        meta: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/proctoring/snapshot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new Error(`Failed to upload snapshot: ${res.statusText}`);
    }
    return await res.json();
  });

// ---------- Generate full report ----------
export const generateInterviewReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ interviewId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/proctoring/generate-report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({ interviewId: data.interviewId }),
    });
    if (!res.ok) {
      throw new Error(`Failed to generate report: ${res.statusText}`);
    }
    return await res.json();
  });

// ---------- Get single report ----------
export const getInterviewReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ interviewId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/reports/${data.interviewId}`, {
      headers: {
        ...getAuthHeader(),
      },
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Failed to get report: ${res.statusText}`);
    }
    return await res.json();
  });

// ---------- Get complete report bundle ----------
export const getInterviewReportBundle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ interviewId: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<InterviewReportBundle> => {
    const res = await fetch(`${getBackendUrl()}/api/proctoring/report-bundle/${data.interviewId}`, {
      headers: {
        ...getAuthHeader(),
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to get report bundle: ${res.statusText}`);
    }
    return (await res.json()) as InterviewReportBundle;
  });
