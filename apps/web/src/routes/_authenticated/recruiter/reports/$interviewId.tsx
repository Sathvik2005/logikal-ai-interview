import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { CardShadow, Icon, EmptyState, SkeletonCard } from "@/components/recruiter/RecruiterShell";
import { scoreColor, fmtDate } from "@/components/recruiter/mock-data";
import {
  getInterviewReportBundle,
  generateInterviewReport,
  type InterviewReportBundle,
} from "@/lib/proctoring.functions";

export const Route = createFileRoute("/_authenticated/recruiter/reports/$interviewId")({
  component: ReportView,
});

type ReportShape = {
  executive_summary?: string;
  scores?: Record<string, number>;
  strengths?: string[];
  weaknesses?: string[];
  knowledge_gaps?: string[];
  evidence?: Array<{ competency: string; quote: string }>;
  integrity_score?: number;
  integrity_timeline?: Array<{ type: string; at: string }>;
  recommendation?: string;
  technical_summary?: string;
  behavioral_summary?: string;
  communication_summary?: string;
  xai_explanation?: string;
  xai_factors?: Array<{
    factor: string;
    weight: number;
    impact: "positive" | "negative" | "neutral";
    description: string;
  }>;
};

type TabKey =
  | "overview"
  | "technical"
  | "behavioral"
  | "communication"
  | "integrity"
  | "transcript"
  | "recording"
  | "xai"
  | "notes"
  | "timeline";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "summarize" },
  { key: "technical", label: "Technical", icon: "code" },
  { key: "behavioral", label: "Behavioral", icon: "psychology" },
  { key: "communication", label: "Communication", icon: "chat" },
  { key: "integrity", label: "Integrity", icon: "shield" },
  { key: "transcript", label: "Transcript", icon: "receipt_long" },
  { key: "recording", label: "Recording Player", icon: "videocam" },
  { key: "xai", label: "Explainable AI", icon: "auto_awesome" },
  { key: "notes", label: "Recruiter Notes", icon: "edit_note" },
  { key: "timeline", label: "Timeline", icon: "timeline" },
];

function recBadgeClass(rec: string) {
  const norm = rec.toLowerCase();
  return norm === "strong_hire"
    ? "badge-strong-hire"
    : norm === "hire"
      ? "badge-hire"
      : norm === "maybe"
        ? "badge-maybe"
        : norm === "reject" || norm === "no_hire"
          ? "badge-reject"
          : "bg-surface-container text-on-surface";
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, Math.max(0, Number(value)));
  return (
    <div>
      <div className="flex justify-between text-body-md mb-1.5">
        <span className="capitalize font-medium text-on-surface">{label.replace(/_/g, " ")}</span>
        <span className={`font-bold text-data-mono ${scoreColor(pct)}`}>{Math.round(pct)}</span>
      </div>
      <div className="h-2 bg-surface-container rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background:
              pct >= 80
                ? "#22c55e"
                : pct >= 60
                  ? "var(--primary)"
                  : pct >= 40
                    ? "#f59e0b"
                    : "#ef4444",
          }}
        />
      </div>
    </div>
  );
}

function XAIFactorCard({
  factor,
  weight,
  impact,
  description,
}: {
  factor: string;
  weight: number;
  impact: string;
  description: string;
}) {
  const impactColor =
    impact === "positive"
      ? "text-[#166534] bg-[#dcfce7] border-[#bbf7d0]"
      : impact === "negative"
        ? "text-error bg-error-container border-error/20"
        : "text-on-surface-variant bg-surface-container border-outline-variant";
  const barColor =
    impact === "positive" ? "#22c55e" : impact === "negative" ? "#ef4444" : "#6b7280";

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 hover:shadow-hover transition">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-semibold text-on-surface text-body-md">{factor}</p>
          <p className="text-body-sm text-on-surface-variant mt-1">{description}</p>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-label-caps font-semibold border shrink-0 ${impactColor}`}
        >
          {impact}
        </span>
      </div>
      <div>
        <div className="flex justify-between text-label-caps text-on-surface-variant mb-1">
          <span>Influence Weight</span>
          <span>{Math.round(weight * 100)}%</span>
        </div>
        <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${weight * 100}%`, backgroundColor: barColor }}
          />
        </div>
      </div>
    </div>
  );
}

