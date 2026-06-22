import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";

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

function getBackendUrl(): string {
  return process.env.BACKEND_URL || "http://localhost:3000";
}

function getAuthHeader(): Record<string, string> {
  const request = getRequest();
  const auth = request?.headers?.get("authorization");
  return auth ? { Authorization: auth } : {};
}

export const listQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ competency: z.string().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    let url = `${getBackendUrl()}/api/questions`;
    if (data.competency) {
      url += `?competency=${encodeURIComponent(data.competency)}`;
    }
    const res = await fetch(url, {
      headers: {
        ...getAuthHeader(),
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to list questions: ${res.statusText}`);
    }
    const rows = (await res.json()) as Row[];
    return rows.map(mapRow);
  });

export const listQuestionBanks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const res = await fetch(`${getBackendUrl()}/api/questions`, {
      headers: {
        ...getAuthHeader(),
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch questions for bank: ${res.statusText}`);
    }
    const rows = (await res.json()) as Row[];
    const map = new Map<string, { count: number; difficulties: Set<string> }>();
    rows.forEach((r) => {
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
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/questions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new Error(`Failed to upsert question: ${res.statusText}`);
    }
    const row = (await res.json()) as Row;
    return mapRow(row);
  });

export const deleteQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/questions/${data.id}`, {
      method: "DELETE",
      headers: {
        ...getAuthHeader(),
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to delete question: ${res.statusText}`);
    }
    return { ok: true };
  });
