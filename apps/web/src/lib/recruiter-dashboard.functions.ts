import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";

export type DashboardCandidate = {
  id: string;
  name: string;
  role: string;
  score: number;
  status: string;
  avatar: string;
};

export type DashboardInterview = {
  id: string;
  candidateName: string;
  role: string;
  scheduledAt: string | null;
  status: string;
};

export type RecruiterDashboardDTO = {
  pipelineCount: number;
  interviewsThisWeek: number;
  evaluatedCount: number;
  liveOrScheduledCount: number;
  todaysInterviews: DashboardInterview[];
  topCandidates: DashboardCandidate[];
};

function getBackendUrl(): string {
  return process.env.BACKEND_URL || "http://localhost:3000";
}

function getAuthHeader(): Record<string, string> {
  const request = getRequest();
  const auth = request?.headers?.get("authorization");
  return auth ? { Authorization: auth } : {};
}

export const getRecruiterDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<RecruiterDashboardDTO> => {
    const res = await fetch(`${getBackendUrl()}/api/analytics/recruiter-dashboard`, {
      headers: {
        ...getAuthHeader(),
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch recruiter dashboard: ${res.statusText}`);
    }

    return (await res.json()) as RecruiterDashboardDTO;
  });
