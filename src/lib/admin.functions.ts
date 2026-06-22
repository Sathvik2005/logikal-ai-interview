import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";

export type OrgDTO = {
  id: string;
  name: string;
  industry: string | null;
  size: string | null;
  status: string;
  createdAt: string;
  candidateCount: number;
  interviewCount: number;
};

function getBackendUrl(): string {
  return process.env.BACKEND_URL || "http://localhost:3000";
}

function getAuthHeader(): Record<string, string> {
  const request = getRequest();
  const auth = request?.headers?.get("authorization");
  return auth ? { Authorization: auth } : {};
}

export const listOrganizations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const res = await fetch(`${getBackendUrl()}/api/admin/organizations`, {
      headers: {
        ...getAuthHeader(),
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to list organizations: ${res.statusText}`);
    }
    return (await res.json()) as OrgDTO[];
  });

export const getOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/admin/organizations/${data.id}`, {
      headers: {
        ...getAuthHeader(),
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to get organization: ${res.statusText}`);
    }
    return await res.json();
  });

export const updateOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().optional(),
        industry: z.string().optional().nullable(),
        size: z.string().optional().nullable(),
        status: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { id, ...rest } = data;
    const res = await fetch(`${getBackendUrl()}/api/admin/organizations/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(rest),
    });
    if (!res.ok) {
      throw new Error(`Failed to update organization: ${res.statusText}`);
    }
    return { ok: true };
  });

export type AdminDashboardDTO = {
  orgCount: number;
  candidateCount: number;
  interviewsThisMonth: number;
  errorCount24h: number;
  trend: { day: string; count: number }[];
};

export const getAdminDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const res = await fetch(`${getBackendUrl()}/api/admin/dashboard`, {
      headers: {
        ...getAuthHeader(),
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to get admin dashboard: ${res.statusText}`);
    }
    return (await res.json()) as AdminDashboardDTO;
  });