function ReportView() {
  const { interviewId } = Route.useParams();
  const bundleFn = useServerFn(getInterviewReportBundle);
  const generateFn = useServerFn(generateInterviewReport);
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>("overview");
  const [note, setNote] = useState("");
  const [rating, setRating] = useState(0);
  const [savedNote, setSavedNote] = useState("");
  const [recruiterAction, setRecruiterAction] = useState<string | null>(null);

  // Lifted Playback Control State
  const [currentSec, setCurrentSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef<HTMLUListElement | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["report-bundle", interviewId],
    queryFn: () => bundleFn({ data: { interviewId } }),
  });

  const gen = useMutation({
    mutationFn: () => generateFn({ data: { interviewId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report-bundle", interviewId] }),
  });

  const bundle = data as InterviewReportBundle | undefined;
  const iv = bundle?.interview;
  const r = (bundle?.report ?? {}) as ReportShape;
  const durationSec = iv ? iv.durationMinutes * 60 : 1;

  // Session start references for timeline offsets
  const sessionStart = useMemo(() => {
    if (!bundle) return null;
    const startEvent = bundle.events.find((e) => e.type === "session_start");
    return startEvent?.at || bundle.turns[0]?.started_at || iv?.scheduledAt || null;
  }, [bundle, iv]);

  const getOffsetSec = (eventTime: string) => {
    if (!sessionStart) return 0;
    const diff = Math.floor(
      (new Date(eventTime).getTime() - new Date(sessionStart).getTime()) / 1000,
    );
    return diff > 0 ? Math.min(diff, durationSec) : 0;
  };

  // Sync playback clock
  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setCurrentSec((c) => {
        if (c >= durationSec) {
          setIsPlaying(false);
          return durationSec;
        }
        return c + playbackSpeed;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, playbackSpeed, durationSec]);

  // Distribute transcript turns across playback duration
  const turnsWithT = useMemo(() => {
    if (!bundle) return [];
    return bundle.turns.map((t, idx) => {
      // Check turn timestamp against session start if possible
      const tSec = t.started_at
        ? getOffsetSec(t.started_at)
        : Math.floor((idx / Math.max(bundle.turns.length, 1)) * durationSec);
      return {
        ...t,
        who: t.speaker === "persona" ? "AI" : "Candidate",
        t: tSec,
      };
    });
  }, [bundle, sessionStart, durationSec]);

  const visibleTurns = turnsWithT.filter((t) => t.t <= currentSec);
  const activeTurnIdx = visibleTurns.length - 1;

  // Auto-scroll transcript turns in side panels
  useEffect(() => {
    if (tab === "transcript") {
      const el = transcriptRef.current?.querySelector<HTMLLIElement>(
        `[data-idx="${activeTurnIdx}"]`,
      );
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeTurnIdx, tab]);

  if (isLoading) return <SkeletonCard rows={8} />;
  if (error)
    return (
      <CardShadow className="p-lg">
        <EmptyState title="Couldn't load report" hint={(error as Error).message} />
      </CardShadow>
    );
  if (!bundle || !iv) return null;

  const exportTranscriptCSV = () => {
    const headers = ["Speaker", "Text", "Timestamp"];
    const rows = bundle.turns.map((t) => [
      t.speaker === "persona" ? (iv.personaName ?? "Interviewer") : "Candidate",
      `"${t.text.replace(/"/g, '""')}"`,
      new Date(t.started_at).toISOString(),
    ]);
    const csv = [headers, ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${iv.candidateName.replace(/\s+/g, "_")}_transcript.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Transcript exported to CSV.");
  };

  // Compile proctor timeline logs
  const timelineEvents = [
    {
      time: sessionStart,
      label: "Interview Session Started",
      icon: "play_circle",
      color: "text-primary",
      rawTime: sessionStart,
    },
    ...bundle.events.map((e) => ({
      time: e.at,
      label: e.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      icon: "warning",
      color: "text-error",
      rawTime: e.at,
    })),
    ...bundle.snapshots.map((s) => ({
      time: s.capturedAt,
      label: `Snapshot Captured (${s.kind})`,
      icon: "camera_alt",
      color: "text-secondary",
      rawTime: s.capturedAt,
    })),
  ]
    .filter((e) => e.time)
    .sort((a, b) => new Date(a.time!).getTime() - new Date(b.time!).getTime())
    .map((e) => ({
      ...e,
      offsetSec: getOffsetSec(e.rawTime!),
    }));

  const xaiFactors: ReportShape["xai_factors"] =
    r.xai_factors ??
    (r.scores
      ? Object.entries(r.scores).map(([k, v]) => ({
          factor: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          weight: Math.min(1, Number(v) / 100),
          impact:
            Number(v) >= 80
              ? ("positive" as const)
              : Number(v) >= 60
                ? ("neutral" as const)
                : ("negative" as const),
          description: `Determined from detailed candidate response analysis inside the ${k.replace(/_/g, " ")} evaluation matrix.`,
        }))
      : []);

  const triggerSeek = (sec: number) => {
    setCurrentSec(sec);
    setIsPlaying(true);
    setTab("recording");
    toast.success(`Jumped playback to ${Math.floor(sec / 60)}m ${sec % 60}s`);
  };

  const fmtTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <>
      {/* Top Banner details */}
      <div className="mb-lg flex items-start justify-between flex-wrap gap-md border-b border-outline-variant/60 pb-md print:hidden">
        <div>
          <Link
            to="/recruiter/reports"
            className="text-body-md text-primary inline-flex items-center gap-1 mb-2 hover:underline"
          >
            <Icon name="arrow_back" />
            Back to Reports Matrix
          </Link>
          <h2 className="text-display-lg text-on-background font-bold tracking-tight">
            {iv.candidateName}
          </h2>
          <p className="text-body-lg text-on-surface-variant">
            {iv.role} · Interviewed by {iv.personaName} ·{" "}
            {iv.scheduledAt ? fmtDate(iv.scheduledAt) : "—"}
          </p>
        </div>
        <div className="flex items-center gap-md flex-wrap">
          {iv.overallScore != null && (
            <div className="text-center">
              <div className={`text-headline-lg font-bold ${scoreColor(iv.overallScore)}`}>
                {Math.round(iv.overallScore)}
              </div>
              <div className="text-label-caps uppercase text-on-surface-variant">Overall score</div>
            </div>
          )}
          {iv.recommendation && (
            <span
              className={`px-3.5 py-2 rounded-full text-label-caps font-semibold ${recBadgeClass(iv.recommendation)}`}
            >
              {iv.recommendation.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </span>
          )}
          <button
            type="button"
            onClick={exportTranscriptCSV}
            className="px-3.5 py-2 border border-outline-variant bg-white text-on-surface rounded-lg hover:bg-surface-container-low flex items-center gap-2 text-body-md transition"
          >
            <Icon name="download" />
            Export Transcript
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 border border-outline-variant bg-white text-on-surface rounded-lg hover:bg-surface-container-low flex items-center gap-2 text-body-md transition"
          >
            <Icon name="print" />
            Print PDF
          </button>
          <button
            type="button"
            onClick={() => gen.mutate()}
            disabled={gen.isPending}
            className="px-4 py-2 bg-primary text-on-primary rounded-lg hover:brightness-110 flex items-center gap-2 text-body-md disabled:opacity-60 transition"
          >
            <Icon name="auto_awesome" />
            {gen.isPending
              ? "Generating evaluation…"
              : bundle.report
                ? "Regenerate Analysis"
                : "Generate Evaluation Report"}
          </button>
        </div>
      </div>

      {!bundle.report && (
        <CardShadow className="p-lg mb-lg">
          <EmptyState
            icon="auto_awesome"
            title="No AI evaluation report exists"
            hint="Run 'Generate Evaluation Report' to process structural transcripts and signals."
          />
        </CardShadow>
      )}

      {/* Main Review Center Layout Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-lg items-start">
        {/* Left Side: Workspaces / Tabs content */}
        <div className="xl:col-span-3 space-y-md">
          {/* Workspaces navigation tab bar */}
          <div className="flex gap-0 border-b border-outline-variant mb-lg overflow-x-auto print:hidden">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-3 text-body-md border-b-2 whitespace-nowrap transition ${
                  tab === t.key
                    ? "border-primary text-primary font-bold"
                    : "border-transparent text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-[17px]">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* TAB 1: OVERVIEW */}
          {tab === "overview" && (
            <div className="space-y-lg">
              <CardShadow className="p-lg">
                <h3 className="text-headline-sm mb-3 font-semibold text-on-surface border-b border-outline-variant/40 pb-2">
                  Executive Summary
                </h3>
                <p className="text-body-md leading-relaxed whitespace-pre-wrap text-on-surface">
                  {r.executive_summary || "No executive summary parsed yet."}
                </p>
              </CardShadow>

              <div className="grid sm:grid-cols-2 gap-lg">
                <CardShadow className="p-lg">
                  <h4 className="font-semibold mb-3 flex items-center gap-2 text-headline-sm text-on-surface">
                    <Icon name="check_circle" className="text-[#166534]" />
                    Key Strengths
                  </h4>
                  <ul className="space-y-2">
                    {(r.strengths ?? []).map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-body-md text-on-surface">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] mt-2 shrink-0" />
                        {s}
                      </li>
                    ))}
                    {(r.strengths ?? []).length === 0 && (
                      <li className="text-on-surface-variant italic text-body-md">—</li>
                    )}
                  </ul>
                </CardShadow>

                <CardShadow className="p-lg">
                  <h4 className="font-semibold mb-3 flex items-center gap-2 text-headline-sm text-on-surface">
                    <Icon name="warning" className="text-error" />
                    Areas of Improvement
                  </h4>
                  <ul className="space-y-2">
                    {(r.weaknesses ?? []).map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-body-md text-on-surface">
                        <span className="w-1.5 h-1.5 rounded-full bg-error mt-2 shrink-0" />
                        {s}
                      </li>
                    ))}
                    {(r.weaknesses ?? []).length === 0 && (
                      <li className="text-on-surface-variant italic text-body-md">—</li>
                    )}
                  </ul>
                </CardShadow>
              </div>

              {(r.knowledge_gaps ?? []).length > 0 && (
                <CardShadow className="p-lg">
                  <h4 className="font-semibold mb-3 text-headline-sm text-on-surface">
                    Identified Knowledge Gaps
                  </h4>
                  <ul className="space-y-2">
                    {(r.knowledge_gaps ?? []).map((g, i) => (
                      <li key={i} className="flex items-start gap-2 text-body-md text-on-surface">
                        <span className="material-symbols-outlined text-[18px] text-[#f59e0b] mt-0.5">
                          school
                        </span>
                        {g}
                      </li>
                    ))}
                  </ul>
                </CardShadow>
              )}

              {(r.evidence ?? []).length > 0 && (
                <CardShadow className="p-lg">
                  <h4 className="font-semibold mb-3 text-headline-sm text-on-surface">
                    Supporting Transcript Evidence
                  </h4>
                  <ul className="space-y-4">
                    {(r.evidence ?? []).map((e, i) => (
                      <li
                        key={i}
                        className="border-l-4 border-primary pl-4 py-1 bg-surface-container-low/30 rounded-r-lg pr-2"
                      >
                        <div className="text-label-caps uppercase text-primary font-bold mb-1">
                          {e.competency}
                        </div>
                        <div className="text-body-md italic text-on-surface-variant">
                          "{e.quote}"
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardShadow>
              )}
            </div>
          )}

          {/* TAB 2: TECHNICAL EVALUATION */}
          {tab === "technical" && (
            <div className="space-y-lg">
              {r.technical_summary && (
                <CardShadow className="p-lg">
                  <h3 className="text-headline-sm mb-3 font-semibold text-on-surface">
                    Technical Assessment Summary
                  </h3>
                  <p className="text-body-md leading-relaxed text-on-surface">
                    {r.technical_summary}
                  </p>
                </CardShadow>
              )}
              <CardShadow className="p-lg">
                <h3 className="text-headline-sm mb-4 font-semibold text-on-surface">
                  Skills Scoring Breakdown
                </h3>
                <div className="space-y-4">
                  {Object.entries(r.scores ?? {}).map(([key, val]) => (
                    <ScoreBar key={key} label={key} value={Number(val)} />
                  ))}
                  {Object.keys(r.scores ?? {}).length === 0 && (
                    <p className="text-on-surface-variant italic text-body-md">
                      No technical dimensions scored.
                    </p>
                  )}
                </div>
              </CardShadow>
            </div>
          )}

          {/* TAB 3: BEHAVIORAL ANALYSIS */}
          {tab === "behavioral" && (
            <CardShadow className="p-lg">
              <h3 className="text-headline-sm mb-3 font-semibold flex items-center gap-2 text-on-surface border-b border-outline-variant/40 pb-2">
                <span className="material-symbols-outlined text-primary">psychology</span>
                Behavioral Analysis Report
              </h3>
              {r.behavioral_summary ? (
                <p className="text-body-md leading-relaxed text-on-surface">
                  {r.behavioral_summary}
                </p>
              ) : (
                <EmptyState
                  icon="psychology"
                  title="No behavioral summaries recorded"
                  hint="Regenerate evaluation report to run LLM assessment of behavioral traits."
                />
              )}
            </CardShadow>
          )}

          {/* TAB 4: COMMUNICATION */}
          {tab === "communication" && (
            <CardShadow className="p-lg">
              <h3 className="text-headline-sm mb-3 font-semibold flex items-center gap-2 text-on-surface border-b border-outline-variant/40 pb-2">
                <span className="material-symbols-outlined text-secondary">chat</span>
                Communication Style Alignment
              </h3>
              {r.communication_summary ? (
                <p className="text-body-md leading-relaxed text-on-surface">
                  {r.communication_summary}
                </p>
              ) : (
                <EmptyState
                  icon="chat"
                  title="No communication metrics exist"
                  hint="Ensure candidate spoke clearly in audio transcripts."
                />
              )}
            </CardShadow>
          )}

          {/* TAB 5: INTEGRITY PROCTORING SUMMARY */}
          {tab === "integrity" && (
            <div className="space-y-lg">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
                <CardShadow className="p-lg text-center flex flex-col justify-center">
                  <div
                    className={`text-display-lg font-bold leading-none ${scoreColor(iv.integrityScore ?? 100)}`}
                  >
                    {iv.integrityScore != null ? `${Math.round(iv.integrityScore)}%` : "—"}
                  </div>
                  <p className="text-label-caps uppercase text-on-surface-variant mt-2 font-semibold">
                    Integrity Index
                  </p>
                </CardShadow>
                <CardShadow className="p-lg text-center flex flex-col justify-center">
                  <div className="text-display-lg font-bold leading-none text-on-background">
                    {bundle.events.length}
                  </div>
                  <p className="text-label-caps uppercase text-on-surface-variant mt-2 font-semibold">
                    Violations Flagged
                  </p>
                </CardShadow>
                <CardShadow
                  className={`p-lg text-center flex flex-col justify-center border ${
                    (iv.integrityScore ?? 100) >= 80
                      ? "bg-[#dcfce7] border-[#bbf7d0]"
                      : (iv.integrityScore ?? 100) >= 60
                        ? "bg-[#fef9c3] border-[#fef08a]"
                        : "bg-error-container border-error/20"
                  }`}
                >
                  <div className="text-headline-lg font-bold text-on-surface">
                    {(iv.integrityScore ?? 100) >= 80
                      ? "Low Risk"
                      : (iv.integrityScore ?? 100) >= 60
                        ? "Medium Risk"
                        : "High Risk"}
                  </div>
                  <p className="text-label-caps uppercase text-on-surface-variant mt-2 font-semibold">
                    Proctor Classification
                  </p>
                </CardShadow>
              </div>

              <CardShadow className="p-lg">
                <h3 className="text-headline-sm mb-4 font-semibold text-on-surface border-b border-outline-variant/40 pb-2">
                  Integrity Events Logs
                </h3>
                {bundle.events.length === 0 ? (
                  <EmptyState
                    icon="verified"
                    title="No violations recorded"
                    hint="The candidate maintained focus inside the window during the interview."
                  />
                ) : (
                  <ul className="space-y-3">
                    {bundle.events.map((e, idx) => {
                      const offsetSec = getOffsetSec(e.at);
                      return (
                        <li
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-lg bg-error-container/10 border border-error/20 hover:bg-error-container/20 transition"
                        >
                          <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-error">warning</span>
                            <div>
                              <div className="font-semibold text-on-surface text-body-md capitalize">
                                {e.type.replace(/_/g, " ")}
                              </div>
                              <div className="text-[11px] text-on-surface-variant">
                                {new Date(e.at).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => triggerSeek(offsetSec)}
                            className="px-3 py-1.5 bg-inverse-surface text-inverse-on-surface hover:bg-inverse-surface rounded text-label-caps font-semibold flex items-center gap-1.5 transition"
                          >
                            <Icon name="play_arrow" className="text-sm" />
                            Seek video to {fmtTime(offsetSec)}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardShadow>
            </div>
          )}

          {/* TAB 6: TRANSCRIPT */}
          {tab === "transcript" && (
            <CardShadow className="p-lg">
              <div className="flex items-center justify-between mb-4 border-b border-outline-variant/40 pb-3">
                <h3 className="text-headline-sm font-semibold text-on-surface">
                  Verbal Dialogue Transcript
                </h3>
                <button
                  type="button"
                  onClick={exportTranscriptCSV}
                  className="px-3.5 py-2 border border-outline-variant rounded-lg text-body-md flex items-center gap-2 hover:bg-surface-container-low transition"
                >
                  <Icon name="download" />
                  Export Transcript CSV
                </button>
              </div>
              <ul ref={transcriptRef} className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {turnsWithT.length === 0 && (
                  <li className="text-on-surface-variant italic">No verbal turns captured.</li>
                )}
                {turnsWithT.map((t, idx) => {
                  const isActive = idx === activeTurnIdx;
                  return (
                    <li
                      key={t.id}
                      data-idx={idx}
                      onClick={() => triggerSeek(t.t)}
                      className={`flex gap-3 cursor-pointer p-2 rounded-xl transition ${
                        t.speaker === "persona" ? "" : "flex-row-reverse"
                      } ${isActive ? "ring-2 ring-primary bg-primary/5" : "hover:bg-surface-container-low/40"}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-label-caps font-bold shrink-0 ${
                          t.speaker === "persona"
                            ? "bg-primary-container text-on-primary-container"
                            : "bg-secondary-container text-on-secondary-container"
                        }`}
                      >
                        {t.speaker === "persona" ? "AI" : "C"}
                      </div>
                      <div
                        className={`max-w-[80%] rounded-xl p-3 shadow-soft ${
                          t.speaker === "persona"
                            ? "bg-surface-container-low"
                            : "bg-primary-fixed text-on-primary-fixed-variant"
                        }`}
                      >
                        <div className="text-[10px] uppercase opacity-65 mb-1 flex items-center justify-between">
                          <span>{t.who}</span>
                          <span>{fmtTime(t.t)}</span>
                        </div>
                        <p className="text-body-md">{t.text}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardShadow>
          )}

          {/* TAB 7: RECORDING PLAYER */}
          {tab === "recording" && (
            <div className="space-y-lg">
              {/* Lifted Playback player deck */}
              <div className="bg-inverse-surface rounded-xl overflow-hidden shadow-2xl border border-outline-variant/15">
                {/* Audio visual / video streams area */}
                <div className="aspect-video flex items-center justify-center relative bg-gradient-to-br from-[#0c1c30] to-[#213145]">
                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${isPlaying ? "bg-error animate-ping" : "bg-white/40"}`}
                    />
                    <span className="text-label-caps text-white/70 font-bold uppercase tracking-wider">
                      {isPlaying ? "Replaying stream" : "Playback paused"}
                    </span>
                  </div>

                  {/* Pulsing indicator visual */}
                  <div className="relative">
                    <div
                      className={`w-32 h-32 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-display-md transition ${isPlaying ? "scale-105 shadow-2xl animate-pulse" : "scale-100"}`}
                    >
                      {iv.candidateName
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </div>
                  </div>

                  {/* Progress overlay */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-md flex items-end justify-between">
                    <div className="text-left">
                      <span className="text-label-caps text-white/60 font-semibold block uppercase">
                        Interview Recording Session
                      </span>
                      <span className="text-headline-sm text-white font-bold font-mono">
                        {fmtTime(currentSec)} / {fmtTime(durationSec)}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-xs text-white/50 bg-white/10 px-2 py-0.5 rounded">
                        Speed: {playbackSpeed}x
                      </span>
                    </div>
                  </div>
                </div>

                {/* Video scrubbing slider */}
                <div className="px-lg pt-4 pb-1 bg-black/40">
                  <input
                    type="range"
                    min={0}
                    max={durationSec}
                    value={currentSec}
                    onChange={(e) => setCurrentSec(Number(e.target.value))}
                    className="w-full accent-primary h-2 rounded bg-white/20 cursor-pointer"
                    aria-label="Seek Video Timeline"
                  />
                </div>

                {/* Audio controls bar */}
                <div className="px-lg py-md flex items-center justify-between bg-black/50 border-t border-white/5">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCurrentSec(Math.max(0, currentSec - 10))}
                      className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition"
                      title="Rewind 10s"
                    >
                      <span className="material-symbols-outlined text-[20px]">replay_10</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPlaying((prev) => !prev)}
                      className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center hover:brightness-110 shadow-lg transition"
                      aria-label={isPlaying ? "Pause Video" : "Play Video"}
                    >
                      <span className="material-symbols-outlined text-[24px]">
                        {isPlaying ? "pause" : "play_arrow"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentSec(Math.min(durationSec, currentSec + 10))}
                      className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition"
                      title="Skip Forward 10s"
                    >
                      <span className="material-symbols-outlined text-[20px]">forward_10</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentSec(0);
                        setIsPlaying(true);
                      }}
                      className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition"
                      title="Restart Playback"
                    >
                      <span className="material-symbols-outlined text-[20px]">replay</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-white/50 uppercase tracking-wider font-semibold">
                      Speed:
                    </span>
                    <select
                      value={playbackSpeed}
                      onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                      className="bg-white/10 text-white text-xs border border-white/10 rounded px-2 py-1 outline-none cursor-pointer"
                    >
                      <option value={0.5} className="bg-inverse-surface">
                        0.5×
                      </option>
                      <option value={1} className="bg-inverse-surface">
                        1×
                      </option>
                      <option value={1.5} className="bg-inverse-surface">
                        1.5×
                      </option>
                      <option value={2} className="bg-inverse-surface">
                        2×
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Snapshots log preview */}
              {bundle.snapshots.length > 0 && (
                <CardShadow className="p-lg">
                  <h3 className="text-headline-sm mb-4 font-semibold text-on-surface border-b border-outline-variant/40 pb-2">
                    Proctoring Snapshots Capture
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-md">
                    {bundle.snapshots.map((s) => {
                      const snapOffset = getOffsetSec(s.capturedAt);
                      return (
                        <div
                          key={s.id}
                          onClick={() => triggerSeek(snapOffset)}
                          className="block group border border-outline-variant rounded-xl p-2 bg-surface cursor-pointer hover:shadow-soft transition"
                        >
                          <div className="aspect-video bg-inverse-surface rounded-lg overflow-hidden">
                            {s.url ? (
                              <img
                                src={s.url}
                                alt={s.kind}
                                className="w-full h-full object-cover group-hover:scale-105 transition"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
                                <Icon name="image" />
                              </div>
                            )}
                          </div>
                          <div className="text-[10px] uppercase text-on-surface-variant mt-2 flex justify-between font-semibold">
                            <span>{s.kind}</span>
                            <span className="text-primary font-mono">{fmtTime(snapOffset)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardShadow>
              )}
            </div>
          )}

          {/* TAB 8: EXPLAINABLE AI (XAI) */}
          {tab === "xai" && (
            <div className="space-y-lg">
              <div className="bg-[#ecfeff] border border-[#06b6d4]/30 rounded-xl p-6 border-l-4 border-l-[#06b6d4]">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[#06b6d4] icon-fill">
                    auto_awesome
                  </span>
                  <h3 className="text-headline-sm text-on-surface font-semibold">
                    Explainable AI (XAI) Report
                  </h3>
                </div>
                <p className="text-body-md text-on-surface-variant leading-relaxed">
                  {r.xai_explanation ??
                    "The AI evaluate candidate responses against structural rubrics in real-time. Below are the key contributing factors that influenced the overall scoring and hire recommendations."}
                </p>
              </div>

              {xaiFactors.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                  {xaiFactors.map((factor, idx) => (
                    <XAIFactorCard key={idx} {...factor} />
                  ))}
                </div>
              ) : (
                <CardShadow className="p-lg">
                  <EmptyState
                    icon="auto_awesome"
                    title="No explainability factors generated"
                    hint="Generate reports to compile contribution weights."
                  />
                </CardShadow>
              )}
            </div>
          )}

          {/* TAB 9: RECRUITER NOTES */}
          {tab === "notes" && (
            <div className="space-y-lg">
              {savedNote && (
                <CardShadow className="p-lg border-l-4 border-l-primary bg-primary/5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">
                      edit_note
                    </span>
                    <span className="text-label-caps uppercase text-primary font-bold">
                      Logged Observation Notes
                    </span>
                  </div>
                  <p className="text-body-md text-on-surface whitespace-pre-wrap">{savedNote}</p>
                </CardShadow>
              )}

              <CardShadow className="p-lg">
                <h3 className="text-headline-sm mb-4 font-semibold text-on-surface border-b border-outline-variant/40 pb-2">
                  Add Assessment Observations
                </h3>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Record recruiter notes, technical observations, or feedback..."
                  rows={6}
                  className="w-full border border-outline-variant rounded-xl p-4 text-body-md resize-none outline-none focus:ring-2 focus:ring-primary-container bg-surface transition"
                />
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className="text-label-caps uppercase text-on-surface-variant mr-2 font-bold">
                    Assign Stars:
                  </span>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="text-[24px] leading-none transition transform hover:scale-110"
                    >
                      <span
                        className={`material-symbols-outlined ${star <= rating ? "icon-fill text-[#f59e0b]" : "text-outline"}`}
                      >
                        star
                      </span>
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={!note.trim()}
                    onClick={() => {
                      setSavedNote(note);
                      setNote("");
                      toast.success("Recruiter feedback notes saved.");
                    }}
                    className="ml-auto px-4 py-2 bg-primary text-on-primary rounded-lg hover:brightness-110 text-body-md disabled:opacity-50 transition"
                  >
                    Save Notes & Stars
                  </button>
                </div>
              </CardShadow>

              <CardShadow className="p-lg">
                <h3 className="text-headline-sm mb-4 font-semibold text-on-surface border-b border-outline-variant/40 pb-2">
                  Recruiter Action Decisions
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    {
                      label: "Shortlist",
                      icon: "bookmark_add",
                      color: "text-primary border-primary/30 bg-primary-container/20",
                    },
                    {
                      label: "Reject Candidate",
                      icon: "cancel",
                      color: "text-error border-error/30 bg-error-container/20",
                    },
                    {
                      label: "Maybe",
                      icon: "help",
                      color: "text-[#854d0e] border-[#fef08a] bg-[#fef9c3]/30",
                    },
                    {
                      label: "Recommend Next Round",
                      icon: "arrow_circle_right",
                      color: "text-secondary border-secondary/30 bg-secondary-container/20",
                    },
                    {
                      label: "Assign to Hiring Manager",
                      icon: "person_add",
                      color: "text-on-surface border-outline-variant bg-surface",
                    },
                    {
                      label: "Flag for Review",
                      icon: "flag",
                      color: "text-error border-error/30 bg-error-container/10",
                    },
                  ].map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => {
                        setRecruiterAction(action.label);
                        toast.success(`Hiring lifecycle decision logged: ${action.label}`);
                      }}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition hover:shadow-soft text-body-md font-semibold text-center ${action.color} ${recruiterAction === action.label ? "ring-2 ring-primary" : ""}`}
                    >
                      <span className="material-symbols-outlined text-[24px]">{action.icon}</span>
                      {action.label}
                    </button>
                  ))}
                </div>
                {recruiterAction && (
                  <div className="mt-4 px-4 py-2.5 rounded-lg bg-primary-container/30 border border-primary/20 text-body-md text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">
                      check_circle
                    </span>
                    Hiring workflow status set: <strong>{recruiterAction}</strong>
                  </div>
                )}
              </CardShadow>
            </div>
          )}

          {/* TAB 10: TIMELINE */}
          {tab === "timeline" && (
            <CardShadow className="p-lg">
              <h3 className="text-headline-sm mb-6 font-semibold text-on-surface border-b border-outline-variant/40 pb-2">
                Interview Logs Timeline
              </h3>
              {timelineEvents.length === 0 ? (
                <EmptyState
                  icon="timeline"
                  title="No logs recorded"
                  hint="Logs will appear once evaluation bundle completes processing."
                />
              ) : (
                <ol className="relative border-l-2 border-outline-variant/60 pl-6 space-y-6">
                  {timelineEvents.map((e, i) => (
                    <li
                      key={i}
                      onClick={() => triggerSeek(e.offsetSec)}
                      className="relative cursor-pointer group hover:bg-surface-container-low/40 p-2 rounded-lg transition"
                    >
                      <div className="absolute -left-[32px] top-3.5 w-4 h-4 rounded-full border-2 border-outline-variant bg-surface-container-lowest flex items-center justify-center">
                        <span className={`material-symbols-outlined text-[10px] ${e.color}`}>
                          {e.icon}
                        </span>
                      </div>
                      <div className="text-[10px] uppercase text-on-surface-variant font-bold mb-0.5">
                        {e.time ? new Date(e.time).toLocaleTimeString() : "—"} (Time:{" "}
                        {fmtTime(e.offsetSec)})
                      </div>
                      <div className="font-semibold text-on-surface text-body-md group-hover:text-primary group-hover:underline">
                        {e.label}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardShadow>
          )}
        </div>

        {/* Right Side: Candidate Summary Panel (Sidebar) */}
        <div className="xl:col-span-1 space-y-lg sticky top-20">
          {/* Quick Stats Panel */}
          <CardShadow className="p-lg bg-surface-container-low/40">
            <h4 className="font-bold mb-3 text-on-surface flex items-center gap-2 border-b border-outline-variant/40 pb-1 text-headline-sm">
              <span className="material-symbols-outlined text-primary text-[18px]">analytics</span>
              Scores Quick-View
            </h4>
            <div className="space-y-3">
              {Object.entries(r.scores ?? {}).map(([key, val]) => (
                <ScoreBar key={key} label={key} value={Number(val)} />
              ))}
              {Object.keys(r.scores ?? {}).length === 0 && (
                <p className="text-on-surface-variant italic text-xs">
                  No technical metrics recorded.
                </p>
              )}
            </div>
          </CardShadow>

          {/* Quick Integrity Summary */}
          <CardShadow className="p-lg bg-surface-container-low/40">
            <h4 className="font-bold mb-3 text-on-surface flex items-center gap-2 border-b border-outline-variant/40 pb-1 text-headline-sm">
              <span className="material-symbols-outlined text-primary text-[18px]">shield</span>
              Proctor Summary
            </h4>
            <div
              className={`text-headline-lg font-bold leading-none mb-1 ${scoreColor(iv.integrityScore ?? 100)}`}
            >
              {iv.integrityScore != null ? `${Math.round(iv.integrityScore)}%` : "—"}
            </div>
            <p className="text-xs text-on-surface-variant font-semibold uppercase">
              {bundle.events.length} proctor violations flagged
            </p>
          </CardShadow>

          {/* Candidate Profile Details */}
          <CardShadow className="p-lg bg-surface-container-low/40">
            <h4 className="font-bold mb-3 text-on-surface flex items-center gap-2 border-b border-outline-variant/40 pb-1 text-headline-sm">
              <span className="material-symbols-outlined text-primary text-[18px]">person</span>
              Candidate Profile
            </h4>
            <dl className="space-y-2.5 text-body-md">
              <div className="flex justify-between gap-2 border-b border-outline-variant/20 pb-1">
                <dt className="text-on-surface-variant text-xs font-semibold">Name</dt>
                <dd className="font-bold text-on-surface text-right text-xs truncate max-w-[65%]">
                  {iv.candidateName}
                </dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-outline-variant/20 pb-1">
                <dt className="text-on-surface-variant text-xs font-semibold">Email</dt>
                <dd className="text-on-surface text-right text-xs truncate max-w-[65%]">
                  {iv.candidateEmail || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-outline-variant/20 pb-1">
                <dt className="text-on-surface-variant text-xs font-semibold">Phone</dt>
                <dd className="text-on-surface text-right text-xs">{iv.candidatePhone || "—"}</dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-outline-variant/20 pb-1">
                <dt className="text-on-surface-variant text-xs font-semibold">Experience</dt>
                <dd className="text-on-surface text-right text-xs font-bold">
                  {iv.candidateExperienceYears} years
                </dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-outline-variant/20 pb-1">
                <dt className="text-on-surface-variant text-xs font-semibold">Applied Role</dt>
                <dd className="text-on-surface text-right text-xs truncate max-w-[65%]">
                  {iv.role}
                </dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-outline-variant/20 pb-1">
                <dt className="text-on-surface-variant text-xs font-semibold">Persona</dt>
                <dd className="text-on-surface text-right text-xs truncate max-w-[65%]">
                  {iv.personaName}
                </dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-outline-variant/20 pb-1">
                <dt className="text-on-surface-variant text-xs font-semibold">Duration</dt>
                <dd className="text-on-surface text-right text-xs">{iv.durationMinutes} minutes</dd>
              </div>
            </dl>

            {/* Candidate resume summary */}
            {iv.candidateResumeSummary && (
              <div className="mt-4 pt-3 border-t border-outline-variant/40">
                <dt className="text-label-caps uppercase text-on-surface-variant font-bold mb-1">
                  Resume Summary
                </dt>
                <dd className="text-xs text-on-surface-variant leading-relaxed bg-white p-2.5 rounded border border-outline-variant/30 text-justify max-h-48 overflow-y-auto">
                  {iv.candidateResumeSummary}
                </dd>
              </div>
            )}

            {/* Candidate skills list */}
            {iv.candidateSkills.length > 0 && (
              <div className="mt-4 pt-3 border-t border-outline-variant/40">
                <dt className="text-label-caps uppercase text-on-surface-variant font-bold mb-1.5">
                  Identified Skills
                </dt>
                <dd className="flex flex-wrap gap-1">
                  {iv.candidateSkills.map((skill) => (
                    <span
                      key={skill}
                      className="text-[10px] font-semibold px-2 py-0.5 bg-white border border-outline-variant/40 text-on-surface rounded"
                    >
                      {skill}
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </CardShadow>

          {/* Quick link button shortcuts */}
          <CardShadow className="p-lg bg-surface-container-low/40 print:hidden">
            <h4 className="font-bold mb-3 text-on-surface">Workspace Navigation</h4>
            <div className="space-y-1.5">
              {[
                { label: "Overview Analysis", tab: "overview" as TabKey, icon: "summarize" },
                { label: "Technical Score", tab: "technical" as TabKey, icon: "code" },
                { label: "Behavioral Alignment", tab: "behavioral" as TabKey, icon: "psychology" },
                { label: "Communications Score", tab: "communication" as TabKey, icon: "chat" },
                { label: "Integrity Events", tab: "integrity" as TabKey, icon: "shield" },
                { label: "Verbal Transcript", tab: "transcript" as TabKey, icon: "receipt_long" },
                { label: "Recording Player", tab: "recording" as TabKey, icon: "videocam" },
                { label: "Explainable AI Factor", tab: "xai" as TabKey, icon: "auto_awesome" },
                { label: "Observations & Decision", tab: "notes" as TabKey, icon: "edit_note" },
                { label: "Activity Timeline", tab: "timeline" as TabKey, icon: "timeline" },
              ].map((link) => (
                <button
                  key={link.tab}
                  type="button"
                  onClick={() => setTab(link.tab)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition text-xs text-left ${
                    tab === link.tab
                      ? "bg-primary text-on-primary font-bold shadow-soft"
                      : "hover:bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">{link.icon}</span>
                  {link.label}
                </button>
              ))}
            </div>
          </CardShadow>
        </div>
      </div>
    </>
  );
}
