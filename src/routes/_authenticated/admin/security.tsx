import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, Icon } from "@/components/admin/AdminShell";
import { EmptyState } from "@/components/shared/EmptyState";
import { listErrorEvents } from "@/lib/observability.functions";
import { listAuditEvents } from "@/lib/governance.functions";

export const Route = createFileRoute("/_authenticated/admin/security")({
  component: SecurityPage,
});

type ErrorRow = { id: string; org_id: string | null; source: string | null; level: string | null; message: string; request_id: string | null; created_at: string };
type AuditRow = { id: string; actor_id: string | null; entity_type: string; entity_id: string; action: string; created_at: string };

const LEVEL_TONE: Record<string, string> = {
  fatal: "bg-error-container text-on-error-container",
  error: "bg-error-container text-on-error-container",
  warn: "bg-warning-container text-on-warning-container",
  info: "bg-surface-container text-on-surface-variant",
  debug: "bg-surface-container text-on-surface-variant",
};

function SecurityPage() {
  const errFn = useServerFn(listErrorEvents);
  const auditFn = useServerFn(listAuditEvents);
  const errQ = useQuery({ queryKey: ["admin", "errors"], queryFn: () => errFn({ data: { limit: 50 } }) });
  const auditQ = useQuery({ queryKey: ["admin", "audit"], queryFn: () => auditFn({ data: { limit: 50 } }) });

  const errors = (errQ.data as ErrorRow[] | undefined) ?? [];
  const audit = (auditQ.data as AuditRow[] | undefined) ?? [];
  const [lvl, setLvl] = useState<"all" | "info" | "warn" | "error" | "fatal">("all");
  const filtered = errors.filter((e) => lvl === "all" || (e.level ?? "info") === lvl);

  const errors24h = errors.filter((e) => Date.now() - new Date(e.created_at).getTime() < 86_400_000).length;
  const fatalCount = errors.filter((e) => e.level === "fatal" || e.level === "error").length;

  return (
    <div className="space-y-lg">
      <header>
        <h1 className="text-headline-lg font-headline-lg text-on-surface">Security & Observability</h1>
        <p className="text-body-lg text-on-surface-variant">Error events and admin audit history from the last batch.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
        {[
          { label: "Errors (24h)", value: errors24h, icon: "report", tone: "warning" },
          { label: "Error/fatal (recent)", value: fatalCount, icon: "error", tone: "error" },
          { label: "Audit events (recent)", value: audit.length, icon: "history", tone: "default" },
          { label: "Error sources", value: new Set(errors.map((e) => e.source ?? "unknown")).size, icon: "category", tone: "default" },
        ].map((k) => (
          <Card key={k.label} className="p-md">
            <div className="flex items-center justify-between">
              <span className="text-body-md text-on-surface-variant">{k.label}</span>
              <Icon name={k.icon} className={
                k.tone === "warning" ? "text-warning" :
                k.tone === "error" ? "text-error" : "text-primary"
              } />
            </div>
            <p className="text-headline-md font-headline-md mt-2 text-on-surface">{k.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-lg">
        <Card className="p-lg">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 mb-md sm:flex sm:flex-wrap sm:justify-between">
            <h3 className="text-headline-sm font-headline-sm text-on-surface">Error events</h3>
            <div className="flex gap-1">
              {(["all", "info", "warn", "error", "fatal"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setLvl(s)} className={`px-2 py-1 rounded-full text-label-caps capitalize ${lvl === s ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"}`}>{s}</button>
              ))}
            </div>
          </div>
          {errQ.isLoading ? (
            <p className="text-on-surface-variant">Loading errors…</p>
          ) : filtered.length === 0 ? (
            <EmptyState icon="security" title="No events" description="No error events match this level." />
          ) : (
            <ul className="space-y-2 max-h-[480px] overflow-y-auto">
              {filtered.map((e) => (
                <li key={e.id} className="p-3 rounded-lg border border-outline-variant">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-body-md font-semibold text-on-surface truncate">{e.source ?? "unknown"}</p>
                    <span className={`text-label-caps font-semibold px-2 py-1 rounded-full capitalize ${LEVEL_TONE[e.level ?? "info"] ?? LEVEL_TONE.info}`}>{e.level ?? "info"}</span>
                  </div>
                  <p className="text-body-md text-on-surface-variant break-words">{e.message}</p>
                  <p className="text-label-caps text-on-surface-variant mt-1">{new Date(e.created_at).toLocaleString()}{e.request_id ? ` · ${e.request_id.slice(0, 8)}` : ""}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-lg">
          <h3 className="text-headline-sm font-headline-sm text-on-surface mb-md">Audit log</h3>
          {auditQ.isLoading ? (
            <p className="text-on-surface-variant">Loading audit history…</p>
          ) : audit.length === 0 ? (
            <EmptyState icon="history" title="No audit events" description="Admin actions will be logged here." />
          ) : (
            <ul className="divide-y divide-outline-variant max-h-[480px] overflow-y-auto">
              {audit.map((a) => (
                <li key={a.id} className="py-3 flex gap-3">
                  <Icon name="history" className="text-on-surface-variant mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-body-md text-on-surface truncate"><span className="font-semibold">{a.action}</span> on <span className="text-on-surface-variant">{a.entity_type}</span></p>
                    <p className="text-body-md text-on-surface-variant truncate">{a.entity_id} · {new Date(a.created_at).toLocaleString()}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
