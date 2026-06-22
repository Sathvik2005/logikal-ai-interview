import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";

const ExportInput = z.object({ interviewId: z.string().uuid() });

function getBackendUrl(): string {
  return process.env.BACKEND_URL || "http://localhost:3000";
}

function getAuthHeader(): Record<string, string> {
  const request = getRequest();
  const auth = request?.headers?.get("authorization");
  return auth ? { Authorization: auth } : {};
}

export const exportInterviewReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ExportInput.parse(input))
  .handler(async ({ data, context }) => {
    // 1. Fetch interview details from NestJS
    const res = await fetch(`${getBackendUrl()}/api/interviews/${data.interviewId}/evaluation`, {
      headers: {
        ...getAuthHeader(),
      },
    });
    if (!res.ok) throw new Error("Failed to fetch interview details from backend.");
    const interview = await res.json();
    if (!interview) throw new Error("Interview evaluation details not found.");

    // 2. Fetch candidate details from NestJS
    const candRes = await fetch(`${getBackendUrl()}/api/candidates/${interview.candidate_id}`, {
      headers: {
        ...getAuthHeader(),
      },
    });
    if (!candRes.ok) throw new Error("Failed to fetch candidate details from backend.");
    const candidate = await candRes.json();

    // Render PDF with pdf-lib (Worker-safe)
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([612, 792]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    let y = 750;
    const draw = (txt: string, opts?: { size?: number; bold?: boolean }) => {
      page.drawText(txt, {
        x: 50,
        y,
        size: opts?.size ?? 11,
        font: opts?.bold ? bold : font,
        color: rgb(0.1, 0.1, 0.15),
      });
      y -= (opts?.size ?? 11) + 6;
    };

    draw("Interview Evaluation Report", { size: 20, bold: true });
    y -= 8;
    draw(`Candidate: ${candidate?.full_name ?? "—"}`, { bold: true });
    draw(`Email: ${candidate?.email ?? "—"}`);
    draw(`Role: ${candidate?.role_applied ?? "—"}`);
    draw(`Interview ID: ${interview.id}`);
    draw(`Scheduled: ${interview.scheduled_at ?? "—"}`);
    draw(`Duration: ${interview.duration_minutes ?? "—"} min`);
    y -= 10;
    draw("Scores", { size: 14, bold: true });
    draw(`Overall Score: ${interview.overall_score ?? "—"}`);
    draw(`Recommendation: ${interview.recommendation ?? "—"}`);
    draw(`Integrity Score: ${interview.integrity_score ?? "—"}`);
    y -= 10;
    draw("Evaluation", { size: 14, bold: true });

    const evalStr = JSON.stringify(interview.evaluation ?? {}, null, 2);
    for (const line of evalStr.split("\n").slice(0, 60)) {
      if (y < 60) break;
      draw(line.slice(0, 95), { size: 9 });
    }

    const bytes = await pdf.save();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `${interview.org_id}/${interview.id}-${Date.now()}.pdf`;

    // Ensure bucket exists (idempotent)
    await supabaseAdmin.storage.createBucket("reports", { public: false }).catch(() => undefined);

    const { error: upErr } = await supabaseAdmin.storage
      .from("reports")
      .upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (upErr) throw new Error(upErr.message);

    if (!interview.org_id) throw new Error("Interview missing org");
    const { error: insErr } = await supabaseAdmin.from("report_exports").insert({
      org_id: interview.org_id,
      requested_by: context.userId,
      kind: "interview",
      entity_id: interview.id,
      storage_path: path,
      status: "ready",
    });
    if (insErr) throw new Error(insErr.message);

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("reports")
      .createSignedUrl(path, 60 * 10);
    if (signErr) throw new Error(signErr.message);

    return { url: signed.signedUrl, path };
  });

const SignInput = z.object({ path: z.string().min(1) });

export const getReportSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SignInput.parse(input))
  .handler(async ({ data, context }) => {
    // Verify caller has access to this export via RLS
    const { data: row, error } = await context.supabase
      .from("report_exports")
      .select("storage_path")
      .eq("storage_path", data.path)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("reports")
      .createSignedUrl(data.path, 60 * 10);
    if (signErr) throw new Error(signErr.message);
    return { url: signed.signedUrl };
  });
