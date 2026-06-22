import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ListAuditInput = z.object({
  limit: z.number().int().min(1).max(200).default(50),
  entityType: z.string().optional(),
});

export const listAuditEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListAuditInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    let q = context.supabase
      .from("audit_events")
      .select("id, org_id, actor_id, entity_type, entity_id, action, diff, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.entityType) q = q.eq("entity_type", data.entityType);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const requestDataExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [profile, candidates, interviews] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("candidates").select("*").eq("user_id", userId),
      supabaseAdmin
        .from("interviews")
        .select("*")
        .in(
          "candidate_id",
          (
            await supabaseAdmin.from("candidates").select("id").eq("user_id", userId)
          ).data?.map((c) => c.id) ?? [],
        ),
    ]);

    const bundle = {
      generatedAt: new Date().toISOString(),
      profile: profile.data,
      candidates: candidates.data,
      interviews: interviews.data,
    };

    const path = `gdpr/${userId}-${Date.now()}.json`;
    const bytes = new TextEncoder().encode(JSON.stringify(bundle, null, 2));
    await supabaseAdmin.storage.from("reports").upload(path, bytes, {
      contentType: "application/json",
      upsert: false,
    });
    const { data: signed } = await supabaseAdmin.storage
      .from("reports")
      .createSignedUrl(path, 60 * 60);

    const { data: row, error } = await supabaseAdmin
      .from("gdpr_requests")
      .insert({
        user_id: userId,
        kind: "export",
        status: "ready",
        storage_path: path,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return { id: row.id, url: signed?.signedUrl ?? null, path };
  });

export const requestAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("gdpr_requests").insert({
      user_id: context.userId,
      kind: "deletion",
      status: "pending",
    });
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });
