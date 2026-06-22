import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getCompletionRates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("get_completion_rates");
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ org_id: string; status: string; total: number }>;
  });

export const getHiringTrends = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("get_hiring_trends");
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ org_id: string; week: string; scheduled: number; completed: number; hired: number }>;
  });

export const getIntegritySummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("get_integrity_summary");
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ org_id: string; total_interviews: number; avg_integrity: number | null; flagged: number }>;
  });
