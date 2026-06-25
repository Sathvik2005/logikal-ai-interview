import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";

export type PersonaDTO = {
  id: string;
  name: string;
  personaType: string | null;
  tone: string | null;
  difficulty: string | null;
  prompt: string | null;
  interviewCount: number;
  createdAt: string;
  versionId?: string | null;
};

type Row = {
  id: string;
  name: string;
  persona_type: string | null;
  tone: string | null;
  difficulty: string | null;
  prompt: string | null;
  created_at: string;
};

function map(r: Row, count = 0): PersonaDTO {
  return {
    id: r.id,
    name: r.name,
    personaType: r.persona_type,
    tone: r.tone,
    difficulty: r.difficulty,
    prompt: r.prompt,
    interviewCount: count,
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

export const listPersonas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const res = await fetch(`${getBackendUrl()}/api/personas`, {
      headers: {
        ...getAuthHeader(),
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to list personas: ${res.statusText}`);
    }

    const rows = (await res.json()) as Row[];
    return rows.map((r) => map(r, 0));
  });

export const getPersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/personas/${data.id}`, {
      headers: {
        ...getAuthHeader(),
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch persona: ${res.statusText}`);
    }

    const row = (await res.json()) as Row | null;
    if (!row) throw new Error("Persona not found");
    return map(row);
  });

const UpsertInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(120),
  personaType: z.string().max(40).optional().nullable(),
  tone: z.string().max(60).optional().nullable(),
  difficulty: z.string().max(20).optional().nullable(),
  prompt: z.string().max(20000).optional().nullable(),
});

export const upsertPersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpsertInput.parse(input))
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/personas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(`Failed to upsert persona: ${res.statusText}`);
    }

    const row = (await res.json()) as Row;
    return map(row);
  });

export const deletePersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    // Soft/hard delete via manual patch
    const res = await fetch(`${getBackendUrl()}/api/personas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({ id: data.id, deleted: true }),
    });

    if (!res.ok) {
      throw new Error(`Failed to delete persona: ${res.statusText}`);
    }

    return { ok: true };
  });

// ---------- generate prompt ----------
const GeneratePromptInput = z.object({
  name: z.string().trim().min(1),
  role: z.string().trim().min(1),
  domain: z.string().trim().min(1),
  style: z.string().trim().min(1),
  strictness: z.string().trim().min(1),
  tone: z.string().trim().min(1),
  difficulty: z.string().trim().min(1),
  responsibilities: z.string().trim().min(1),
});

export const generatePersonaPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GeneratePromptInput.parse(input))
  .handler(async ({ data }) => {
    const res = await fetch(`${getBackendUrl()}/api/personas/generate-prompt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(`Failed to generate persona prompt: ${res.statusText}`);
    }

    const result = (await res.json()) as { promptText: string };
    return result.promptText;
  });
