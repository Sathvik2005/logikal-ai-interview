import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CardShadow, Icon, SkeletonCard } from "@/components/recruiter/RecruiterShell";
import {
  getCompletionRates,
  getHiringTrends,
  getIntegritySummary,
} from "@/lib/analytics-extra.functions";
import {
  getTimeToHire,
  getRecruiterFunnel,
  getPersonaEffectiveness,
  refreshAnalytics,
} from "@/lib/analytics.functions";

export const Route = createFileRoute("/_authenticated/recruiter/analytics/")({
  component: Analytics,
});

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
}

function download(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function Analytics() {
  const completionsFn = useServerFn(getCompletionRates);
  const trendsFn = useServerFn(getHiringTrends);
  const integrityFn = useServerFn(getIntegritySummary);
  const tthFn = useServerFn(getTimeToHire);
  const funnelFn = useServerFn(getRecruiterFunnel);
  const personasFn = useServerFn(getPersonaEffectiveness);
  const refreshFn = useServerFn(refreshAnalytics);

  const completions = useQuery({ queryKey: ["a", "completions"], queryFn: () => completionsFn({}) });
  const trends = useQuery({ queryKey: ["a", "trends"], queryFn: () => trendsFn({}) });
  const integrity = useQuery({ queryKey: ["a", "integrity"], queryFn: () => integrityFn({}) });
  const tth = useQuery({ queryKey: ["a", "tth"], queryFn: () => tthFn({}) });
  const funnel = useQuery({ queryKey: ["a", "funnel"], queryFn: () => funnelFn({}) });
  const personas = useQuery({ queryKey: ["a", "personas"], queryFn: () => personasFn({}) });

  const tthRows = tth.data ?? [];
  const avgDays = tthRows.length
    ? Math.round((tthRows.reduce((a, r) => a + Number(r.days_to_hire ?? 0), 0) / tthRows.length) * 10) / 10
    : null;

  const completed = (completions.data ?? []).reduce((a, r) => a + (r.status === "completed" ? Number(r.total) : 0), 0);
  const totalInterviews = (completions.data ?? []).reduce((a, r) => a + Number(r.total), 0);
  const completionRate = totalInterviews ? Math.round((completed / totalInterviews) * 100) : 0;

  const integSummary = (integrity.data ?? [])[0];
  const avgIntegrity = integSummary?.avg_integrity != null ? Math.round(Number(integSummary.avg_integrity)) : null;
  const flagged = integSummary?.flagged ?? 0;

  const trendRows = trends.data ?? [];
  const maxTrend = Math.max(1, ...trendRows.map((r) => Number(r.scheduled)));

  const funnelAgg = (funnel.data ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + Number(r.total);
    return acc;
  }, {});
  const funnelOrder = ["scheduled", "in_progress", "completed", "evaluation_pending"];
  const funnelTotal = Object.values(funnelAgg).reduce((a, b) => a + b, 0) || 1;

  async function refresh() {
    await refreshFn({});
    completions.refetch(); trends.refetch(); integrity.refetch();
    tth.refetch(); funnel.refetch(); personas.refetch();
  }

  function exportAll() {
    const blob = [
      "# Completion rates", toCsv(completions.data ?? []), "",
      "# Hiring trends", toCsv(trendRows as never), "",
      "# Time to hire", toCsv(tthRows as never), "",
      "# Persona effectiveness", toCsv((personas.data ?? []) as never), "",
    ].join("\n");
    download(`analytics-${new Date().toISOString().slice(0, 10)}.csv`, blob);
  }

  return (
    <>
      <div className="mb-lg flex flex-wrap items-start justify-between gap-md">
        <div>
          <h2 className="text-headline-lg">Recruiter Analytics</h2>
          <p className="text-body-lg text-on-surface-variant">Operational and quality metrics across your hiring funnel.</p>
        </div>
        <div className="flex gap-sm">
          <button onClick={refresh} className="px-3 py-2 border border-outline-variant rounded-lg inline-flex items-center gap-2 hover:bg-surface-container-low"><Icon name="refresh" />Refresh</button>
          <button onClick={exportAll} className="px-3 py-2 bg-primary text-on-primary rounded-lg inline-flex items-center gap-2 hover:brightness-110"><Icon name="download" />Export CSV</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-md mb-lg">
        <CardShadow className="p-lg">
          <p className="text-label-caps uppercase text-on-surface-variant">Avg time-to-hire</p>
          <p className="text-headline-lg mt-1">{tth.isLoading ? "…" : avgDays != null ? `${avgDays} days` : "—"}</p>
          <p className="text-data-mono text-on-surface-variant mt-1">{tthRows.length} hires</p>
        </CardShadow>
        <CardShadow className="p-lg">
          <p className="text-label-caps uppercase text-on-surface-variant">Completion rate</p>
          <p className="text-headline-lg mt-1">{completions.isLoading ? "…" : `${completionRate}%`}</p>
          <p className="text-data-mono text-on-surface-variant mt-1">{completed} / {totalInterviews}</p>
        </CardShadow>
        <CardShadow className="p-lg">
          <p className="text-label-caps uppercase text-on-surface-variant">Avg integrity</p>
          <p className="text-headline-lg mt-1">{integrity.isLoading ? "…" : avgIntegrity != null ? `${avgIntegrity}/100` : "—"}</p>
          <p className="text-data-mono text-on-surface-variant mt-1">{flagged} flagged</p>
        </CardShadow>
        <CardShadow className="p-lg">
          <p className="text-label-caps uppercase text-on-surface-variant">Active personas</p>
          <p className="text-headline-lg mt-1">{personas.isLoading ? "…" : (personas.data ?? []).length}</p>
          <p className="text-data-mono text-on-surface-variant mt-1">scoring candidates</p>
        </CardShadow>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        <CardShadow className="lg:col-span-2 p-lg">
          <h3 className="text-headline-sm mb-md">Funnel conversion</h3>
          {funnel.isLoading ? <SkeletonCard /> : (
            <div className="space-y-md">
              {funnelOrder.map((s) => {
                const n = funnelAgg[s] ?? 0;
                const p = Math.round((n / funnelTotal) * 1000) / 10;
                return (
                  <div key={s}>
                    <div className="flex justify-between text-body-md mb-1"><span className="font-semibold capitalize">{s.replace("_", " ")}</span><span className="text-on-surface-variant">{n} • {p}%</span></div>
                    <div className="w-full h-3 bg-surface-container rounded-full overflow-hidden"><div className="h-full bg-primary" style={{ width: `${p}%` }} /></div>
                  </div>
                );
              })}
              {funnelTotal <= 1 && <p className="text-body-md text-on-surface-variant">No interview activity yet.</p>}
            </div>
          )}
        </CardShadow>

        <CardShadow className="p-lg">
          <h3 className="text-headline-sm mb-md">Persona effectiveness</h3>
          {personas.isLoading ? <SkeletonCard /> : (
            <ul className="space-y-2 text-body-md">
              {(personas.data ?? []).slice(0, 6).map((p) => (
                <li key={p.persona_id} className="flex justify-between gap-2">
                  <span className="truncate">{p.persona_id.slice(0, 8)}…</span>
                  <span className="text-on-surface-variant font-data-mono">{p.completed_count} • {p.avg_score != null ? Math.round(Number(p.avg_score)) : "—"}</span>
                </li>
              ))}
              {(personas.data ?? []).length === 0 && <li className="text-on-surface-variant">No persona stats yet.</li>}
            </ul>
          )}
        </CardShadow>

        <CardShadow className="lg:col-span-3 p-lg">
          <h3 className="text-headline-sm mb-md">Weekly hiring trends</h3>
          {trends.isLoading ? <SkeletonCard /> : trendRows.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">No data in the last 90 days.</p>
          ) : (
            <div className="flex items-end gap-2 h-40 overflow-x-auto">
              {trendRows.map((r) => {
                const h = (Number(r.scheduled) / maxTrend) * 100;
                const hc = (Number(r.completed) / maxTrend) * 100;
                return (
                  <div key={String(r.week)} className="flex flex-col items-center gap-1 min-w-[36px]">
                    <div className="relative w-full h-32 flex items-end">
                      <div className="absolute bottom-0 left-0 w-full bg-primary-container rounded-t" style={{ height: `${h}%` }} />
                      <div className="absolute bottom-0 left-0 w-full bg-primary rounded-t" style={{ height: `${hc}%` }} />
                    </div>
                    <span className="text-[10px] text-on-surface-variant">{String(r.week).slice(5)}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex gap-md mt-2 text-label-caps uppercase text-on-surface-variant">
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 bg-primary-container rounded" />Scheduled</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 bg-primary rounded" />Completed</span>
          </div>
        </CardShadow>

        <CardShadow className="lg:col-span-3 p-lg ai-insight">
          <h3 className="text-headline-sm flex items-center gap-2 mb-2"><Icon name="auto_awesome" className="text-secondary" />AI Insight</h3>
          <p className="text-body-md">
            {avgIntegrity != null && avgIntegrity < 80
              ? `Average integrity score is ${avgIntegrity}/100 with ${flagged} flagged sessions — review proctoring snapshots.`
              : completionRate < 60
              ? `Completion rate is ${completionRate}%. Consider reviewing invitation flow and scheduling buffers.`
              : `Operations look healthy. Completion ${completionRate}%, ${tthRows.length} hires tracked.`}
          </p>
        </CardShadow>
      </div>
    </>
  );
}
