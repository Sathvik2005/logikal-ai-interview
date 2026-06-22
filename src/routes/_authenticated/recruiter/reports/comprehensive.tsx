import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { Icon, SkeletonCard } from "@/components/recruiter/RecruiterShell";
import { StatCard } from "@/components/shared/StatCard";
import { scoreColor, fmtDate } from "@/components/recruiter/mock-data";
import { listReports, type ReportListItem } from "@/lib/reports-list.functions";

export const Route = createFileRoute("/_authenticated/recruiter/reports/comprehensive")({
  component: Comprehensive,
});

function Comprehensive() {
  const fn = useServerFn(listReports);
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "list"],
    queryFn: () => fn({}),
  });
  const reports = (data as ReportListItem[] | undefined) ?? [];
  const [search, setSearch] = useState("");
  const [recFilter, setRecFilter] = useState("all");
  const [sortKey, setSortKey] = useState<"score" | "integrityScore" | "candidateName">("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const completed = reports.filter((r) => r.status === "completed");
  const scored = completed.filter((r) => r.score != null);
  const integrityScored = completed.filter((r) => r.integrityScore != null);

  const stats = useMemo(() => ({
    total: reports.length,
    completed: completed.length,
    inProgress: reports.filter((r) => r.status === "in_progress").length,
    strongHire: completed.filter((r) => r.recommendation === "strong_hire").length,
    hire: completed.filter((r) => r.recommendation === "hire").length,
    maybe: completed.filter((r) => r.recommendation === "maybe").length,
    reject: completed.filter((r) => r.recommendation === "reject").length,
    avgScore: scored.length ? Math.round(scored.reduce((a, r) => a + r.score!, 0) / scored.length) : null,
    avgInteg: integrityScored.length ? Math.round(integrityScored.reduce((a, r) => a + r.integrityScore!, 0) / integrityScored.length) : null,
  }), [reports, completed, scored, integrityScored]);

  const ranked = useMemo(() => {
    let rows = [...completed];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) =>
        r.candidateName.toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q) ||
        (r.personaName ?? "").toLowerCase().includes(q)
      );
    }
    if (recFilter !== "all") rows = rows.filter((r) => r.recommendation === recFilter);
    rows.sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      const cmp = Number(av) - Number(bv);
      return sortDir === "desc" ? -cmp : cmp;
    });
    return rows;
  }, [completed, search, recFilter, sortKey, sortDir]);

  if (isLoading) return <SkeletonCard rows={8} />;

  return (
    <>
      <div className="mb-lg flex items-start justify-between gap-md flex-wrap">
        <div>
          <Link to="/recruiter/reports" className="text-primary text-body-md hover:underline inline-flex items-center gap-1 mb-2">
            <Icon name="arrow_back" />Back to Reports
          </Link>
          <h2 className="text-headline-lg text-on-background">Comprehensive Analysis</h2>
          <p className="text-body-lg text-on-surface-variant">Cross-candidate ranking and breakdown for this hiring cycle.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-md mb-lg">
        {[
          { label: "Total", value: stats.total, icon: "description", tone: "default" as const },
          { label: "Completed", value: stats.completed, icon: "check_circle", tone: "success" as const },
          { label: "In Progress", value: stats.inProgress, icon: "pending", tone: "primary" as const },
          { label: "Strong Hire", value: stats.strongHire, icon: "star", tone: "success" as const },
          { label: "Hire", value: stats.hire, icon: "thumb_up", tone: "primary" as const },
          { label: "Maybe", value: stats.maybe, icon: "help", tone: "warning" as const },
          { label: "Reject", value: stats.reject, icon: "cancel", tone: "error" as const },
          { label: "Avg Score", value: stats.avgScore ?? "—", icon: "analytics", tone: "default" as const },
          { label: "Avg Integrity", value: stats.avgInteg != null ? `${stats.avgInteg}%` : "—", icon: "shield", tone: "default" as const },
        ].map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} tone={s.tone} />
        ))}
      </div>

      {completed.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-soft py-20 flex flex-col items-center text-center px-lg">
          <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[32px] text-on-surface-variant">leaderboard</span>
          </div>
          <h3 className="text-headline-sm text-on-surface mb-2">No Completed Interviews</h3>
          <p className="text-body-md text-on-surface-variant max-w-md">
            The ranking table will populate once candidates complete their interviews and evaluations are generated.
          </p>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="filter-bar mb-md">
            <div className="relative flex-1 min-w-[200px]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search candidates, roles…"
                className="w-full pl-9 pr-4 py-2 bg-surface border border-outline-variant rounded-lg text-body-md outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>
            <select
              value={recFilter}
              onChange={(e) => setRecFilter(e.target.value)}
              className="px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-md"
            >
              <option value="all">All Recommendations</option>
              <option value="strong_hire">Strong Hire</option>
              <option value="hire">Hire</option>
              <option value="maybe">Maybe</option>
              <option value="reject">Reject</option>
            </select>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
              className="px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-md"
            >
              <option value="score">Sort by Score</option>
              <option value="integrityScore">Sort by Integrity</option>
              <option value="candidateName">Sort by Name</option>
            </select>
            <button
              type="button"
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              className="px-3 py-2 border border-outline-variant rounded-lg inline-flex items-center gap-1 hover:bg-surface-container-low text-body-md"
            >
              <span className="material-symbols-outlined text-[18px]">{sortDir === "asc" ? "arrow_upward" : "arrow_downward"}</span>
              {sortDir === "asc" ? "Ascending" : "Descending"}
            </button>
            <span className="text-label-caps uppercase text-on-surface-variant ml-auto">
              {ranked.length} candidate{ranked.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Ranking table */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-soft overflow-hidden">
            <div className="p-lg border-b border-outline-variant flex items-center justify-between">
              <h3 className="text-headline-sm text-on-background">Candidate Ranking</h3>
              <span className="text-label-caps uppercase text-on-surface-variant">{ranked.length} evaluated</span>
            </div>
            <div className="w-full overflow-x-auto">
              <table className="w-full text-body-md" style={{ minWidth: "700px" }}>
                <thead className="bg-surface-container-low text-label-caps uppercase text-on-surface-variant">
                  <tr>
                    <th className="text-left p-4 border-b border-outline-variant">Rank</th>
                    <th className="text-left p-4 border-b border-outline-variant">Candidate</th>
                    <th className="text-left p-4 border-b border-outline-variant">Role</th>
                    <th className="text-left p-4 border-b border-outline-variant">Persona</th>
                    <th className="text-left p-4 border-b border-outline-variant">Date</th>
                    <th className="text-left p-4 border-b border-outline-variant">Score</th>
                    <th className="text-left p-4 border-b border-outline-variant">Integrity</th>
                    <th className="text-left p-4 border-b border-outline-variant">Recommendation</th>
                    <th className="p-4 border-b border-outline-variant" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/60">
                  {ranked.map((r, i) => (
                    <tr key={r.id} className="hover:bg-surface-container-low/70 transition">
                      <td className="p-4">
                        <span className={`font-bold text-headline-sm ${i === 0 ? "text-[#854d0e]" : i === 1 ? "text-on-surface-variant" : i === 2 ? "text-[#7e3000]" : "text-on-surface-variant"}`}>
                          #{i + 1}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-semibold text-label-caps shrink-0">
                            {r.candidateName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                          </div>
                          <span className="font-semibold text-on-surface">{r.candidateName}</span>
                        </div>
                      </td>
                      <td className="p-4 text-on-surface-variant">{r.role}</td>
                      <td className="p-4 text-on-surface-variant">{r.personaName}</td>
                      <td className="p-4 text-on-surface-variant whitespace-nowrap">{r.scheduledAt ? fmtDate(r.scheduledAt) : "—"}</td>
                      <td className={`p-4 font-bold text-data-mono ${r.score != null ? scoreColor(r.score) : "text-on-surface-variant"}`}>
                        {r.score != null ? Math.round(r.score) : "—"}
                      </td>
                      <td className={`p-4 font-bold text-data-mono ${r.integrityScore != null ? scoreColor(r.integrityScore) : "text-on-surface-variant"}`}>
                        {r.integrityScore != null ? `${Math.round(r.integrityScore)}%` : "—"}
                      </td>
                      <td className="p-4">
                        {r.recommendation ? (
                          <span className={`px-2.5 py-1 rounded-full text-label-caps font-semibold ${
                            r.recommendation === "strong_hire" ? "badge-strong-hire" :
                            r.recommendation === "hire" ? "badge-hire" :
                            r.recommendation === "maybe" ? "badge-maybe" :
                            r.recommendation === "reject" ? "badge-reject" :
                            "bg-surface-container text-on-surface"
                          }`}>
                            {r.recommendation.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                          </span>
                        ) : <span className="text-on-surface-variant italic">—</span>}
                      </td>
                      <td className="p-4 text-right">
                        <Link
                          to="/recruiter/reports/$interviewId"
                          params={{ interviewId: r.id }}
                          className="text-primary hover:underline text-body-md inline-flex items-center gap-1"
                        >
                          Open Report <Icon name="arrow_forward" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
