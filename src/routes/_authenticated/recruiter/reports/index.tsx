import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Icon, EmptyState, SkeletonCard } from "@/components/recruiter/RecruiterShell";
import { StatCard } from "@/components/shared/StatCard";
import { scoreColor, fmtDate } from "@/components/recruiter/mock-data";
import { listReports, type ReportListItem } from "@/lib/reports-list.functions";
import {
  listLiveInterviews,
  getMonitorSession,
  type LiveInterviewDTO,
  type MonitorTurn,
  type MonitorEvent,
} from "@/lib/monitor.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/recruiter/reports/")({
  component: ReportsCenter,
});

type Recommendation = "strong_hire" | "hire" | "maybe" | "reject" | null;

function recommendationBadge(rec: string | null) {
  if (!rec) return <span className="text-on-surface-variant italic text-body-md">—</span>;
  const map: Record<string, string> = {
    strong_hire: "badge-strong-hire",
    hire: "badge-hire",
    maybe: "badge-maybe",
    reject: "badge-reject",
    no_hire: "badge-reject",
  };
  const label: Record<string, string> = {
    strong_hire: "Strong Hire",
    hire: "Hire",
    maybe: "Maybe",
    reject: "Reject",
    no_hire: "Reject",
  };
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-label-caps font-semibold ${map[rec] ?? "bg-surface-container text-on-surface"}`}
    >
      {label[rec] ?? rec.replace(/_/g, " ")}
    </span>
  );
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    completed: "bg-[#dcfce7] text-[#166534] border border-[#bbf7d0]",
    in_progress: "bg-[#dbeafe] text-[#1d4ed8] border border-[#bfdbfe]",
    scheduled: "bg-surface-container text-on-surface border border-outline-variant",
    evaluation_pending: "bg-[#fef9c3] text-[#854d0e] border border-[#fef08a]",
  };
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-label-caps font-medium ${map[status] ?? "bg-surface-container text-on-surface"}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function parseIntegritySummary(timeline: any[] | null) {
  const summary = {
    tabSwitches: 0,
    fullscreenExits: 0,
    faceMissing: 0,
    multipleFaces: false,
    backgroundVoice: 0,
    copyPaste: 0,
    devtools: 0,
    screenShareViolations: 0,
  };
  if (!timeline) return summary;
  timeline.forEach((e) => {
    const t = (e.type ?? "").toLowerCase();
    if (t.includes("tab_switch") || t.includes("blur")) summary.tabSwitches++;
    else if (t.includes("fullscreen_exit") || t.includes("fullscreen_change"))
      summary.fullscreenExits++;
    else if (t.includes("face_missing") || t.includes("no_face")) summary.faceMissing++;
    else if (t.includes("multiple_faces") || t.includes("more_than_one_face"))
      summary.multipleFaces = true;
    else if (t.includes("voice") || t.includes("audio") || t.includes("background_voice"))
      summary.backgroundVoice++;
    else if (t.includes("copy") || t.includes("paste")) summary.copyPaste++;
    else if (t.includes("devtools") || t.includes("developer_tools")) summary.devtools++;
    else if (t.includes("screen_share") || t.includes("screen_stop"))
      summary.screenShareViolations++;
  });
  return summary;
}

function exportReportsCSV(reports: ReportListItem[]) {
  const headers = [
    "Candidate",
    "Role",
    "Persona",
    "Recruiter",
    "Date",
    "Overall Score",
    "Integrity Score",
    "Recommendation",
    "Status",
  ];
  const rows = reports.map((r) => [
    r.candidateName,
    r.role ?? "",
    r.personaName ?? "",
    r.recruiterName ?? "",
    r.scheduledAt ? new Date(r.scheduledAt).toLocaleDateString() : "",
    r.score != null ? Math.round(r.score) : "",
    r.integrityScore != null ? Math.round(r.integrityScore) : "",
    r.recommendation ?? "",
    r.status ?? "",
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `recruiter-reports-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Reports exported to CSV.");
}

