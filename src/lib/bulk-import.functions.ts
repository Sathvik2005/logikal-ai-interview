import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";

function getBackendUrl(): string {
  return process.env.BACKEND_URL || "http://localhost:3000";
}

function getAuthHeader(): Record<string, string> {
  const request = getRequest();
  const auth = request?.headers?.get("authorization");
  return auth ? { Authorization: auth } : {};
}

const CandidateRow = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(60).nullish(),
  role: z.string().trim().max(200).nullish(),
  experienceYears: z.number().min(0).max(60).nullish(),
  skills: z.array(z.string().trim().min(1).max(80)).max(100).default([]),
  resumeUrl: z.string().trim().max(2000).nullish(),
  resumeSummary: z.string().trim().max(8000).nullish(),
});

const BulkInput = z.object({
  rows: z.array(CandidateRow).min(1).max(500),
  jobId: z.string().uuid().nullish(),
});

export type BulkImportRow = z.input<typeof CandidateRow>;

export const bulkImportCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BulkInput.parse(d))
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/candidates/bulk-import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(`Failed to bulk import candidates: ${res.statusText}`);
    }

    return res.json() as Promise<{
      imported: number;
      skipped: number;
      candidateIds: string[];
    }>;
  });

// ---- JD match (sync, single candidate) ----
const MatchInput = z.object({
  jobId: z.string().uuid(),
  candidateId: z.string().uuid(),
});

export const computeJdMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MatchInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: job } = await context.supabase
      .from("job_descriptions")
      .select("id, org_id, title, description, requirements, seniority")
      .eq("id", data.jobId)
      .maybeSingle();
    if (!job) throw new Error("Job not found");

    const { data: cand } = await context.supabase
      .from("candidates")
      .select("id, full_name, role_applied, skills, experience_years, resume_summary")
      .eq("id", data.candidateId)
      .maybeSingle();
    if (!cand) throw new Error("Candidate not found");

    const apiKey = process.env.LOVABLE_API_KEY;
    let match = {
      score: 50,
      missingSkills: [] as string[],
      strengths: [] as string[],
      focusAreas: [] as string[],
    };

    if (apiKey) {
      try {
        const prompt = `You match candidates to job descriptions. Return STRICT JSON with keys: score (0-100 integer), missingSkills (array of strings), strengths (array of strings), focusAreas (array of strings - what to probe in interview).

Job: ${job.title}
Seniority: ${job.seniority ?? "n/a"}
Description: ${(job.description ?? "").slice(0, 2000)}
Requirements: ${(job.requirements ?? "").slice(0, 2000)}

Candidate: ${cand.full_name}
Current role: ${cand.role_applied ?? "n/a"}
Experience: ${cand.experience_years ?? 0} years
Skills: ${(cand.skills ?? []).join(", ")}
Summary: ${(cand.resume_summary ?? "").slice(0, 2000)}

Return ONLY JSON.`;

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You are a precise JSON-only API." },
              { role: "user", content: prompt },
            ],
            response_format: { type: "json_object" },
          }),
        });
        if (res.ok) {
          const j = await res.json();
          const txt = j.choices?.[0]?.message?.content ?? "{}";
          const parsed = JSON.parse(txt);
          match = {
            score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
            missingSkills: Array.isArray(parsed.missingSkills)
              ? parsed.missingSkills.slice(0, 20)
              : [],
            strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 20) : [],
            focusAreas: Array.isArray(parsed.focusAreas) ? parsed.focusAreas.slice(0, 20) : [],
          };
        }
      } catch {
        // fall back to heuristic
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const orgId = job.org_id;
    if (!orgId) throw new Error("Job missing org");
    await supabaseAdmin.from("jd_candidate_matches").upsert(
      {
        org_id: orgId as string,
        job_id: data.jobId,
        candidate_id: data.candidateId,
        match_score: match.score,
        missing_skills: match.missingSkills as never,
        strengths: match.strengths as never,
        focus_areas: match.focusAreas as never,
      },
      { onConflict: "job_id,candidate_id" },
    );

    return match;
  });

export const listJdMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("jd_candidate_matches")
      .select(
        "id, candidate_id, match_score, missing_skills, strengths, focus_areas, shortlisted, candidates(full_name, email, role_applied, ai_score, status)",
      )
      .eq("job_id", data.jobId)
      .order("match_score", { ascending: false });
    if (error) throw new Error(error.message);
    type R = {
      id: string;
      candidate_id: string;
      match_score: number | null;
      missing_skills: string[];
      strengths: string[];
      focus_areas: string[];
      shortlisted: boolean;
      candidates: {
        full_name: string;
        email: string;
        role_applied: string | null;
        ai_score: number | null;
        status: string;
      } | null;
    };
    return ((rows ?? []) as unknown as R[]).map((r) => ({
      id: r.id,
      candidateId: r.candidate_id,
      candidateName: r.candidates?.full_name ?? "Candidate",
      candidateEmail: r.candidates?.email ?? "",
      role: r.candidates?.role_applied ?? "—",
      matchScore: r.match_score == null ? null : Number(r.match_score),
      missingSkills: r.missing_skills ?? [],
      strengths: r.strengths ?? [],
      focusAreas: r.focus_areas ?? [],
      shortlisted: r.shortlisted,
    }));
  });

export const shortlistCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        jobId: z.string().uuid(),
        candidateIds: z.array(z.string().uuid()).min(1).max(200),
        shortlisted: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("jd_candidate_matches")
      .update({ shortlisted: data.shortlisted })
      .eq("job_id", data.jobId)
      .in("candidate_id", data.candidateIds);
    if (error) throw new Error(error.message);

    if (data.shortlisted) {
      await context.supabase
        .from("candidates")
        .update({ status: "screening" })
        .in("id", data.candidateIds);
    }
    return { ok: true, count: data.candidateIds.length };
  });
