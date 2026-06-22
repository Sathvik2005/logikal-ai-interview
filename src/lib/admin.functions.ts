import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

export const listOrganizations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { data: orgs, error } = await context.supabase
      .from("organizations")
      .select("id, name, industry, size, status, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (orgs ?? []).map((o) => o.id);
    if (ids.length === 0) return [] as OrgDTO[];
    const [{ data: cands }, { data: ivs }] = await Promise.all([
      context.supabase.from("candidates").select("org_id").in("org_id", ids).is("deleted_at", null),
      context.supabase.from("interviews").select("org_id").in("org_id", ids).is("deleted_at", null),
    ]);
    const cCount = new Map<string, number>();
    const iCount = new Map<string, number>();
    (cands ?? []).forEach((c) => { if (c.org_id) cCount.set(c.org_id, (cCount.get(c.org_id) ?? 0) + 1); });
    (ivs ?? []).forEach((i) => { if (i.org_id) iCount.set(i.org_id, (iCount.get(i.org_id) ?? 0) + 1); });
    return (orgs ?? []).map((o) => ({
      id: o.id,
      name: o.name,
      industry: o.industry,
      size: o.size,
      status: o.status ?? "active",
      createdAt: o.created_at,
      candidateCount: cCount.get(o.id) ?? 0,
      interviewCount: iCount.get(o.id) ?? 0,
    } satisfies OrgDTO));
  });

export const getOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { data: o, error } = await context.supabase
      .from("organizations")
      .select("id, name, industry, size, status, created_at")
      .eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!o) throw new Error("Organization not found");
    const [{ count: cc }, { count: ic }, { count: uc }] = await Promise.all([
      context.supabase.from("candidates").select("id", { count: "exact", head: true }).eq("org_id", data.id).is("deleted_at", null),
      context.supabase.from("interviews").select("id", { count: "exact", head: true }).eq("org_id", data.id).is("deleted_at", null),
      context.supabase.from("profiles").select("id", { count: "exact", head: true }).eq("org_id", data.id),
    ]);
    return {
      id: o.id, name: o.name, industry: o.industry, size: o.size, status: o.status ?? "active",
      createdAt: o.created_at,
      candidateCount: cc ?? 0, interviewCount: ic ?? 0, userCount: uc ?? 0,
    };
  });

export const updateOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    id: z.string().uuid(),
    name: z.string().optional(),
    industry: z.string().optional().nullable(),
    size: z.string().optional().nullable(),
    status: z.string().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { id, ...rest } = data;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) patch[k] = v;
    const { error } = await context.supabase
      .from("organizations").update(patch as never).eq("id", id);
    if (error) throw new Error(error.message);
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
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
    const from7 = new Date(); from7.setHours(0, 0, 0, 0); from7.setDate(from7.getDate() - 6);
    const from24h = new Date(); from24h.setHours(from24h.getHours() - 24);
    const [{ count: oc }, { count: cc }, { count: imo }, { data: trendIvs }, { count: ec }] = await Promise.all([
      context.supabase.from("organizations").select("id", { count: "exact", head: true }),
      context.supabase.from("candidates").select("id", { count: "exact", head: true }).is("deleted_at", null),
      context.supabase.from("interviews").select("id", { count: "exact", head: true })
        .is("deleted_at", null).gte("scheduled_at", startOfMonth.toISOString()),
      context.supabase.from("interviews").select("scheduled_at")
        .is("deleted_at", null).gte("scheduled_at", from7.toISOString()),
      context.supabase.from("error_events").select("id", { count: "exact", head: true })
        .gte("created_at", from24h.toISOString()),
    ]);
    const byDay = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(from7); d.setDate(d.getDate() + i);
      byDay.set(d.toISOString().slice(0, 10), 0);
    }
    (trendIvs ?? []).forEach((i) => {
      if (!i.scheduled_at) return;
      const day = i.scheduled_at.slice(0, 10);
      if (byDay.has(day)) byDay.set(day, (byDay.get(day) ?? 0) + 1);
    });
    return {
      orgCount: oc ?? 0,
      candidateCount: cc ?? 0,
      interviewsThisMonth: imo ?? 0,
      errorCount24h: ec ?? 0,
      trend: Array.from(byDay.entries()).map(([day, count]) => ({ day: day.slice(5), count })),
    } satisfies AdminDashboardDTO;
  });
