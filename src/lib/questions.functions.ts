import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type QuestionDTO = {
  id: string;
  competency: string;
  difficulty: string;
  type: string;
  prompt: string;
  expectedSignals: string[];
  createdAt: string;
};

export type QuestionBankDTO = {
  competency: string;
  count: number;
  difficulties: string[];
};

type Row = {
  id: string;
  competency: string | null;
  difficulty: string | null;
  type: string | null;
  prompt: string;
  expected_signals: unknown;
  created_at: string;
};

function mapRow(r: Row): QuestionDTO {
  const signals = Array.isArray(r.expected_signals) ? (r.expected_signals as string[]) : [];
  return {
    id: r.id,
    competency: r.competency ?? "General",
    difficulty: r.difficulty ?? "medium",
    type: r.type ?? "open",
    prompt: r.prompt,
    expectedSignals: signals,
    createdAt: r.created_at,
  };
}

export const listQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ competency: z.string().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("questions")
      .select("id, competency, difficulty, type, prompt, expected_signals, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (data.competency) q = q.eq("competency", data.competency);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return ((rows ?? []) as Row[]).map(mapRow);
  });

export const listQuestionBanks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("questions")
      .select("competency, difficulty")
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
    const map = new Map<string, { count: number; difficulties: Set<string> }>();
    (rows ?? []).forEach((r: { competency: string | null; difficulty: string | null }) => {
      const key = r.competency ?? "General";
      const entry = map.get(key) ?? { count: 0, difficulties: new Set<string>() };
      entry.count += 1;
      if (r.difficulty) entry.difficulties.add(r.difficulty);
      map.set(key, entry);
    });
    const banks: QuestionBankDTO[] = Array.from(map.entries()).map(([competency, v]) => ({
      competency,
      count: v.count,
      difficulties: Array.from(v.difficulties),
    }));
    return banks.sort((a, b) => b.count - a.count);
  });

const UpsertInput = z.object({
  id: z.string().uuid().optional(),
  competency: z.string().min(1).max(120),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  type: z.string().max(40).default("open"),
  prompt: z.string().min(4).max(4000),
  expectedSignals: z.array(z.string()).max(20).default([]),
});

export const upsertQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpsertInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("org_id")
      .eq("id", context.userId)
      .maybeSingle();
    const orgId = prof?.org_id;
    if (!orgId) throw new Error("Missing organization");
    const payload: Record<string, unknown> = {
      competency: data.competency,
      difficulty: data.difficulty,
      type: data.type,
      prompt: data.prompt,
      expected_signals: data.expectedSignals,
    };

    let row: Row | null = null;
    const auditAction = data.id ? "update" : "create";

    if (data.id) {
      const { data: updated, error } = await context.supabase
        .from("questions")
        .update(payload as never)
        .eq("id", data.id)
        .select("id, competency, difficulty, type, prompt, expected_signals, created_at")
        .maybeSingle();
      if (error) throw new Error(error.message);
      row = updated as Row;
    } else {
      const insertPayload = { ...payload, org_id: orgId, created_by: context.userId };
      const { data: inserted, error } = await context.supabase
        .from("questions")
        .insert(insertPayload as never)
        .select("id, competency, difficulty, type, prompt, expected_signals, created_at")
        .maybeSingle();
      if (error) throw new Error(error.message);
      row = inserted as Row;
    }

    if (!row) throw new Error("Question upsert failed");

    // Write audit log
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_events").insert({
      org_id: orgId,
      actor_id: context.userId,
      entity_type: "question",
      entity_id: row.id,
      action: auditAction,
      diff: payload as never,
    });

    return mapRow(row as Row);
  });

export const deleteQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("org_id")
      .eq("id", context.userId)
      .maybeSingle();
    const orgId = prof?.org_id;
    if (!orgId) throw new Error("Missing organization");

    const { error } = await context.supabase
      .from("questions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // Write audit log
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_events").insert({
      org_id: orgId,
      actor_id: context.userId,
      entity_type: "question",
      entity_id: data.id,
      action: "delete",
      diff: { deleted_at: new Date().toISOString() } as never,
    });

    return { ok: true };
  });
