import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { usePersonasQuery } from "@/components/recruiter/use-personas";
import { useJobsQuery } from "@/components/recruiter/use-jobs";
import { bulkScheduleInterviews, type BulkScheduleResult } from "@/lib/interviews.functions";

export type QuickScheduleCandidate = { id: string; name: string; email: string; role: string };

/** Next weekday at 10:00 local time, strictly in the future, formatted for <input type="datetime-local">. */
export function defaultStart(now = new Date()): string {
  const d = new Date(now);
  d.setHours(10, 0, 0, 0);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Schedule one or many candidates in a single step. Sensible defaults (next weekday 10:00, 45 min,
 * most recent AI interviewer) mean the common case is: open -> check the preview -> confirm.
 */
export function QuickScheduleDialog({
  open,
  onOpenChange,
  candidates,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: QuickScheduleCandidate[];
}) {
  const qc = useQueryClient();
  const personas = usePersonasQuery();
  const jobs = useJobsQuery();
  const bulkFn = useServerFn(bulkScheduleInterviews);

  const [personaId, setPersonaId] = useState("");
  const [jobId, setJobId] = useState("");
  const [startAt, setStartAt] = useState(defaultStart);
  const [duration, setDuration] = useState(45);
  const [gap, setGap] = useState(15);
  const [workStart, setWorkStart] = useState(9);
  const [workEnd, setWorkEnd] = useState(18);
  const [plan, setPlan] = useState<BulkScheduleResult | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<BulkScheduleResult | null>(null);
  const requestId = useRef(0);

  const personaList = Array.isArray(personas.data) ? personas.data : [];
  const jobList = Array.isArray(jobs.data) ? jobs.data : [];

  // Default the AI interviewer to the first one available.
  useEffect(() => {
    if (!personaId && personaList.length) setPersonaId(personaList[0].id);
  }, [personaId, personaList]);

  // Reset when reopened.
  useEffect(() => {
    if (open) {
      setStartAt(defaultStart());
      setDone(null);
      setPlan(null);
      setPlanError(null);
    }
  }, [open]);

  const request = useMemo(
    () => ({
      candidateIds: candidates.map((c) => c.id),
      startAt: startAt ? new Date(startAt).toISOString() : "",
      personaId: personaId || null,
      jobId: jobId || null,
      durationMinutes: duration,
      gapMinutes: gap,
      workStartHour: workStart,
      workEndHour: workEnd,
      utcOffsetMinutes: -new Date().getTimezoneOffset(),
    }),
    [candidates, startAt, personaId, jobId, duration, gap, workStart, workEnd],
  );

  // Live preview (dry run), debounced; only the latest response is applied.
  useEffect(() => {
    if (!open || !request.startAt || candidates.length === 0) return;
    const id = ++requestId.current;
    setPlanning(true);
    const timer = setTimeout(async () => {
      try {
        const res = await bulkFn({ data: { ...request, dryRun: true } });
        if (id === requestId.current) {
          setPlan(res);
          setPlanError(null);
        }
      } catch (err) {
        if (id === requestId.current) {
          setPlan(null);
          setPlanError(err instanceof Error ? err.message : "Could not plan the schedule");
        }
      } finally {
        if (id === requestId.current) setPlanning(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [open, request, candidates.length, bulkFn]);

  const confirm = async () => {
    setSending(true);
    try {
      const res = await bulkFn({ data: { ...request, dryRun: false } });
      setDone(res);
      await qc.invalidateQueries();
      if (res.created > 0)
        toast.success(`${res.created} interview(s) scheduled — invitations are being emailed.`);
      if (res.failed > 0) toast.warning(`${res.failed} could not be scheduled — see the list.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scheduling failed");
    } finally {
      setSending(false);
    }
  };

  const rows = (done ?? plan)?.results ?? [];
  const canConfirm =
    !!plan && plan.schedulable > 0 && !planning && !sending && !planError && !!personaId && !done;
  const label = candidates.length === 1 ? "candidate" : "candidates";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[40rem]">
        <DialogTitle>Quick schedule</DialogTitle>
        <DialogDescription>
          {done
            ? "Done. Invitations are queued and will be emailed to each candidate."
            : `Schedule ${candidates.length} ${label} in one step. Times are planned automatically — adjust if needed.`}
        </DialogDescription>

        {!done && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-body-md">
              <span className="mb-1 block text-label-caps uppercase text-on-surface-variant">
                AI interviewer
              </span>
              <select
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2"
                value={personaId}
                onChange={(e) => setPersonaId(e.target.value)}
              >
                {personaList.length === 0 && <option value="">No AI interviewer yet</option>}
                {personaList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-body-md">
              <span className="mb-1 block text-label-caps uppercase text-on-surface-variant">
                Job role
              </span>
              <select
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
              >
                <option value="">Each candidate&apos;s own role</option>
                {jobList.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-body-md sm:col-span-2">
              <span className="mb-1 block text-label-caps uppercase text-on-surface-variant">
                First interview starts
              </span>
              <input
                type="datetime-local"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </label>
            <details className="sm:col-span-2 text-body-md">
              <summary className="cursor-pointer text-primary">More options</summary>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <NumberField
                  label="Length (min)"
                  value={duration}
                  min={10}
                  max={240}
                  step={5}
                  onChange={setDuration}
                />
                <NumberField
                  label="Gap (min)"
                  value={gap}
                  min={0}
                  max={120}
                  step={5}
                  onChange={setGap}
                />
                <NumberField
                  label="Day starts (h)"
                  value={workStart}
                  min={0}
                  max={23}
                  onChange={setWorkStart}
                />
                <NumberField
                  label="Day ends (h)"
                  value={workEnd}
                  min={1}
                  max={24}
                  onChange={setWorkEnd}
                />
              </div>
            </details>
          </div>
        )}

        {planError && (
          <p
            role="alert"
            className="rounded-lg bg-error-container px-3 py-2 text-body-md text-on-error-container"
          >
            {planError}
          </p>
        )}

        <div className="max-h-[260px] overflow-y-auto rounded-lg border border-outline-variant">
          {rows.length === 0 ? (
            <p className="p-md text-body-md text-on-surface-variant">
              {planning ? "Planning…" : "Nothing to show yet."}
            </p>
          ) : (
            <ul className="divide-y divide-outline-variant">
              {rows.map((r) => (
                <li
                  key={r.candidateId}
                  className="flex items-center justify-between gap-md px-md py-2 text-body-md"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{r.name ?? r.candidateId}</span>
                    <span className="block truncate text-on-surface-variant">{r.email}</span>
                  </span>
                  {r.ok && r.scheduledAt ? (
                    <span className="shrink-0 text-on-surface">
                      {done ? "✓ " : ""}
                      {fmt(r.scheduledAt)}
                    </span>
                  ) : (
                    <span className="shrink-0 text-error">{r.error ?? "Skipped"}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-md">
          <p className="text-body-md text-on-surface-variant" aria-live="polite">
            {done
              ? `${done.created} scheduled, ${done.failed} skipped`
              : plan
                ? `${plan.schedulable} of ${plan.requested} will be scheduled`
                : ""}
          </p>
          <div className="flex gap-sm">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-outline-variant px-4 py-2 text-body-md hover:bg-surface-container-low"
            >
              {done ? "Close" : "Cancel"}
            </button>
            {!done && (
              <button
                type="button"
                disabled={!canConfirm}
                onClick={confirm}
                className="rounded-lg bg-primary px-4 py-2 text-body-md font-semibold text-on-primary hover:brightness-110 disabled:opacity-50"
              >
                {sending
                  ? "Scheduling…"
                  : `Schedule ${plan?.schedulable ?? candidates.length} & email invites`}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="text-body-md">
      <span className="mb-1 block text-label-caps uppercase text-on-surface-variant">{label}</span>
      <input
        type="number"
        className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
    </label>
  );
}
