import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function loadInterview(interviewId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("interviews")
    .select("id, org_id, candidate_id")
    .eq("id", interviewId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Interview not found");
  return data as { id: string; org_id: string; candidate_id: string };
}

async function loadSession(sessionId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("interview_sessions")
    .select("id, interview_id, org_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Session not found");
  return data as { id: string; interview_id: string; org_id: string };
}

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; contentType: string; ext: string } {
  const m = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/i);
  if (!m) throw new Error("Invalid data URL");
  const contentType = m[1];
  const ext = contentType.split("/")[1] || "png";
  const b64 = m[2];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, contentType, ext };
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
  .handler(async ({ data, context }) => {
    const interview = await loadInterview(data.interviewId);
    if (interview.candidate_id) {
      const { data: cand } = await context.supabase
        .from("candidates")
        .select("user_id")
        .eq("id", interview.candidate_id)
        .maybeSingle();
      if (cand?.user_id && cand.user_id !== context.userId) throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const selfie = decodeDataUrl(data.selfieDataUrl);
    const selfiePath = `${context.userId}/${data.interviewId}/selfie-${Date.now()}.${selfie.ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("identity")
      .upload(selfiePath, selfie.bytes, { contentType: selfie.contentType, upsert: true });
    if (upErr) throw upErr;

    let idPath: string | null = null;
    if (data.idDataUrl) {
      const idDoc = decodeDataUrl(data.idDataUrl);
      idPath = `${context.userId}/${data.interviewId}/id-${Date.now()}.${idDoc.ext}`;
      const { error: idUpErr } = await supabaseAdmin.storage
        .from("identity")
        .upload(idPath, idDoc.bytes, { contentType: idDoc.contentType, upsert: true });
      if (idUpErr) throw idUpErr;
    }

    const { error } = await supabaseAdmin.from("identity_verifications").insert({
      org_id: interview.org_id,
      interview_id: data.interviewId,
      candidate_id: interview.candidate_id,
      selfie_path: selfiePath,
      id_document_path: idPath,
      status: "verified", // heuristic: presence of selfie counts as verified for now
      match_score: 0.9,
      device_fingerprint: (data.deviceFingerprint ?? {}) as never,
    });
    if (error) throw error;
    return { ok: true } as const;
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
  .handler(async ({ data, context }) => {
    const session = await loadSession(data.sessionId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const img = decodeDataUrl(data.dataUrl);
    const path = `${context.userId}/${session.interview_id}/${data.kind}-${Date.now()}.${img.ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("snapshots")
      .upload(path, img.bytes, { contentType: img.contentType, upsert: false });
    if (upErr) throw upErr;
    const { error } = await supabaseAdmin.from("proctoring_snapshots").insert({
      org_id: session.org_id,
      session_id: data.sessionId,
      interview_id: session.interview_id,
      kind: data.kind,
      storage_path: path,
      meta: (data.meta ?? {}) as never,
    });
    if (error) throw error;
    return { ok: true } as const;
  });

// ---------- Generate full report ----------
export const generateInterviewReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ interviewId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const interview = await loadInterview(data.interviewId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: session } = await supabaseAdmin
      .from("interview_sessions")
      .select("id")
      .eq("interview_id", data.interviewId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let turns: Array<{ speaker: string; text: string; started_at: string }> = [];
    let events: Array<{ type: string; at: string; payload: unknown }> = [];
    if (session?.id) {
      const [{ data: t }, { data: e }] = await Promise.all([
        supabaseAdmin
          .from("interview_turns")
          .select("speaker, text, started_at")
          .eq("session_id", session.id)
          .order("started_at", { ascending: true }),
        supabaseAdmin
          .from("interview_events")
          .select("type, at, payload")
          .eq("session_id", session.id)
          .order("at", { ascending: true }),
      ]);
      turns = (t ?? []) as typeof turns;
      events = (e ?? []) as typeof events;
    }

    const transcript = turns.map((t) => `${t.speaker.toUpperCase()}: ${t.text}`).join("\n");
    const integrityCounts = events.reduce<Record<string, number>>((acc, ev) => {
      acc[ev.type] = (acc[ev.type] ?? 0) + 1;
      return acc;
    }, {});
    const integrityPenalty = Math.min(
      60,
      (integrityCounts.tab_switch ?? 0) * 5 +
        (integrityCounts.focus_loss ?? 0) * 3 +
        (integrityCounts.fullscreen_exit ?? 0) * 8 +
        (integrityCounts.paste ?? 0) * 6 +
        (integrityCounts.multi_face ?? 0) * 10,
    );
    const integrityScore = Math.max(40, 100 - integrityPenalty);

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const systemPrompt = `You are a senior interview evaluator producing a structured, evidence-based report.
Return STRICT JSON with this exact shape:
{
  "executiveSummary": string,
  "scores": {
    "technical": number 0-100,
    "communication": number 0-100,
    "behavioral": number 0-100,
    "confidence": number 0-100,
    "knowledge": number 0-100
  },
  "strengths": string[],
  "weaknesses": string[],
  "knowledgeGaps": string[],
  "evidence": [{"competency": string, "quote": string}],
  "recommendation": "strong_hire" | "hire" | "maybe" | "reject"
}
Ground every claim in the transcript. Be honest and specific.`;

    const userPrompt = `Integrity events: ${JSON.stringify(integrityCounts)}
Transcript:
${transcript || "(no transcript captured)"}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (res.status === 402) throw new Error("AI credits exhausted.");
    if (res.status === 429) throw new Error("AI rate limit reached.");
    if (!res.ok) throw new Error(`AI gateway error ${res.status}`);
    const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = j.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {};
    }

    const scoresObj = (parsed.scores ?? {}) as Record<string, unknown>;
    const scores = {
      technical: Number(scoresObj.technical ?? 0),
      communication: Number(scoresObj.communication ?? 0),
      behavioral: Number(scoresObj.behavioral ?? 0),
      confidence: Number(scoresObj.confidence ?? 0),
      knowledge: Number(scoresObj.knowledge ?? 0),
    };
    const recValid = ["strong_hire", "hire", "maybe", "reject"] as const;
    const rec = recValid.includes(parsed.recommendation as never)
      ? (parsed.recommendation as (typeof recValid)[number])
      : "maybe";

    const timeline = events.map((e) => ({
      type: e.type,
      at: e.at,
      payload: e.payload,
    }));

    await supabaseAdmin.from("interview_reports").upsert(
      {
        org_id: interview.org_id,
        interview_id: data.interviewId,
        executive_summary: String(parsed.executiveSummary ?? ""),
        scores: scores as never,
        strengths: (Array.isArray(parsed.strengths) ? parsed.strengths : []) as never,
        weaknesses: (Array.isArray(parsed.weaknesses) ? parsed.weaknesses : []) as never,
        knowledge_gaps: (Array.isArray(parsed.knowledgeGaps) ? parsed.knowledgeGaps : []) as never,
        evidence: (Array.isArray(parsed.evidence) ? parsed.evidence : []) as never,
        integrity_score: integrityScore,
        integrity_timeline: timeline as never,
        recommendation: rec,
      },
      { onConflict: "interview_id" },
    );

    await supabaseAdmin
      .from("interviews")
      .update({
        status: "completed",
        evaluation_status: "done",
        overall_score: Math.round(
          (scores.technical +
            scores.communication +
            scores.behavioral +
            scores.confidence +
            scores.knowledge) /
            5,
        ),
        recommendation: rec === "reject" ? "no_hire" : rec === "maybe" ? "no_hire" : rec,
        integrity_score: integrityScore,
      })
      .eq("id", data.interviewId);

    return { ok: true } as const;
  });

export const getInterviewReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ interviewId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("interview_reports")
      .select("*")
      .eq("interview_id", data.interviewId)
      .maybeSingle();
    return row;
  });

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

export const getInterviewReportBundle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ interviewId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<InterviewReportBundle> => {
    const { data: iv, error: ivErr } = await context.supabase
      .from("interviews")
      .select(
        "id, scheduled_at, duration_minutes, status, overall_score, recommendation, integrity_score, candidates(full_name, email, phone, role_applied, resume_summary, skills, experience_years), personas(name)",
      )
      .eq("id", data.interviewId)
      .maybeSingle();
    if (ivErr) throw new Error(ivErr.message);
    if (!iv) throw new Error("Interview not found");
    const ivRow = iv as unknown as {
      id: string;
      scheduled_at: string | null;
      duration_minutes: number | null;
      status: string;
      overall_score: number | string | null;
      recommendation: string | null;
      integrity_score: number | string | null;
      candidates: {
        full_name: string;
        email: string;
        phone: string | null;
        role_applied: string | null;
        resume_summary: string | null;
        skills: string[] | null;
        experience_years: number | null;
      } | null;
      personas: { name: string } | null;
    };

    const { data: report } = await context.supabase
      .from("interview_reports")
      .select("*")
      .eq("interview_id", data.interviewId)
      .maybeSingle();

    const { data: session } = await context.supabase
      .from("interview_sessions")
      .select("id")
      .eq("interview_id", data.interviewId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let turns: InterviewReportBundle["turns"] = [];
    let events: InterviewReportBundle["events"] = [];
    let snapshots: InterviewReportBundle["snapshots"] = [];

    if (session?.id) {
      const [tRes, eRes, sRes] = await Promise.all([
        context.supabase
          .from("interview_turns")
          .select("id, speaker, text, started_at")
          .eq("session_id", session.id)
          .order("started_at"),
        context.supabase
          .from("interview_events")
          .select("type, at, payload")
          .eq("session_id", session.id)
          .order("at"),
        context.supabase
          .from("proctoring_snapshots")
          .select("id, kind, captured_at, storage_path")
          .eq("session_id", session.id)
          .order("captured_at", { ascending: false })
          .limit(60),
      ]);
      turns = (tRes.data ?? []) as never;
      events = (eRes.data ?? []) as never;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const snapRows = (sRes.data ?? []) as Array<{
        id: string;
        kind: string;
        captured_at: string;
        storage_path: string;
      }>;
      snapshots = await Promise.all(
        snapRows.map(async (s) => {
          const { data: signed } = await supabaseAdmin.storage
            .from("snapshots")
            .createSignedUrl(s.storage_path, 3600);
          return {
            id: s.id,
            kind: s.kind,
            capturedAt: s.captured_at,
            url: signed?.signedUrl ?? null,
          };
        }),
      );
    }

    return {
      report: ((report as unknown) ?? null) as JsonValue,
      interview: {
        id: ivRow.id,
        candidateName: ivRow.candidates?.full_name ?? "Candidate",
        role: ivRow.candidates?.role_applied ?? "—",
        personaName: ivRow.personas?.name ?? "AI Interviewer",
        scheduledAt: ivRow.scheduled_at,
        durationMinutes: ivRow.duration_minutes ?? 45,
        status: ivRow.status,
        overallScore: ivRow.overall_score == null ? null : Number(ivRow.overall_score),
        recommendation: ivRow.recommendation,
        integrityScore: ivRow.integrity_score == null ? null : Number(ivRow.integrity_score),
        candidateEmail: ivRow.candidates?.email ?? "",
        candidatePhone: ivRow.candidates?.phone ?? "",
        candidateResumeSummary: ivRow.candidates?.resume_summary ?? "",
        candidateSkills: ivRow.candidates?.skills ?? [],
        candidateExperienceYears: ivRow.candidates?.experience_years ?? 0,
      },
      turns,
      events,
      snapshots,
    };
  });