function exportReportsJSON(reports: ReportListItem[]) {
  const dataStr =
    "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(reports, null, 2));
  const a = document.createElement("a");
  a.setAttribute("href", dataStr);
  a.setAttribute("download", `recruiter-reports-${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast.success("Reports exported to JSON.");
}

const PAGE_SIZE = 12;

function ReportsCenter() {
  const reportsFn = useServerFn(listReports);
  const liveFn = useServerFn(listLiveInterviews);

  const {
    data: reportsData,
    isLoading: reportsLoading,
    error: reportsErr,
    refetch: refetchReports,
  } = useQuery({
    queryKey: ["reports", "list"],
    queryFn: () => reportsFn({}),
    refetchInterval: 30_000,
  });

  const { data: liveData, refetch: refetchLive } = useQuery({
    queryKey: ["monitor", "live"],
    queryFn: () => liveFn({}),
    refetchInterval: 15_000,
  });

  const reports = (reportsData as ReportListItem[] | undefined) ?? [];
  const liveInterviews = (liveData as LiveInterviewDTO[] | undefined) ?? [];

  // Filter States
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [recruiterFilter, setRecruiterFilter] = useState("all");
  const [personaFilter, setPersonaFilter] = useState("all");
  const [recFilter, setRecFilter] = useState<Recommendation | "all">("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof ReportListItem>("scheduledAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Selected candidate IDs for Comparison
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  // Hover card preview state
  const [hoveredReportId, setHoveredReportId] = useState<string | null>(null);

  // Dynamic filter values from dataset
  const rolesList = useMemo(
    () => Array.from(new Set(reports.map((r) => r.role).filter(Boolean))),
    [reports],
  );
  const recruitersList = useMemo(
    () => Array.from(new Set(reports.map((r) => r.recruiterName).filter(Boolean))),
    [reports],
  );
  const personasList = useMemo(
    () => Array.from(new Set(reports.map((r) => r.personaName).filter(Boolean))),
    [reports],
  );

  // Overall statistics
  const stats = useMemo(() => {
    const completed = reports.filter((r) => r.status === "completed");
    const inProgress = reports.filter((r) => r.status === "in_progress");
    const scored = completed.filter((r) => r.score != null);
    const integrityScored = completed.filter((r) => r.integrityScore != null);

    const avgScore = scored.length
      ? Math.round(scored.reduce((a, r) => a + r.score!, 0) / scored.length)
      : null;
    const avgInteg = integrityScored.length
      ? Math.round(
          integrityScored.reduce((a, r) => a + r.integrityScore!, 0) / integrityScored.length,
        )
      : null;

    return {
      total: reports.length,
      completed: completed.length,
      inProgress: inProgress.length,
      strongHire: completed.filter((r) => r.recommendation === "strong_hire").length,
      hire: completed.filter((r) => r.recommendation === "hire").length,
      maybe: completed.filter((r) => r.recommendation === "maybe").length,
      reject: completed.filter(
        (r) => r.recommendation === "reject" || r.recommendation === "no_hire",
      ).length,
      avgScore,
      avgInteg,
    };
  }, [reports]);

  // Combined Filters Logic
  const filtered = useMemo(() => {
    let list = [...reports];

    // Search query (candidate name, role, persona)
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.candidateName.toLowerCase().includes(q) ||
          r.role.toLowerCase().includes(q) ||
          r.personaName.toLowerCase().includes(q),
      );
    }

    // Dropdown filters
    if (roleFilter !== "all") list = list.filter((r) => r.role === roleFilter);
    if (recruiterFilter !== "all") list = list.filter((r) => r.recruiterName === recruiterFilter);
    if (personaFilter !== "all") list = list.filter((r) => r.personaName === personaFilter);
    if (recFilter !== "all") list = list.filter((r) => r.recommendation === recFilter);
    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);

    // Risk Filter
    if (riskFilter !== "all") {
      list = list.filter((r) => {
        const score = r.integrityScore ?? 100;
        if (riskFilter === "low") return score >= 80;
        if (riskFilter === "medium") return score >= 60 && score < 80;
        if (riskFilter === "high") return score < 60;
        return true;
      });
    }

    // Date range
    if (dateRange.start) {
      const startMs = new Date(dateRange.start).getTime();
      list = list.filter((r) => r.scheduledAt && new Date(r.scheduledAt).getTime() >= startMs);
    }
    if (dateRange.end) {
      const endMs = new Date(dateRange.end).getTime() + 86400000; // include full day
      list = list.filter((r) => r.scheduledAt && new Date(r.scheduledAt).getTime() <= endMs);
    }

    // Sorting
    list.sort((a, b) => {
      let av = a[sortKey];
      let bv = b[sortKey];

      if (av === null || av === undefined) av = "";
      if (bv === null || bv === undefined) bv = "";

      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv), undefined, { numeric: true })
        : String(bv).localeCompare(String(av), undefined, { numeric: true });
    });

    return list;
  }, [
    reports,
    search,
    roleFilter,
    recruiterFilter,
    personaFilter,
    recFilter,
    statusFilter,
    riskFilter,
    dateRange,
    sortKey,
    sortDir,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (key: keyof ReportListItem) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(paged.map((r) => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleClearFilters = () => {
    setSearch("");
    setRoleFilter("all");
    setRecruiterFilter("all");
    setPersonaFilter("all");
    setRecFilter("all");
    setStatusFilter("all");
    setRiskFilter("all");
    setDateRange({ start: "", end: "" });
    setPage(1);
  };

  const comparedCandidates = useMemo(() => {
    return reports.filter((r) => selectedIds.includes(r.id));
  }, [reports, selectedIds]);

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-md border-b border-outline-variant/60 pb-md">
        <div>
          <h2 className="text-display-lg text-on-background font-bold tracking-tight">
            Recruiter Intelligence Center
          </h2>
          <p className="text-body-lg text-on-surface-variant mt-1">
            Real-time proctoring telemetry, multi-candidate comparisons, and explainable AI
            interview evaluations.
          </p>
        </div>
        <div className="flex items-center gap-sm">
          <button
            type="button"
            onClick={() => {
              refetchReports();
              refetchLive();
              toast.success("Intelligence data refreshed.");
            }}
            className="px-4 py-2 border border-outline-variant rounded-lg inline-flex items-center gap-2 hover:bg-surface-container-low text-body-md transition"
          >
            <Icon name="refresh" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => exportReportsCSV(filtered)}
            disabled={filtered.length === 0}
            className="px-4 py-2 border border-outline-variant rounded-lg inline-flex items-center gap-2 hover:bg-surface-container-low text-body-md disabled:opacity-50 transition"
          >
            <Icon name="download" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => exportReportsJSON(filtered)}
            disabled={filtered.length === 0}
            className="px-4 py-2 bg-primary text-on-primary rounded-lg inline-flex items-center gap-2 hover:brightness-110 text-body-md disabled:opacity-50 transition"
          >
            <Icon name="output" />
            Export JSON
          </button>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-md mb-lg">
        {[
          {
            label: "Total Reviews",
            value: stats.total,
            icon: "description",
            tone: "default" as const,
          },
          {
            label: "Completed",
            value: stats.completed,
            icon: "check_circle",
            tone: "success" as const,
          },
          {
            label: "In Progress",
            value: stats.inProgress,
            icon: "pending",
            tone: "primary" as const,
          },
          { label: "Strong Hire", value: stats.strongHire, icon: "star", tone: "success" as const },
          { label: "Hire", value: stats.hire, icon: "thumb_up", tone: "primary" as const },
          { label: "Maybe", value: stats.maybe, icon: "help", tone: "warning" as const },
          { label: "Reject", value: stats.reject, icon: "cancel", tone: "error" as const },
          {
            label: "Avg Score",
            value: stats.avgScore != null ? stats.avgScore : "—",
            icon: "analytics",
            tone: "default" as const,
          },
          {
            label: "Avg Integrity",
            value: stats.avgInteg != null ? `${stats.avgInteg}%` : "—",
            icon: "shield",
            tone: "default" as const,
          },
        ].map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} tone={s.tone} />
        ))}
      </div>

      {/* LIVE INTERVIEW MONITORING */}
      <section className="bg-inverse-surface text-inverse-on-surface rounded-2xl p-lg border border-outline-variant shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-radial-gradient-bg opacity-15 pointer-events-none" />
        <div className="flex items-center justify-between border-b border-white/10 pb-md mb-md">
          <h3 className="text-headline-md flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-error animate-pulse" />
            Live Interview Monitor
          </h3>
          <span className="text-label-caps uppercase bg-white/10 px-2.5 py-1 rounded">
            {liveInterviews.length} active sessions
          </span>
        </div>

        {liveInterviews.length === 0 ? (
          <EmptyState
            icon="visibility"
            title="No candidate interviews are live at the moment"
            hint="Observer console will populate automatically when a scheduled session begins."
            className="py-12 text-white/60 [&_span]:text-white/60 [&_h3]:text-white [&_p]:text-white/60"
          />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-lg">
            {liveInterviews.map((live) => (
              <LiveObserverCard key={live.id} live={live} />
            ))}
          </div>
        )}
      </section>

      {/* RECORDED INTERVIEW LIBRARY */}
      <section className="space-y-md">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-headline-md flex items-center gap-2">
              <Icon name="smart_display" className="text-primary" />
              Interview Recording Library
            </h3>
            <p className="text-body-sm text-on-surface-variant">
              Replay completed candidate videos and check proctor logs.
            </p>
          </div>
          <span className="text-label-caps uppercase text-on-surface-variant font-semibold">
            {reports.filter((r) => r.status === "completed").length} recordings
          </span>
        </div>

        {reports.filter((r) => r.status === "completed").length === 0 ? (
          <EmptyState
            icon="video_library"
            title="No recording files found"
            hint="Recording files will appear here once candidate sessions are completed."
            className="py-12"
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-lg">
            {reports
              .filter((r) => r.status === "completed")
              .slice(0, 4)
              .map((r) => (
                <RecordingCard
                  key={r.id}
                  report={r}
                  hoveredId={hoveredReportId}
                  setHoveredId={setHoveredReportId}
                />
              ))}
          </div>
        )}
      </section>

      {/* COMPREHENSIVE REPORTS TABLE WITH FILTERBAR */}
      <section className="space-y-md">
        <div className="flex items-center justify-between flex-wrap gap-md">
          <h3 className="text-headline-md font-bold text-on-background">
            Comprehensive Evaluation Matrix
          </h3>
          {selectedIds.length >= 2 && (
            <button
              type="button"
              onClick={() => setCompareModalOpen(true)}
              className="bg-secondary text-on-secondary px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:brightness-110 shadow-soft transition"
            >
              <Icon name="compare_arrows" />
              Compare Candidates ({selectedIds.length})
            </button>
          )}
        </div>

        {/* Dynamic Filters Bar */}
        <div className="filter-bar">
          <div className="relative flex-1 min-w-[200px]">
            <Icon
              name="search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]"
            />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search candidate, role, persona…"
              className="w-full pl-9 pr-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-md outline-none focus:ring-2 focus:ring-primary-container transition"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-md"
          >
            <option value="all">All Roles</option>
            {rolesList.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <select
            value={recruiterFilter}
            onChange={(e) => {
              setRecruiterFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-md"
          >
            <option value="all">All Recruiters</option>
            {recruitersList.map((rec) => (
              <option key={rec} value={rec}>
                {rec}
              </option>
            ))}
          </select>

          <select
            value={personaFilter}
            onChange={(e) => {
              setPersonaFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-md"
          >
            <option value="all">All Personas</option>
            {personasList.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            value={recFilter || "all"}
            onChange={(e) => {
              setRecFilter(e.target.value as Recommendation | "all");
              setPage(1);
            }}
            className="px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-md"
          >
            <option value="all">Recommendation</option>
            <option value="strong_hire">Strong Hire</option>
            <option value="hire">Hire</option>
            <option value="maybe">Maybe</option>
            <option value="reject">Reject</option>
          </select>

          <select
            value={riskFilter}
            onChange={(e) => {
              setRiskFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-md"
          >
            <option value="all">Integrity Risk</option>
            <option value="low">Low Risk (80%+)</option>
            <option value="medium">Medium Risk (60-80%)</option>
            <option value="high">High Risk (&lt;60%)</option>
          </select>

          {/* Date Pickers */}
          <div className="flex items-center gap-1.5 border border-outline-variant rounded-lg px-2 py-1 bg-surface">
            <span className="text-[11px] text-on-surface-variant font-semibold">From:</span>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => {
                setDateRange((prev) => ({ ...prev, start: e.target.value }));
                setPage(1);
              }}
              className="bg-transparent text-body-sm outline-none"
            />
            <span className="text-[11px] text-on-surface-variant font-semibold">To:</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => {
                setDateRange((prev) => ({ ...prev, end: e.target.value }));
                setPage(1);
              }}
              className="bg-transparent text-body-sm outline-none"
            />
          </div>

          {(search ||
            roleFilter !== "all" ||
            recruiterFilter !== "all" ||
            personaFilter !== "all" ||
            recFilter !== "all" ||
            statusFilter !== "all" ||
            riskFilter !== "all" ||
            dateRange.start ||
            dateRange.end) && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-3 py-2 text-body-md text-on-surface-variant hover:text-error flex items-center gap-1 transition"
            >
              <Icon name="close" />
              Clear Filters
            </button>
          )}

          <span className="text-label-caps uppercase text-on-surface-variant ml-auto font-semibold">
            {filtered.length} matches
          </span>
        </div>

        {/* Matrix Table */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-soft overflow-hidden">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-body-md" style={{ minWidth: "1200px" }}>
              <thead className="bg-surface-container-low text-label-caps uppercase text-on-surface-variant sticky top-0 z-10">
                <tr>
                  <th className="p-4 border-b border-outline-variant text-center w-12">
                    <input
                      type="checkbox"
                      className="rounded border-outline-variant text-primary focus:ring-primary-container"
                      checked={paged.length > 0 && selectedIds.length === paged.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      aria-label="Select all candidates on this page"
                    />
                  </th>
                  {(
                    [
                      { label: "Candidate", key: "candidateName" },
                      { label: "Applied Role", key: "role" },
                      { label: "AI Persona", key: "personaName" },
                      { label: "Recruiter", key: "recruiterName" },
                      { label: "Interview Date", key: "scheduledAt" },
                      { label: "Overall Score", key: "score" },
                      { label: "Integrity", key: "integrityScore" },
                      { label: "Recommendation", key: "recommendation" },
                      { label: "Duration", key: "durationMinutes" },
                      { label: "Status", key: "status" },
                      { label: "Actions", key: null },
                    ] as { label: string; key: keyof ReportListItem | null }[]
                  ).map((col) => (
                    <th
                      key={col.label}
                      className={`p-4 font-semibold tracking-wide text-left border-b border-outline-variant ${col.key ? "cursor-pointer hover:bg-surface-container transition" : ""}`}
                      onClick={
                        col.key ? () => handleSort(col.key as keyof ReportListItem) : undefined
                      }
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {col.key && (
                          <span className="material-symbols-outlined text-[13px] opacity-60">
                            {sortKey === col.key
                              ? sortDir === "asc"
                                ? "arrow_upward"
                                : "arrow_downward"
                              : "unfold_more"}
                          </span>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/60">
                {reportsLoading ? (
                  <tr>
                    <td colSpan={11} className="p-0">
                      <SkeletonCard rows={6} />
                    </td>
                  </tr>
                ) : paged.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-0">
                      <EmptyState
                        icon="search_off"
                        title="No candidate reports fit the current filters"
                        hint="Try resetting filters to show database records."
                        action={
                          <button
                            type="button"
                            onClick={handleClearFilters}
                            className="px-4 py-2 border border-outline-variant rounded-lg inline-flex items-center gap-2 hover:bg-surface-container-low text-body-md transition text-on-surface"
                          >
                            <Icon name="close" />
                            Clear Filters
                          </button>
                        }
                        className="py-12"
                      />
                    </td>
                  </tr>
                ) : (
                  paged.map((r) => {
                    const isChecked = selectedIds.includes(r.id);
                    return (
                      <tr
                        key={r.id}
                        className={`hover:bg-surface-container-low/50 transition ${isChecked ? "bg-primary-container/5" : ""}`}
                      >
                        <td className="p-4 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelect(r.id)}
                            className="rounded border-outline-variant text-primary focus:ring-primary-container"
                            aria-label={`Select ${r.candidateName}`}
                          />
                        </td>
                        <td className="p-4 font-semibold text-on-surface">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs shrink-0">
                              {r.candidateName
                                .split(" ")
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase()}
                            </div>
                            <Link
                              to="/recruiter/reports/$interviewId"
                              params={{ interviewId: r.id }}
                              className="hover:text-primary hover:underline"
                            >
                              {r.candidateName}
                            </Link>
                          </div>
                        </td>
                        <td className="p-4 text-on-surface-variant">{r.role}</td>
                        <td className="p-4 text-on-surface-variant">{r.personaName}</td>
                        <td className="p-4 text-on-surface-variant text-xs">{r.recruiterName}</td>
                        <td className="p-4 text-on-surface-variant whitespace-nowrap text-xs">
                          {r.scheduledAt ? fmtDate(r.scheduledAt) : "—"}
                        </td>
                        <td
                          className={`p-4 font-bold text-data-mono ${r.score != null ? scoreColor(r.score) : "text-on-surface-variant"}`}
                        >
                          {r.score != null ? Math.round(r.score) : "—"}
                        </td>
                        <td
                          className={`p-4 font-bold text-data-mono ${r.integrityScore != null ? scoreColor(r.integrityScore) : "text-on-surface-variant"}`}
                        >
                          {r.integrityScore != null ? `${Math.round(r.integrityScore)}%` : "—"}
                        </td>
                        <td className="p-4">{recommendationBadge(r.recommendation)}</td>
                        <td className="p-4 text-on-surface-variant">{r.durationMinutes} min</td>
                        <td className="p-4">{statusBadge(r.status ?? "scheduled")}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            <Link
                              to="/recruiter/reports/$interviewId"
                              params={{ interviewId: r.id }}
                              className="px-2.5 py-1.5 bg-primary text-on-primary rounded text-label-caps hover:brightness-110 transition whitespace-nowrap"
                            >
                              View Report
                            </Link>
                            <Link
                              to="/recruiter/monitor"
                              className="w-8 h-8 rounded border border-outline-variant hover:bg-surface-container-low flex items-center justify-center transition"
                              title="Replay Video & Transcript"
                            >
                              <Icon name="play_circle" className="text-md" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Component */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-outline-variant/60 bg-surface-container-lowest">
              <p className="text-body-md text-on-surface-variant">
                Page {page} of {totalPages} · {filtered.length} total rows
              </p>
              <div className="flex items-center gap-1">
                {[
                  { icon: "first_page", action: () => setPage(1), disabled: page === 1 },
                  {
                    icon: "chevron_left",
                    action: () => setPage((p) => Math.max(1, p - 1)),
                    disabled: page === 1,
                  },
                  {
                    icon: "chevron_right",
                    action: () => setPage((p) => Math.min(totalPages, p + 1)),
                    disabled: page === totalPages,
                  },
                  {
                    icon: "last_page",
                    action: () => setPage(totalPages),
                    disabled: page === totalPages,
                  },
                ].map((btn, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={btn.action}
                    disabled={btn.disabled}
                    className="w-8 h-8 rounded flex items-center justify-center border border-outline-variant hover:bg-surface-container-low disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <span className="material-symbols-outlined text-[18px]">{btn.icon}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* COMPARISON MATRIX MODAL */}
      {compareModalOpen && (
        <ComparisonMatrixModal
          candidates={comparedCandidates}
          onClose={() => setCompareModalOpen(false)}
        />
      )}
    </div>
  );
}

/* ============================================================================
   SUBCOMPONENT: LIVE OBSERVER DECK CARD
   ============================================================================ */
function LiveObserverCard({ live }: { live: LiveInterviewDTO }) {
  const sessionFn = useServerFn(getMonitorSession);
  const [turns, setTurns] = useState<MonitorTurn[]>([]);
  const [events, setEvents] = useState<MonitorEvent[]>([]);
  const [elapsed, setElapsed] = useState(0);

  const { data, refetch } = useQuery({
    queryKey: ["monitor", "session", live.id],
    queryFn: () => sessionFn({ data: { interviewId: live.id } }),
    refetchInterval: 10_000,
  });

  const sessionId = (data as any)?.session?.id ?? live.sessionId;

  useEffect(() => {
    if (data) {
      setTurns((data as any).turns ?? []);
      setEvents((data as any).events ?? []);

      // Calculate elapsed time from session start
      const startedAt = (data as any).session?.startedAt;
      if (startedAt) {
        const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
        setElapsed(diff > 0 ? diff : 0);
      }
    }
  }, [data]);

  // Real-time Supabase subscriptions
  useEffect(() => {
    if (!sessionId) return;

    const turnsCh = supabase
      .channel(`realtime-turns-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "interview_turns",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          refetch();
        },
      )
      .subscribe();

    const eventsCh = supabase
      .channel(`realtime-events-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "interview_events",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          refetch();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(turnsCh);
      void supabase.removeChannel(eventsCh);
    };
  }, [sessionId, refetch]);

  // Clock ticks
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const latestTurn = turns.length ? turns[turns.length - 1] : null;
  const recentAlerts = events.filter((e) => e.type !== "snapshot_upload").slice(-3);
  const formatSecs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="bg-[#1a2130] rounded-xl border border-white/10 p-md flex flex-col justify-between min-h-[300px]">
      <div>
        <div className="flex items-center justify-between border-b border-white/5 pb-sm mb-md">
          <div>
            <h4 className="font-semibold text-white text-[15px]">{live.candidateName}</h4>
            <p className="text-xs text-white/60">
              {live.role} • {live.personaName}
            </p>
          </div>
          <div className="text-right">
            <span className="text-[13px] font-mono text-[#57dffe] font-semibold">
              {formatSecs(elapsed)}
            </span>
            <p className="text-[9px] uppercase tracking-wider text-white/40">Elapsed Time</p>
          </div>
        </div>

        {/* Live Video Waveform Animation */}
        <div className="h-16 bg-black/40 rounded-lg flex items-center justify-center gap-1.5 px-md mb-md border border-white/5 relative">
          <div className="absolute top-2 left-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-ping" />
            <span className="text-[9px] uppercase tracking-wider text-white/50">
              Telemetric Stream
            </span>
          </div>

          {/* Animated voice bars */}
          {Array.from({ length: 15 }).map((_, i) => {
            const delay = (i * 0.1).toFixed(1);
            return (
              <span
                key={i}
                className="w-1 bg-[#57dffe] rounded-full animate-bounce"
                style={{
                  height: `${Math.floor(Math.random() * 40) + 12}px`,
                  animationDuration: `${Math.random() * 0.8 + 0.5}s`,
                  animationDelay: `${delay}s`,
                }}
              />
            );
          })}
        </div>

        {/* Live Transcript Quote */}
        <div className="text-body-md text-white/90 italic bg-white/5 p-3 rounded-lg border border-white/5 mb-md">
          {latestTurn ? (
            <p>
              <strong className="text-secondary-container not-italic text-xs block mb-1">
                {latestTurn.who === "AI" ? live.personaName : "Candidate"}:
              </strong>
              "{latestTurn.text}"
            </p>
          ) : (
            <span className="text-white/40 text-xs">Waiting for verbal dialogue stream...</span>
          )}
        </div>
      </div>

      <div>
        {/* Live Proctor Alerts */}
        <div className="space-y-1.5 mb-md">
          <p className="text-[10px] uppercase text-white/40 tracking-wider font-semibold">
            Proctor Logs
          </p>
          {recentAlerts.length === 0 ? (
            <p className="text-xs text-white/30 italic">No proctoring violations detected.</p>
          ) : (
            recentAlerts.map((e) => (
              <div
                key={e.id}
                className="text-xs bg-error-container/10 border border-error/20 text-[#ffb4ab] px-2.5 py-1.5 rounded flex items-center gap-2"
              >
                <Icon name="warning" className="text-sm shrink-0" />
                <span className="truncate">{e.type.replace(/_/g, " ").toUpperCase()}</span>
                <span className="ml-auto text-[9px] opacity-65">
                  {new Date(e.at).toLocaleTimeString()}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="flex gap-2">
          <Link
            to="/recruiter/monitor"
            className="flex-1 py-2 text-center text-xs font-semibold rounded bg-[#2c374e] text-white hover:bg-[#384663] transition"
          >
            Observe Stream
          </Link>
          <Link
            to="/recruiter/reports/$interviewId"
            params={{ interviewId: live.id }}
            className="flex-1 py-2 text-center text-xs font-semibold rounded bg-primary text-white hover:brightness-110 transition"
          >
            Review Report
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   SUBCOMPONENT: RECORDING CARD WITH PREVIEW HOVER CARD
   ============================================================================ */
function RecordingCard({
  report,
  hoveredId,
  setHoveredId,
}: {
  report: ReportListItem;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
}) {
  const isHovered = hoveredId === report.id;
  const initials = report.candidateName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Proctor counts
  const proctor = useMemo(
    () => parseIntegritySummary(report.integrityTimeline),
    [report.integrityTimeline],
  );
  const riskColor =
    (report.integrityScore ?? 100) >= 80
      ? "text-[#166534] bg-[#dcfce7]"
      : (report.integrityScore ?? 100) >= 60
        ? "text-[#854d0e] bg-[#fef9c3]"
        : "text-error bg-error-container";

  return (
    <div
      className="relative"
      onMouseEnter={() => setHoveredId(report.id)}
      onMouseLeave={() => setHoveredId(null)}
    >
      <div className="bg-surface-container-lowest border border-outline-variant shadow-soft rounded-xl overflow-hidden hover:shadow-lg transition flex flex-col justify-between h-full">
        {/* Thumbnail Preview Area */}
        <div className="aspect-video bg-[#213145] relative flex items-center justify-center group cursor-pointer">
          <div className="w-16 h-16 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-headline-sm">
            {initials}
          </div>
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/45 transition">
            <Link
              to="/recruiter/reports/$interviewId"
              params={{ interviewId: report.id }}
              className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center hover:scale-105 transition"
            >
              <Icon name="play_arrow" className="text-2xl" />
            </Link>
          </div>
          <span className="absolute bottom-2 right-2 text-[10px] font-mono bg-black/60 text-white px-2 py-0.5 rounded">
            {Math.floor(report.durationMinutes)} min
          </span>
          <span className="absolute top-2 left-2 text-[10px] font-semibold uppercase bg-error text-on-error px-2 py-0.5 rounded flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            Library
          </span>
        </div>

        {/* Card info */}
        <div className="p-md">
          <p className="font-semibold text-on-surface text-body-md truncate">
            {report.candidateName}
          </p>
          <p className="text-xs text-on-surface-variant truncate">
            {report.role} • {report.personaName}
          </p>
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-outline-variant/40">
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">
              {report.scheduledAt ? fmtDate(report.scheduledAt) : "—"}
            </span>
            {report.score != null && (
              <span className={`text-data-mono font-bold text-xs ${scoreColor(report.score)}`}>
                Score: {Math.round(report.score)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* OVERLAY ENTERPRISE HOVER CARD */}
      {isHovered && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-inverse-surface text-inverse-on-surface border border-outline-variant/20 rounded-xl shadow-2xl p-md space-y-md pointer-events-none transition-all duration-200">
          <div className="border-b border-white/10 pb-2">
            <h4 className="font-bold text-white text-body-md">{report.candidateName}</h4>
            <p className="text-xs text-white/60">{report.role}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white/5 p-2 rounded">
              <span className="text-white/40 block text-[9px] uppercase">Competency Score</span>
              <span className={`font-bold text-sm ${scoreColor(report.score ?? 0)}`}>
                {report.score != null ? `${Math.round(report.score)}/100` : "—"}
              </span>
            </div>
            <div className="bg-white/5 p-2 rounded">
              <span className="text-white/40 block text-[9px] uppercase">Integrity Score</span>
              <span className={`font-bold text-sm ${scoreColor(report.integrityScore ?? 0)}`}>
                {report.integrityScore != null ? `${Math.round(report.integrityScore)}%` : "—"}
              </span>
            </div>
          </div>

          {/* Detailed Proctoring Summary logs */}
          <div className="space-y-1.5 text-[11px]">
            <p className="font-semibold text-white/50 text-[10px] uppercase tracking-wider">
              Proctoring Telemetry
            </p>
            <div className="divide-y divide-white/5">
              <div className="flex justify-between py-1">
                <span className="text-white/60">Tab Switches</span>
                <span className="font-semibold">{proctor.tabSwitches}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-white/60">Fullscreen Exits</span>
                <span className="font-semibold">{proctor.fullscreenExits}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-white/60">Face Missing Events</span>
                <span className="font-semibold">{proctor.faceMissing}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-white/60">Multiple Faces Detected</span>
                <span className="font-semibold">{proctor.multipleFaces ? "Yes" : "No"}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-white/60">Background Voices</span>
                <span className="font-semibold">{proctor.backgroundVoice}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-white/60">Copy/Paste Attempts</span>
                <span className="font-semibold">{proctor.copyPaste}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-white/60">DevTools Violations</span>
                <span className="font-semibold">{proctor.devtools}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-white/60">Screen Share Violations</span>
                <span className="font-semibold">{proctor.screenShareViolations}</span>
              </div>
            </div>
          </div>

          <div
            className={`text-center py-1 rounded text-[10px] font-bold uppercase tracking-wider ${riskColor}`}
          >
            Risk Level:{" "}
            {(report.integrityScore ?? 100) >= 80
              ? "Low Risk"
              : (report.integrityScore ?? 100) >= 60
                ? "Medium Risk"
                : "High Risk"}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   SUBCOMPONENT: CANDIDATE COMPARISON MATRIX MODAL
   ============================================================================ */
function ComparisonMatrixModal({
  candidates,
  onClose,
}: {
  candidates: ReportListItem[];
  onClose: () => void;
}) {
  const radarData = useMemo(() => {
    return candidates.map((c) => ({
      name: c.candidateName,
      scores: {
        technical: c.scores?.technical ?? 50,
        behavioral: c.scores?.behavioral ?? 50,
        communication: c.scores?.communication ?? 50,
        confidence: c.scores?.confidence ?? 50,
        knowledge: c.scores?.knowledge ?? 50,
      },
    }));
  }, [candidates]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 print:p-0 print:static print:bg-white"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden print:h-auto print:border-none print:shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-lg border-b border-outline-variant flex items-center justify-between bg-surface-container-low print:hidden">
          <div>
            <h3 className="text-headline-md font-bold text-on-surface">
              Candidate Evaluation Comparison Matrix
            </h3>
            <p className="text-body-sm text-on-surface-variant">
              Side-by-side radar overlay and competency criteria alignment.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 border border-outline-variant rounded-lg inline-flex items-center gap-2 hover:bg-surface-container-low text-body-md transition"
            >
              <Icon name="print" />
              Print / Export PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full hover:bg-surface-container flex items-center justify-center transition"
              aria-label="Close Comparison"
            >
              <Icon name="close" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-lg space-y-xl print:overflow-visible print:p-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-lg items-center">
            {/* SVG Radar Chart Overlay Column */}
            <div className="md:col-span-1 border border-outline-variant/60 rounded-xl p-md bg-surface-container-low/40 flex flex-col items-center">
              <h4 className="text-label-caps uppercase font-bold text-on-surface-variant mb-4">
                Competency Overlay
              </h4>
              <RadarChart candidates={radarData} />

              <div className="flex flex-col gap-2 mt-4 w-full">
                {candidates.map((c, idx) => {
                  const colorClass =
                    idx === 0 ? "bg-primary" : idx === 1 ? "bg-secondary" : "bg-tertiary";
                  return (
                    <div key={c.id} className="flex items-center gap-2 text-xs">
                      <span className={`w-3 h-3 rounded-full ${colorClass}`} />
                      <span className="font-semibold text-on-surface truncate">
                        {c.candidateName}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Comparison Overview Details */}
            <div className="md:col-span-2 space-y-md">
              <h4 className="text-label-caps uppercase font-bold text-on-surface-variant">
                Evaluation Summary
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
                {candidates.slice(0, 3).map((c, idx) => {
                  const borderCol =
                    idx === 0
                      ? "border-t-primary"
                      : idx === 1
                        ? "border-t-secondary"
                        : "border-t-tertiary";
                  return (
                    <div
                      key={c.id}
                      className={`bg-surface border border-outline-variant rounded-xl p-4 border-t-4 ${borderCol} flex flex-col justify-between`}
                    >
                      <div>
                        <p className="font-bold text-on-surface leading-tight text-body-md truncate">
                          {c.candidateName}
                        </p>
                        <p className="text-[11px] text-on-surface-variant mt-0.5">{c.role}</p>
                      </div>
                      <div className="mt-4 space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-on-surface-variant">Overall score:</span>
                          <span className="font-bold">
                            {c.score != null ? `${Math.round(c.score)}%` : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-on-surface-variant">Integrity status:</span>
                          <span className="font-bold">
                            {c.integrityScore != null ? `${Math.round(c.integrityScore)}%` : "—"}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-outline-variant/40 flex justify-center">
                          {recommendationBadge(c.recommendation)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Grid details alignment table */}
          <div className="space-y-md">
            <h4 className="text-label-caps uppercase font-bold text-on-surface-variant">
              Competency Dimension Scores
            </h4>
            <div className="border border-outline-variant rounded-xl overflow-hidden bg-surface">
              <table className="w-full text-body-md text-left">
                <thead className="bg-surface-container-low text-label-caps uppercase text-on-surface-variant">
                  <tr>
                    <th className="p-3">Evaluation Criteria</th>
                    {candidates.map((c) => (
                      <th
                        key={c.id}
                        className="p-3 font-semibold text-center border-l border-outline-variant"
                      >
                        {c.candidateName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/60">
                  {[
                    { label: "Overall AI Evaluation", key: "overall" },
                    { label: "Technical Assessment", key: "technical" },
                    { label: "Behavioral Alignment", key: "behavioral" },
                    { label: "Communication Score", key: "communication" },
                    { label: "Confidence Metric", key: "confidence" },
                    { label: "Knowledge Depth", key: "knowledge" },
                    { label: "Integrity Score", key: "integrity" },
                  ].map((dim) => (
                    <tr key={dim.key} className="hover:bg-surface-container-low/30">
                      <td className="p-3 font-semibold">{dim.label}</td>
                      {candidates.map((c) => {
                        let score = "—";
                        if (dim.key === "overall" && c.score != null)
                          score = `${Math.round(c.score)}%`;
                        else if (dim.key === "integrity" && c.integrityScore != null)
                          score = `${Math.round(c.integrityScore)}%`;
                        else {
                          const v = (c.scores as any)?.[dim.key];
                          if (v != null) score = `${Math.round(Number(v))}%`;
                        }
                        return (
                          <td
                            key={c.id}
                            className="p-3 text-center border-l border-outline-variant font-data-mono font-bold text-on-surface"
                          >
                            {score}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="bg-surface-container-low/40">
                    <td className="p-3 font-semibold">Overall Recommendation</td>
                    {candidates.map((c) => (
                      <td key={c.id} className="p-3 text-center border-l border-outline-variant">
                        {recommendationBadge(c.recommendation)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-md border-t border-outline-variant flex justify-end gap-2 bg-surface-container-low print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-outline-variant bg-white text-on-surface rounded-lg text-body-md hover:bg-surface-container-low transition"
          >
            Close Comparative Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   SVG RADAR CHART DRAWING UTILITY
   ============================================================================ */
function RadarChart({
  candidates,
}: {
  candidates: Array<{
    name: string;
    scores: {
      technical: number;
      behavioral: number;
      communication: number;
      confidence: number;
      knowledge: number;
    };
  }>;
}) {
  const size = 300;
  const center = size / 2;
  const radius = size * 0.35;
  const axes = ["technical", "behavioral", "communication", "confidence", "knowledge"];
  const axisLabels = ["Technical", "Behavioral", "Communication", "Confidence", "Knowledge"];

  const getPoint = (index: number, value: number) => {
    const angle = ((Math.PI * 2) / axes.length) * index - Math.PI / 2;
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const grids = [20, 40, 60, 80, 100];

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} className="max-w-[280px]">
      {/* Background circles grids */}
      {grids.map((g) => {
        const points = axes
          .map((_, idx) => {
            const pt = getPoint(idx, g);
            return `${pt.x},${pt.y}`;
          })
          .join(" ");
        return (
          <polygon
            key={g}
            points={points}
            fill="none"
            className="stroke-outline-variant/30"
            strokeWidth="1"
            strokeDasharray={g === 100 ? "0" : "2 2"}
          />
        );
      })}

      {/* Axis Lines */}
      {axes.map((_, idx) => {
        const pt = getPoint(idx, 100);
        return (
          <line
            key={idx}
            x1={center}
            y1={center}
            x2={pt.x}
            y2={pt.y}
            className="stroke-outline-variant/40"
            strokeWidth="1.2"
          />
        );
      })}

      {/* Axis Labels */}
      {axisLabels.map((label, idx) => {
        const pt = getPoint(idx, 118);
        const textAnchor = pt.x > center + 10 ? "start" : pt.x < center - 10 ? "end" : "middle";
        return (
          <text
            key={label}
            x={pt.x}
            y={pt.y + 3}
            textAnchor={textAnchor}
            className="text-[9px] font-bold fill-on-surface-variant"
          >
            {label}
          </text>
        );
      })}

      {/* Candidates Data overlays */}
      {candidates.map((c, cIdx) => {
        const points = axes
          .map((a, idx) => {
            const score = (c.scores as any)[a] ?? 50;
            const pt = getPoint(idx, score);
            return `${pt.x},${pt.y}`;
          })
          .join(" ");

        const strokeColor = cIdx === 0 ? "#3525cd" : cIdx === 1 ? "#00687a" : "#7e3000";
        const fillColor =
          cIdx === 0
            ? "rgba(53, 37, 205, 0.15)"
            : cIdx === 1
              ? "rgba(0, 104, 122, 0.15)"
              : "rgba(126, 48, 0, 0.15)";

        return (
          <g key={c.name}>
            <polygon points={points} stroke={strokeColor} strokeWidth="2.5" fill={fillColor} />
            {axes.map((a, idx) => {
              const score = (c.scores as any)[a] ?? 50;
              const pt = getPoint(idx, score);
              return (
                <circle
                  key={idx}
                  cx={pt.x}
                  cy={pt.y}
                  r="3.5"
                  fill={strokeColor}
                  className="stroke-white stroke-2"
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
