import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const checks: Record<string, { ok: boolean; latency_ms?: number; error?: string }> = {};
        const t0 = Date.now();
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.from("organizations").select("id").limit(1);
          checks.db = { ok: !error, latency_ms: Date.now() - t0, error: error?.message };
        } catch (e) {
          checks.db = { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
        checks.ai_gateway_key = { ok: !!process.env.LOVABLE_API_KEY };
        const ok = Object.values(checks).every((c) => c.ok);
        return new Response(
          JSON.stringify({ status: ok ? "ok" : "degraded", checks, ts: new Date().toISOString() }),
          { status: ok ? 200 : 503, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
