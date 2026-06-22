import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";

export type EnrichInterviewDTO = {
  id: string;
  status: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
  persona_id: string | null;
  job_id: string | null;
  personaName: string | null;
  jobTitle: string | null;
  curatedQuestionCount: number;
  candidate: { id: string; full_name: string; role_applied: string | null };
};

export type CandidateInterviewSummary = {
  id: string;
  status: string;
  scheduledAt: string | null;
  durationMinutes: number;
  role: string;
  personaName: string;
};

function getBackendUrl(): string {
  return process.env.BACKEND_URL || "http://localhost:3000";
}

function getAuthHeader(): Record<string, string> {
  const request = getRequest();
  const auth = request?.headers?.get("authorization");
  return auth ? { Authorization: auth } : {};
}

// Resolves the most relevant interview for the signed-in candidate user.
export const getMyCandidateInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ interviewId: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data }): Promise<EnrichInterviewDTO | null> => {
    let url = `${getBackendUrl()}/api/candidates/self/interview`;
    if (data.interviewId) {
      url += `?interviewId=${data.interviewId}`;
    }

    const res = await fetch(url, {
      headers: {
        ...getAuthHeader(),
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch self interview: ${res.statusText}`);
    }

    return res.json();
  });

export const getMyUpcomingInterviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async (): Promise<{
      upcoming: CandidateInterviewSummary[];
      past: CandidateInterviewSummary[];
    }> => {
      const res = await fetch(`${getBackendUrl()}/api/candidates/self/upcoming`, {
        headers: {
          ...getAuthHeader(),
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch self upcoming: ${res.statusText}`);
      }

      return res.json();
    },
  );
