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

export const listErrorEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(200).default(50) }).parse(input),
  )
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/admin/errors?limit=${data.limit}`, {
      headers: {
        ...getAuthHeader(),
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to list error events: ${res.statusText}`);
    }
    return await res.json();
  });
