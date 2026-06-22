import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CardShadow, Icon, EmptyState, SkeletonCard } from "@/components/recruiter/RecruiterShell";
import { fmtDate } from "@/components/recruiter/mock-data";
import { supabase } from "@/integrations/supabase/client";
import {
  listLiveInterviews,
  listRecordedSessions,
  getMonitorSession,
  flagSessionEvent,
  type LiveInterviewDTO,
  type RecordedSessionDTO,
  type MonitorTurn,
  type MonitorEvent,
} from "@/lib/monitor.functions";
import { useEndSession } from "@/components/recruiter/use-interview-runtime";

export const Route = createFileRoute("/_authenticated/recruiter/monitor/")({
  component: ActiveMonitor,
});

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function initialsOf(name: string) {
  return name.split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "C";
}

function ActiveMonitor() {
  const qc = useQueryClient();
  // Wrap server fns once; bearer token is attached by attachSupabaseAuth.
  const liveFn = useServerFn(listLiveInterviews);
  const recordedFn = useServerFn(listRecordedSessions);
  const flagFn = useServerFn(flagSessionEvent);

  const liveQ = useQuery({
    queryKey: ["monitor", "live"],
    queryFn: () => liveFn({}),
    refetchInterval: 15_000,
  });
  const recordedQ = useQuery({
    queryKey: ["monitor", "recorded"],
    queryFn: () => recordedFn({}),
  });

  const live: LiveInterviewDTO | null = (liveQ.data as LiveInterviewDTO[] | undefined)?.[0] ?? null;
  const recorded: RecordedSessionDTO[] = (recordedQ.data as RecordedSessionDTO[] | undefined) ?? [];
  const [playback, setPlayback] = useState<RecordedSessionDTO | null>(null);

  const handleFlag = async () => {
    if (!live) return;
    const targetSessionId = live.sessionId;
    if (!targetSessionId) {
      toast.error("No active session to flag yet");
      return;
    }
    const note = prompt("Enter a brief description for this flag:");
    if (!note || !note.trim()) return;
    try {
      await flagFn({ data: { sessionId: targetSessionId, note: note.trim() } });
      toast.success("Session flagged successfully");
      qc.invalidateQueries({ queryKey: ["monitor"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to flag session");
    }
  };

  // Deep-link support: /recruiter/monitor#playback-<interviewId>
  useEffect(() => {
    const openFromHash = () => {
      const h = window.location.hash;
      const m = h.match(/^#playback-(.+)$/);
      if (!m) return;
      const target = recorded.find((r) => r.interviewId === m[1]);
      if (target) setPlayback(target);
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [recorded]);

  return (
    <>
      <div className="mb-lg grid grid-cols-[minmax(0,1fr)_auto] items-center gap-md sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-headline-lg flex items-center gap-2">
            {live && (
              <span className="px-2 py-1 rounded-full bg-error text-on-error text-label-caps uppercase flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-on-error animate-pulse" />LIVE
              </span>
            )}
            Active Interview Monitor
          </h2>
          <p className="text-body-lg text-on-surface-variant">
            {live ? `${live.candidateName} • ${live.role} • ${live.personaName}` : "No live interviews right now."}
          </p>
        </div>
        {live && (
          <div className="flex gap-sm">
            <button type="button" onClick={handleFlag} className="px-4 py-2 border border-outline-variant rounded-lg flex items-center gap-2 hover:bg-surface-container-low"><Icon name="flag" />Flag</button>
            <Link to="/recruiter/reports/$interviewId" params={{ interviewId: live.id }} className="px-4 py-2 bg-primary text-on-primary rounded-lg flex items-center gap-2 hover:brightness-110"><Icon name="stop" />End & Score</Link>
          </div>
        )}
      </div>

      {liveQ.isLoading ? (
        <SkeletonCard />
      ) : live ? (
        <LiveSession live={live} />
      ) : (
        <CardShadow className="p-lg">
          <EmptyState title="No live interviews" hint="Scheduled sessions will appear here when they start." />
        </CardShadow>
      )}

      <section className="mt-xl">
        <div className="mb-md flex items-end justify-between flex-wrap gap-md">
          <div>
            <h3 className="text-headline-md flex items-center gap-2"><Icon name="smart_display" className="text-primary" />Recorded interviews</h3>
            <p className="text-body-md text-on-surface-variant">Every completed interview is recorded. Click any tile to replay the session.</p>
          </div>
          <span className="text-label-caps uppercase text-on-surface-variant">{recorded.length} recordings</span>
        </div>

        {recordedQ.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-lg">
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        ) : recorded.length === 0 ? (
          <CardShadow className="p-lg">
            <EmptyState title="No recordings yet" hint="Recordings will appear after candidates complete an interview." />
          </CardShadow>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-lg">
            {recorded.map((iv) => {
              const initials = initialsOf(iv.candidateName);
              return (
                <button type="button" key={iv.id} onClick={() => setPlayback(iv)} className="text-left">
                  <CardShadow className="overflow-hidden transition hover:shadow-lg hover:-translate-y-0.5">
                    <div className="aspect-video bg-inverse-surface relative flex items-center justify-center">
                      <div className="w-20 h-20 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-headline-md">{initials}</div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/30 transition">
                        <div className="w-14 h-14 rounded-full bg-primary text-on-primary flex items-center justify-center"><Icon name="play_arrow" className="text-3xl" /></div>
                      </div>
                      <span className="absolute top-2 left-2 text-label-caps uppercase bg-error/90 text-on-error px-2 py-0.5 rounded flex items-center gap-1">
                        <Icon name="fiber_manual_record" className="text-xs" />Recorded
                      </span>
                      <span className="absolute bottom-2 right-2 text-label-caps bg-black/60 text-white px-2 py-0.5 rounded">{formatTime(iv.durationSec)}</span>
                    </div>
                    <div className="p-md">
                      <p className="font-semibold text-on-surface">{iv.candidateName}</p>
                      <p className="text-body-md text-on-surface-variant">{iv.role} • {iv.personaName}</p>
                      <p className="text-label-caps uppercase text-on-surface-variant mt-1">{iv.scheduledAt ? fmtDate(iv.scheduledAt) : "—"}</p>
                    </div>
                  </CardShadow>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {playback && <PlaybackModal recorded={playback} onClose={() => setPlayback(null)} />}
    </>
  );
}

function LiveSession({ live }: { live: LiveInterviewDTO }) {
  const sessionFn = useServerFn(getMonitorSession);
  const endSessionMut = useEndSession();
  const qc = useQueryClient();
  const [observing, setObserving] = useState(true);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [reconnectKey, setReconnectKey] = useState(0);
  const { data, error, refetch, isFetching } = useQuery({
    queryKey: ["monitor", "session", live.id, reconnectKey],
    queryFn: () => sessionFn({ data: { interviewId: live.id } }),
    refetchInterval: observing ? 30_000 : false, // use real-time Postgres changes primarily
  });
  const turns: MonitorTurn[] = ((data as { turns?: MonitorTurn[] } | undefined)?.turns) ?? [];
  const events: MonitorEvent[] = ((data as { events?: MonitorEvent[] } | undefined)?.events) ?? [];
  const sessionId = (data as { session?: { id: string } | null } | undefined)?.session?.id ?? live.sessionId;
  const initials = initialsOf(live.candidateName);

  // Set up real-time channels
  useEffect(() => {
    if (!sessionId || !observing) return;

    const turnsChannel = supabase
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
        }
      )
      .subscribe();

    const eventsChannel = supabase
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
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(turnsChannel);
      void supabase.removeChannel(eventsChannel);
    };
  }, [sessionId, observing, refetch]);

  const handleReconnect = () => {
    setObserving(true);
    setReconnectKey((k) => k + 1);
    refetch();
    toast.success("Reconnecting to live feed…");
  };

  const handleEnd = async () => {
    if (!sessionId) {
      toast.error("No active session to end");
      return;
    }
    try {
      await endSessionMut.mutateAsync({ sessionId });
      toast.success("Session ended — evaluation queued");
      setObserving(false);
      setConfirmEnd(false);
      qc.invalidateQueries({ queryKey: ["monitor"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not end session");
    }
  };

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
      <div className="lg:col-span-2 space-y-lg">
        <CardShadow className="aspect-video bg-inverse-surface text-inverse-on-surface relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-on-primary-container text-display-lg font-bold">{initials}</div>
          </div>
          <div className="absolute bottom-md left-md right-md flex items-center justify-between text-label-caps uppercase">
            <span className={`px-2 py-1 rounded ${observing ? "bg-error/90" : "bg-on-surface-variant/80"}`}>{observing ? "LIVE" : "PAUSED"}</span>
            <span>{live.candidateName}</span>
          </div>
        </CardShadow>

        <CardShadow>
          <div className="p-lg border-b border-outline-variant"><h3 className="text-headline-sm">Live transcript</h3></div>
          <ul className="p-lg space-y-md max-h-[320px] overflow-y-auto">
            {turns.length === 0 && <li className="text-on-surface-variant text-body-md italic">Waiting for the first exchange…</li>}
            {turns.map((m) => (
              <li key={m.id} className={`flex gap-3 ${m.who === "AI" ? "" : "flex-row-reverse"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-label-caps font-semibold ${m.who === "AI" ? "bg-primary-container text-on-primary-container" : "bg-secondary-container text-on-secondary-container"}`}>{m.who === "AI" ? "AI" : "C"}</div>
                <div className={`max-w-[80%] p-3 rounded-lg ${m.who === "AI" ? "bg-surface-container-low" : "bg-primary-fixed text-on-primary-fixed-variant"}`}>{m.text}</div>
              </li>
            ))}
          </ul>
        </CardShadow>
      </div>

      <div className="space-y-lg">
        <CardShadow className="p-lg">
          <h3 className="text-headline-sm mb-md flex items-center gap-2">
            <Icon name="visibility" className="text-primary" />Observer controls
          </h3>
          <p className="text-body-sm text-on-surface-variant mb-md">
            Interview <span className="font-mono">{live.id.slice(0, 8)}</span>
            {sessionId && <> · session <span className="font-mono">{sessionId.slice(0, 8)}</span></>}
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setObserving((o) => !o)}
              className={`px-3 py-2 rounded-lg text-body-md flex items-center gap-2 ${
                observing ? "bg-error-container text-on-error-container" : "bg-primary text-on-primary"
              }`}
            >
              <Icon name={observing ? "pause" : "play_arrow"} />
              {observing ? "Pause monitoring" : "Start monitoring"}
            </button>
            <button
              type="button"
              onClick={handleReconnect}
              disabled={isFetching}
              className="px-3 py-2 rounded-lg border border-outline-variant hover:bg-surface-container-low text-body-md flex items-center gap-2 disabled:opacity-60"
            >
              <Icon name="refresh" className={isFetching ? "animate-spin" : ""} />
              Reconnect
            </button>
            <button
              type="button"
              onClick={() => setConfirmEnd(true)}
              disabled={!sessionId || endSessionMut.isPending}
              className="px-3 py-2 rounded-lg bg-error text-on-error text-body-md flex items-center gap-2 disabled:opacity-60"
            >
              <Icon name="stop_circle" />End session
            </button>
            {error && <p className="text-body-sm text-error">Connection error — try reconnect.</p>}
            {!observing && <p className="text-body-sm text-on-surface-variant italic">Monitoring paused.</p>}
          </div>
        </CardShadow>

        <CardShadow className="p-lg">
          <h3 className="text-headline-sm mb-md">Session</h3>
          <dl className="text-body-md space-y-2">
            <div className="flex justify-between"><dt className="text-on-surface-variant">Persona</dt><dd>{live.personaName}</dd></div>
            <div className="flex justify-between"><dt className="text-on-surface-variant">Role</dt><dd>{live.role}</dd></div>
            <div className="flex justify-between"><dt className="text-on-surface-variant">Duration</dt><dd>{live.durationMinutes} min</dd></div>
            <div className="flex justify-between"><dt className="text-on-surface-variant">Status</dt><dd className="capitalize">{live.status.replace(/_/g, " ")}</dd></div>
          </dl>
        </CardShadow>

        <CardShadow className="p-lg ai-insight">
          <h3 className="text-headline-sm mb-4 flex items-center gap-2">
            <Icon name="auto_awesome" className="text-secondary" />Live Signals & Proctoring
          </h3>
          {events.length === 0 ? (
            <p className="text-body-md text-on-surface-variant italic">No alerts or events recorded yet.</p>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {events.map((ev) => {
                let note = "";
                if (ev.type === "manual_flag" && ev.payload) {
                  try {
                    const parsed = JSON.parse(ev.payload);
                    note = parsed.note ?? "";
                  } catch {}
                }
                const isFlag = ev.type === "manual_flag" || ev.type.includes("lost") || ev.type.includes("switch");
                return (
                  <div key={ev.id} className={`p-3 rounded-lg border text-body-md flex items-start gap-2 ${isFlag ? "bg-error-container/20 border-error/20 text-on-error-container" : "bg-surface-container-low border-outline-variant"}`}>
                    <Icon name={isFlag ? "warning" : "info"} className={`text-md ${isFlag ? "text-error" : "text-primary"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold capitalize">{ev.type.replace(/_/g, " ")}</p>
                      {note && <p className="text-body-sm mt-0.5 text-red-700 font-medium">{note}</p>}
                      <p className="text-xs opacity-75 mt-1">{new Date(ev.at).toLocaleTimeString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardShadow>
      </div>
    </div>
    {confirmEnd && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" onClick={() => setConfirmEnd(false)}>
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-soft max-w-md w-full p-lg" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-headline-sm mb-2">End this interview session?</h3>
          <p className="text-body-md text-on-surface-variant mb-md">
            The candidate will be disconnected and the AI evaluation will be queued. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmEnd(false)} className="px-3 py-2 rounded-lg border border-outline-variant">Cancel</button>
            <button type="button" onClick={handleEnd} className="px-3 py-2 rounded-lg bg-error text-on-error font-semibold">End session</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function PlaybackModal({ recorded, onClose }: { recorded: RecordedSessionDTO; onClose: () => void }) {
  const sessionFn = useServerFn(getMonitorSession);
  const { data, isLoading } = useQuery({
    queryKey: ["monitor", "session", recorded.interviewId],
    queryFn: () => sessionFn({ data: { interviewId: recorded.interviewId } }),
  });
  const turns: MonitorTurn[] = ((data as { turns?: MonitorTurn[] } | undefined)?.turns) ?? [];
  const durationSec = recorded.durationSec || 1;
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(true);
  const initials = initialsOf(recorded.candidateName);
  const transcriptRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setCurrent((c) => {
        if (c >= durationSec) { setPlaying(false); return durationSec; }
        return c + 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [playing, durationSec]);

  // Distribute turns evenly across the timeline so the user sees them as we scrub.
  const turnsWithT = useMemo(() => {
    if (turns.length === 0) return [] as Array<MonitorTurn & { t: number }>;
    const step = durationSec / turns.length;
    return turns.map((t, i) => ({ ...t, t: Math.floor(i * step) }));
  }, [turns, durationSec]);

  const visible = turnsWithT.filter((t) => t.t <= current);
  const activeIdx = visible.length - 1;

  useEffect(() => {
    const el = transcriptRef.current?.querySelector<HTMLLIElement>(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIdx]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-soft w-full max-w-4xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-md border-b border-outline-variant flex items-center justify-between">
          <div>
            <h3 className="text-headline-sm">{recorded.candidateName} — Playback</h3>
            <p className="text-label-caps uppercase text-on-surface-variant">{recorded.role} • {recorded.personaName} • {recorded.scheduledAt ? fmtDate(recorded.scheduledAt) : "—"}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full hover:bg-surface-container-low flex items-center justify-center"><Icon name="close" /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-0">
          <div className="md:col-span-3 bg-inverse-surface relative aspect-video flex items-center justify-center">
            <div className="w-28 h-28 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-display-sm">{initials}</div>
            <span className="absolute bottom-2 right-2 text-label-caps bg-black/60 text-white px-2 py-0.5 rounded">
              {formatTime(current)} / {formatTime(durationSec)}
            </span>
          </div>

          <div className="md:col-span-2 border-l border-outline-variant flex flex-col max-h-[60vh]">
            <div className="p-md border-b border-outline-variant text-label-caps uppercase text-on-surface-variant">Transcript</div>
            <ul ref={transcriptRef} className="flex-1 overflow-y-auto p-md space-y-2">
              {isLoading && <li className="text-on-surface-variant italic text-body-md">Loading transcript…</li>}
              {!isLoading && turnsWithT.length === 0 && <li className="text-on-surface-variant italic text-body-md">No transcript captured for this session.</li>}
              {visible.map((turn, i) => (
                <li
                  key={turn.id}
                  data-idx={i}
                  className={`p-2 rounded-lg text-body-md ${i === activeIdx ? "bg-primary-container text-on-primary-container" : "bg-surface-container-low text-on-surface"}`}
                >
                  <span className="text-label-caps uppercase opacity-70 mr-2">{formatTime(turn.t)} · {turn.who}</span>
                  {turn.text}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="p-md border-t border-outline-variant space-y-2">
          <input
            type="range"
            min={0}
            max={durationSec}
            value={current}
            onChange={(e) => setCurrent(Number(e.target.value))}
            className="w-full accent-primary"
            aria-label="Scrub"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPlaying((p) => !p)} className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center hover:brightness-110" aria-label={playing ? "Pause" : "Play"}>
                <Icon name={playing ? "pause" : "play_arrow"} />
              </button>
              <button type="button" onClick={() => { setCurrent(0); setPlaying(true); }} className="w-10 h-10 rounded-full border border-outline-variant flex items-center justify-center hover:bg-surface-container-low" aria-label="Restart">
                <Icon name="replay" />
              </button>
              <span className="text-label-caps uppercase text-on-surface-variant ml-2">{formatTime(current)} / {formatTime(durationSec)}</span>
            </div>
            <Link to="/recruiter/reports/$interviewId" params={{ interviewId: recorded.interviewId }} className="px-3 py-2 bg-secondary text-on-secondary rounded-lg flex items-center gap-2 hover:brightness-110 text-body-md">
              <Icon name="description" />Open report
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
