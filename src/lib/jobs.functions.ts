import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type JobStatus = "draft" | "open" | "paused" | "closed" | "archived";

export type JobDTO = {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  employmentType: string | null;
  seniority: string | null;
  description: string | null;
  requirements: string | null;
  status: JobStatus;
  personaId: string | null;
  candidateCount: number;
  createdAt: string;
};

type Row = {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  employment_type: string | null;
  seniority: string | null;
  description: string | null;
  requirements: string | null;
  status: string;
  persona_id: string | null;
  created_at: string;
};

function mapRow(r: Row, count = 0): JobDTO {
  return {
    id: r.id,
    title: r.title,
    department: r.department,
    location: r.location,
    employmentType: r.employment_type,
    seniority: r.seniority,
    description: r.description,
    requirements: r.requirements,
    status: r.status as JobStatus,
    personaId: r.persona_id,
    candidateCount: count,
    createdAt: r.created_at,
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

export const listJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const res = await fetch(`${getBackendUrl()}/api/jobs`, {
        headers: {
          ...getAuthHeader(),
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to list jobs: ${res.statusText}`);
      }

      const rows = (await res.json()) as Row[];
      return rows.map((r) => mapRow(r, 0));
    } catch (err) {
      console.warn("NestJS backend offline at port 3000. Listing jobs directly from Supabase...");
      const { data: rows, error } = await supabaseAdmin
        .from("job_descriptions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (rows || []).map((r) => mapRow(r as any, 0));
    }
  });

export const getJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    try {
      const res = await fetch(`${getBackendUrl()}/api/jobs/${data.id}`, {
        headers: {
          ...getAuthHeader(),
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch job: ${res.statusText}`);
      }

      const row = (await res.json()) as Row | null;
      if (!row) throw new Error("Job not found");
      return mapRow(row);
    } catch (err) {
      console.warn("NestJS backend offline at port 3000. Fetching job directly from Supabase...");
      const { data: row, error } = await supabaseAdmin
        .from("job_descriptions")
        .select("*")
        .eq("id", data.id)
        .maybeSingle();
      if (error) throw error;
      if (!row) throw new Error("Job not found");
      return mapRow(row as any);
    }
  });

const UpsertInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(2).max(200),
  department: z.string().max(120).optional().nullable(),
  location: z.string().max(120).optional().nullable(),
  employmentType: z.string().max(60).optional().nullable(),
  seniority: z.string().max(60).optional().nullable(),
  description: z.string().max(20000).optional().nullable(),
  requirements: z.string().max(20000).optional().nullable(),
  personaId: z.string().uuid().optional().nullable(),
  status: z.enum(["draft", "open", "paused", "closed", "archived"]).default("draft"),
  competencies: z.any().optional(),
});

export const upsertJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpsertInput.parse(input))
  .handler(async ({ data, context }) => {
    try {
      const res = await fetch(`${getBackendUrl()}/api/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error(`Failed to upsert job: ${res.statusText}`);
      }

      const row = (await res.json()) as Row;
      return mapRow(row);
    } catch (err) {
      console.warn("NestJS backend offline at port 3000. Upserting job directly in Supabase:", (err as Error).message);
      const creatorId = (context as any)?.userId || "00000000-0000-0000-0000-000000000000";

      // Resolve the user's actual org_id from their profile
      let orgId: string | null = null;
      try {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("org_id")
          .eq("id", creatorId)
          .maybeSingle();
        orgId = profile?.org_id ?? null;
      } catch (e) {
        console.warn("Could not resolve org_id from profile, using null:", e);
      }

      const dbData = {
        id: data.id || undefined,
        title: data.title,
        department: data.department,
        location: data.location,
        employment_type: data.employmentType,
        seniority: data.seniority,
        description: data.description,
        requirements: data.requirements,
        persona_id: data.personaId,
        status: data.status,
        competencies: data.competencies || {},
        created_by: creatorId,
        org_id: orgId,
      };

      const { data: row, error } = await supabaseAdmin
        .from("job_descriptions")
        .upsert(dbData)
        .select()
        .single();
      if (error) throw error;
      return mapRow(row as any);
    }
  });

export const archiveJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    // Re-route JD status manual patch
    const res = await fetch(`${getBackendUrl()}/api/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({ id: data.id, status: "archived" }),
    });

    if (!res.ok) {
      throw new Error(`Failed to archive job: ${res.statusText}`);
    }

    return { ok: true };
  });

const SuggestJdInput = z.object({
  title: z.string().min(2).max(200),
  department: z.string().optional().nullable(),
});

export const suggestJobDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SuggestJdInput.parse(input))
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/jobs/suggest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(`Failed to generate suggestion: ${res.statusText}`);
    }

    return res.json() as Promise<{ description: string; requirements: string }>;
  });

const JDAssistInput = z.object({
  title: z.string().min(2).max(200),
  department: z.string().optional().nullable(),
  experienceLevel: z.string(),
  location: z.string().optional().nullable(),
  employmentType: z.string(),
});

export const runJDAssist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => JDAssistInput.parse(input))
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/jobs/ai-assist`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(`Failed to generate AI JD Assist: ${res.statusText}`);
    }

    return res.json() as Promise<any>;
  });
