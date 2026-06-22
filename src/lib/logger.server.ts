// Tiny structured logger that writes to error_events. Server-only.
export async function logServerError(args: {
  source: string;
  message: string;
  orgId?: string | null;
  actorId?: string | null;
  level?: "info" | "warn" | "error";
  context?: Record<string, unknown>;
  stack?: string;
  requestId?: string;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("error_events").insert({
      source: args.source,
      message: args.message.slice(0, 2000),
      org_id: args.orgId ?? null,
      actor_id: args.actorId ?? null,
      level: args.level ?? "error",
      context: (args.context ?? {}) as never,
      stack: args.stack?.slice(0, 4000) ?? null,
      request_id: args.requestId ?? null,
    });
  } catch (e) {
    // Last resort
    console.error("[logServerError] failed", e, args);
  }
}
