import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";

// ---------- DTOs ----------
export type SessionDTO = {
  id: string;
  interviewId: string;
  startedAt: string;
  endedAt: string | null;
};

export type TurnDTO = {
  id: string;
  speaker: string;
  text: string;
  startedAt: string;
  endedAt: string | null;
  turnScore: unknown;
};

export type EvaluationResult = {
  overallScore: number;
  recommendation: "strong_hire" | "hire" | "no_hire" | "strong_no_hire";
  strengths: string[];
  concerns: string[];
  summary: string;
  competencyScores: Record<string, number>;
  integrityScore: number;
};

function getBackendUrl(): string {
  return process.env.BACKEND_URL || "http://localhost:3000";
}

function getAuthHeader(): Record<string, string> {
  const request = getRequest();
  const auth = request?.headers?.get("authorization");
  return auth ? { Authorization: auth } : {};
}

// ---------- startSession ----------
export const startSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        interviewId: z.string().uuid(),
        deviceInfo: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/interviews/session/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(`Failed to start session: ${res.statusText}`);
    }

    const row = await res.json();
    return {
      id: row.id,
      interviewId: row.interviewId,
      startedAt: row.startedAt,
      endedAt: row.endedAt || null,
    } satisfies SessionDTO;
  });

// ---------- endSession ----------
export const endSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ sessionId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/interviews/session/end`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(`Failed to end session: ${res.statusText}`);
    }

    return { ok: true } as const;
  });

// ---------- recordEvent (integrity signal) ----------
export const recordInterviewEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        type: z.string(),
        payload: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/interviews/session/${data.sessionId}/event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({ type: data.type, payload: data.payload }),
    });

    if (!res.ok) {
      throw new Error(`Failed to record event: ${res.statusText}`);
    }

    return { ok: true } as const;
  });

// ---------- appendTurn (transcript) ----------
export const appendInterviewTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        speaker: z.enum(["candidate", "persona", "system"]),
        text: z.string().min(1).max(20000),
        startedAt: z.string().datetime(),
        endedAt: z.string().datetime().optional(),
        audioPath: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/interviews/session/${data.sessionId}/turn`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({
        speaker: data.speaker,
        text: data.text,
        audioPath: data.audioPath,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to append turn: ${res.statusText}`);
    }

    const row = await res.json();
    return {
      id: row.id,
      speaker: row.speaker,
      text: row.text,
      startedAt: row.started_at,
      endedAt: row.ended_at || null,
      turnScore: row.turn_score || null,
    } satisfies TurnDTO;
  });

// ---------- finalizeEvaluation ----------
export const finalizeEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ interviewId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    // Session id can be retrieved inside NestJS engine
    const res = await fetch(
      `${getBackendUrl()}/api/interviews/${data.interviewId}/finalize-evaluation`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ sessionId: "00000000-0000-0000-0000-000000000000" }), // Nest will auto-detect recent session
      },
    );

    if (!res.ok) {
      throw new Error(`Failed to finalize evaluation: ${res.statusText}`);
    }

    return { ok: true } as const;
  });

// ---------- getEvaluation ----------
export const getEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ interviewId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/interviews/${data.interviewId}/evaluation`, {
      headers: {
        ...getAuthHeader(),
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch evaluation: ${res.statusText}`);
    }

    return res.json();
  });

// ---------- nextPersonaQuestion ----------
export const nextPersonaQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ sessionId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const res = await fetch(
      `${getBackendUrl()}/api/interviews/session/${data.sessionId}/next-question`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({}),
      },
    );

    if (!res.ok) {
      throw new Error(`Failed to fetch next question: ${res.statusText}`);
    }

    const row = await res.json();
    return {
      id: row.id,
      speaker: row.speaker,
      text: row.text,
      startedAt: new Date().toISOString(),
      endedAt: null,
      turnScore: null,
    } satisfies TurnDTO;
  });

// ---------- listSessionTurns ----------
export const listSessionTurns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ sessionId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/interviews/session/${data.sessionId}/turns`, {
      headers: {
        ...getAuthHeader(),
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to list session turns: ${res.statusText}`);
    }

    const rows = (await res.json()) as any[];
    return rows.map((r) => ({
      id: r.id,
      speaker: r.speaker,
      text: r.text,
      startedAt: r.started_at,
      endedAt: r.ended_at || null,
      turnScore: r.turn_score || null,
    })) satisfies TurnDTO[];
  });
