import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";

const QuestionItem = z.object({
  prompt: z.string().trim().min(4).max(4000),
  category: z.string().trim().max(60).default("Technical"),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  mandatory: z.boolean().default(false),
  hints: z.array(z.string().trim().max(400)).max(20).default([]),
});
export type QuestionItemDTO = z.input<typeof QuestionItem>;

const BulkUpsert = z.object({
  bankName: z.string().trim().min(2).max(120),
  competency: z.string().trim().min(2).max(120),
  questions: z.array(QuestionItem).min(1).max(200),
});

function getBackendUrl(): string {
  return process.env.BACKEND_URL || "http://localhost:3000";
}

function getAuthHeader(): Record<string, string> {
  const request = getRequest();
  const auth = request?.headers?.get("authorization");
  return auth ? { Authorization: auth } : {};
}

export const bulkUpsertQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BulkUpsert.parse(d))
  .handler(async ({ data }) => {
    // Map questions to match NestJS expectations
    const mappedQuestions = data.questions.map((q) => ({
      competency: data.competency,
      difficulty: q.difficulty,
      type: "open",
      prompt: q.prompt,
      expectedSignals: q.hints,
    }));

    const res = await fetch(`${getBackendUrl()}/api/questions/bulk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({ questions: mappedQuestions }),
    });

    if (!res.ok) {
      throw new Error(`Failed to bulk import questions: ${res.statusText}`);
    }

    return await res.json();
  });

const ParsePdf = z.object({
  filename: z.string().max(200),
  base64: z.string().min(10),
});

export const parseQuestionsFromPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ParsePdf.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
    const dataUrl = data.base64.startsWith("data:")
      ? data.base64
      : `data:application/pdf;base64,${data.base64}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You extract interview questions from documents and return STRICT JSON. Output schema: {\"questions\":[{\"prompt\":string,\"category\":\"Technical\"|\"Behavioral\"|\"Compliance\"|\"Situational\"|\"Coding\",\"difficulty\":\"easy\"|\"medium\"|\"hard\",\"mandatory\":boolean,\"hints\":string[]}]}. Return ONLY JSON, no prose.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract every distinct interview question from this PDF." },
              { type: "file", file: { filename: data.filename, file_data: dataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429) throw new Error("AI rate limit reached. Try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
      throw new Error(`PDF parse failed: ${res.status} ${txt.slice(0, 200)}`);
    }
    const j = await res.json();
    const txt = j.choices?.[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try { parsed = JSON.parse(txt); } catch { parsed = {}; }
    const list = (parsed as { questions?: unknown }).questions;
    if (!Array.isArray(list)) return { questions: [] as QuestionItemDTO[] };

    type ParsedQ = { prompt: string; category: string; difficulty: "easy" | "medium" | "hard"; mandatory: boolean; hints: string[] };
    const out: ParsedQ[] = list
      .map((q: unknown): ParsedQ | null => {
        const o = q as Record<string, unknown>;
        const promptStr = typeof o.prompt === "string" ? o.prompt.trim() : "";
        if (!promptStr) return null;
        const cat = typeof o.category === "string" ? o.category : "Technical";
        const diff = (typeof o.difficulty === "string" ? o.difficulty.toLowerCase() : "medium");
        return {
          prompt: promptStr.slice(0, 4000),
          category: cat.slice(0, 60),
          difficulty: (["easy", "medium", "hard"].includes(diff) ? diff : "medium") as "easy" | "medium" | "hard",
          mandatory: Boolean(o.mandatory),
          hints: Array.isArray(o.hints) ? (o.hints as unknown[]).filter((h) => typeof h === "string").slice(0, 10) as string[] : [],
        };
      })
      .filter((q): q is ParsedQ => q !== null)
      .slice(0, 200);

    return { questions: out };
  });
