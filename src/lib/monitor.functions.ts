import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";

export type LiveInterviewDTO = {
  id: string;
  candidateName: string;
  candidateEmail: string;
  role: string;
  personaName: string;
  scheduledAt: string | null;
  durationMinutes: number;
  status: string;
  sessionId: string | null;
};

export type MonitorTurn = {
  id: string;
  who: "AI" | "Candidate";
  text: string;
  at: string;
};

export type MonitorEvent = {
  id: string;
  type: string;
  payload: string | null;
  at: string;
};

export type MonitorSessionDTO = {
  interview: LiveInterviewDTO;
  session: { id: string; startedAt: string | null; endedAt: string | null } | null;
  turns: MonitorTurn[];
  events: MonitorEvent[];
};

export type RecordedSessionDTO = {
  id: string;
  interviewId: string;
  candidateName: string;
  role: string;
  personaName: string;
  durationSec: number;
  scheduledAt: string | null;
  score: number | null;
};

function getBackendUrl(): string {
  return process.env.BACKEND_URL || "http://localhost:3000";
}

function getAuthHeader(): Record<string, string> {
  const request = getRequest();
  const auth = request?.headers?.get("authorization");
  return auth ? { Authorization: auth } : {};
}

export const listLiveInterviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const res = await fetch(`${getBackendUrl()}/api/interviews/live`, {
      headers: {
        ...getAuthHeader(),
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to list live interviews: ${res.statusText}`);
    }
    return (await res.json()) as LiveInterviewDTO[];
  });

export const getMonitorSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ interviewId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/interviews/monitor/${data.interviewId}`, {
      headers: {
        ...getAuthHeader(),
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to get monitor session: ${res.statusText}`);
    }
    return (await res.json()) as MonitorSessionDTO;
  });

export const listRecordedSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const res = await fetch(`${getBackendUrl()}/api/interviews/recorded`, {
      headers: {
        ...getAuthHeader(),
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to list recorded sessions: ${res.statusText}`);
    }
    return (await res.json()) as RecordedSessionDTO[];
  });

export const flagSessionEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        note: z.string().trim().min(1).max(1000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/interviews/session/${data.sessionId}/flag`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({ note: data.note }),
    });
    if (!res.ok) {
      throw new Error(`Failed to flag session event: ${res.statusText}`);
    }
    return { ok: true } as const;
  });
