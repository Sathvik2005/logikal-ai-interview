import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";

const ListAuditInput = z.object({
  limit: z.number().int().min(1).max(200).default(50),
  entityType: z.string().optional(),
});

function getBackendUrl(): string {
  return process.env.BACKEND_URL || "http://localhost:3000";
}

function getAuthHeader(): Record<string, string> {
  const request = getRequest();
  const auth = request?.headers?.get("authorization");
  return auth ? { Authorization: auth } : {};
}

export const listAuditEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListAuditInput.parse(input))
  .handler(async ({ data }) => {
    let url = `${getBackendUrl()}/api/admin/audit-events?limit=${data.limit}`;
    if (data.entityType) {
      url += `&entityType=${encodeURIComponent(data.entityType)}`;
    }
    const res = await fetch(url, {
      headers: {
        ...getAuthHeader(),
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to list audit events: ${res.statusText}`);
    }
    return await res.json();
  });

export const requestDataExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const res = await fetch(`${getBackendUrl()}/api/admin/gdpr/export`, {
      method: "POST",
      headers: {
        ...getAuthHeader(),
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to request data export: ${res.statusText}`);
    }
    return await res.json();
  });

export const requestAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const res = await fetch(`${getBackendUrl()}/api/admin/gdpr/delete`, {
      method: "POST",
      headers: {
        ...getAuthHeader(),
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to request account deletion: ${res.statusText}`);
    }
    return await res.json();
  });
