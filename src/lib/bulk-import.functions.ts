import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: prof } = await supabaseAdmin
      .from("profiles").select("org_id").eq("id", userId).maybeSingle();
    let orgId = prof?.org_id as string | null;
    if (!orgId) {
      const { data: org, error: orgErr } = await supabaseAdmin
        .from("organizations").insert({ name: "My Workspace", status: "active" }).select("id").single();
      if (orgErr || !org) throw new Error(orgErr?.message ?? "Failed to create workspace");
      orgId = org.id as string;
      await supabaseAdmin.from("profiles").update({ org_id: orgId }).eq("id", userId);
      await supabaseAdmin.from("user_roles").upsert(
        { user_id: userId, role: "recruiter", org_id: orgId },
        { onConflict: "user_id,org_id,role" },
      );
    }
    const orgIdSafe: string = orgId;


    // Dedupe by email within org
    const emails = data.rows.map((r) => r.email.toLowerCase());
    const { data: existing } = await supabaseAdmin
      .from("candidates").select("email").in("email", emails).eq("org_id", orgId);
    const existingSet = new Set((existing ?? []).map((r: { email: string }) => r.email.toLowerCase()));

    const toInsert = data.rows
      .filter((r) => !existingSet.has(r.email.toLowerCase()))
      .map((r) => ({
        org_id: orgIdSafe,
        created_by: userId,
        full_name: r.name,
        email: r.email,
        phone: r.phone ?? null,
        role_applied: r.role ?? null,
        status: "new" as const,
        experience_years: r.experienceYears ?? 0,
        skills: r.skills,
        resume_url: r.resumeUrl ?? null,
        resume_summary: r.resumeSummary ?? null,
      }));


    let inserted: Array<{ id: string; email: string }> = [];
    if (toInsert.length > 0) {
      const { data: rows, error } = await supabaseAdmin
        .from("candidates").insert(toInsert).select("id, email");
      if (error) throw new Error(error.message);
      inserted = (rows ?? []) as typeof inserted;
    }

    // Audit
    if (inserted.length > 0) {
      await supabaseAdmin.from("audit_events").insert({
        org_id: orgIdSafe,
        actor_id: userId,
        entity_type: "candidate",
        entity_id: inserted[0].id,
        action: "bulk_import",
        diff: { count: inserted.length, jobId: data.jobId ?? null } as never,
      });
    }


    // If job provided, queue an ai_job per candidate for match scoring
    if (data.jobId && inserted.length > 0) {
      const jobs = inserted.map((c) => ({
        org_id: orgIdSafe,
        kind: "jd_match",
        status: "pending",
        entity_type: "candidate",
        entity_id: c.id,
        payload: { jobId: data.jobId, candidateId: c.id } as never,
      }));
      await supabaseAdmin.from("ai_jobs").insert(jobs);
    }


    return {
      imported: inserted.length,
      skipped: data.rows.length - inserted.length,
      candidateIds: inserted.map((c) => c.id),
    };
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
      .eq("id", data.jobId).maybeSingle();
    if (!job) throw new Error("Job not found");

    const { data: cand } = await context.supabase
      .from("candidates")
      .select("id, full_name, role_applied, skills, experience_years, resume_summary")
      .eq("id", data.candidateId).maybeSingle();
    if (!cand) throw new Error("Candidate not found");

    const apiKey = process.env.LOVABLE_API_KEY;
    let match = { score: 50, missingSkills: [] as string[], strengths: [] as string[], focusAreas: [] as string[] };

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
            missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills.slice(0, 20) : [],
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
    await supabaseAdmin.from("jd_candidate_matches").upsert({
      org_id: orgId as string,
      job_id: data.jobId,
      candidate_id: data.candidateId,
      match_score: match.score,
      missing_skills: match.missingSkills as never,
      strengths: match.strengths as never,
      focus_areas: match.focusAreas as never,
    }, { onConflict: "job_id,candidate_id" });


    return match;
  });

export const listJdMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("jd_candidate_matches")
      .select("id, candidate_id, match_score, missing_skills, strengths, focus_areas, shortlisted, candidates(full_name, email, role_applied, ai_score, status)")
      .eq("job_id", data.jobId)
      .order("match_score", { ascending: false });
    if (error) throw new Error(error.message);
    type R = {
      id: string; candidate_id: string; match_score: number | null;
      missing_skills: string[]; strengths: string[]; focus_areas: string[]; shortlisted: boolean;
      candidates: { full_name: string; email: string; role_applied: string | null; ai_score: number | null; status: string } | null;
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
    z.object({
      jobId: z.string().uuid(),
      candidateIds: z.array(z.string().uuid()).min(1).max(200),
      shortlisted: z.boolean().default(true),
    }).parse(d),
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
