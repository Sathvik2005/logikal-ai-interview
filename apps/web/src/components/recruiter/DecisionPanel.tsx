import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getCandidateDecisionState,
  submitCandidateDecision,
  type DecisionRecord,
} from "@/lib/candidates.functions";

const AI_LABEL: Record<string, string> = {
  strong_hire: "Strong hire",
  hire: "Hire",
  no_hire: "No hire",
  strong_no_hire: "Strong no hire",
};
const POSITIVE = new Set(["strong_hire", "hire"]);
const NEGATIVE = new Set(["strong_no_hire", "no_hire"]);
const MIN_NOTE = 10;

const OUTCOME: Record<DecisionRecord["decision"], { label: string; tone: string }> = {
  hire: { label: "Approved for hire", tone: "bg-[#dcfce7] text-[#166534]" },
  hold: { label: "On hold", tone: "bg-[#fef9c3] text-[#854d0e]" },
  reject: { label: "Rejected", tone: "bg-error-container text-on-error-container" },
};

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * The human decision step. The AI only recommends; this is where a named person approves, holds or rejects.
 * The backend enforces the same rules (reasons required, only after evaluation), so this is guidance + audit view.
 */
export function DecisionPanel({
  candidateId,
  className = "",
}: {
  candidateId: string;
  className?: string;
}) {
  const qc = useQueryClient();
  const stateFn = useServerFn(getCandidateDecisionState);
  const submitFn = useServerFn(submitCandidateDecision);
  const q = useQuery({
    queryKey: ["decision-state", candidateId],
    queryFn: () => stateFn({ data: { id: candidateId } }),
  });
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<"hire" | "hold" | "reject" | null>(null);

  const mutate = useMutation({
    mutationFn: (decision: "hire" | "hold" | "reject") =>
      submitFn({ data: { id: candidateId, decision, note: note.trim() || undefined } }),
    onSuccess: (rec) => {
      toast.success(OUTCOME[rec.decision].label + " — decision recorded.");
      setNote("");
      setPending(null);
      qc.invalidateQueries();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not record the decision"),
  });

  if (q.isLoading)
    return (
      <div className={`h-24 animate-pulse rounded-xl bg-surface-container-low ${className}`} />
    );
  if (q.error || !q.data) return null;

  const { awaiting, history, context } = q.data;
  const ai = context.aiRecommendation;
  const latest = history[0];

  const wouldOverride = (d: "hire" | "hold" | "reject") =>
    d !== "hold" && (!ai || (d === "hire" ? NEGATIVE.has(ai) : POSITIVE.has(ai)));
  const noteNeeded = (d: "hire" | "hold" | "reject") => d !== "hire" || wouldOverride(d);
  const canSubmit = (d: "hire" | "hold" | "reject") =>
    !noteNeeded(d) || note.trim().length >= MIN_NOTE;

  return (
    <section
      aria-labelledby={`decision-${candidateId}`}
      className={`rounded-xl border bg-surface-container-lowest p-lg shadow-soft ${
        awaiting ? "border-primary" : "border-outline-variant"
      } ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-md">
        <div>
          <h3 id={`decision-${candidateId}`} className="text-headline-sm text-on-background">
            {awaiting ? "Your decision" : "Hiring decision"}
          </h3>
          <p className="text-body-md text-on-surface-variant">
            {awaiting
              ? "The AI has finished its evaluation. It only recommends — you decide."
              : latest
                ? "A decision has been recorded for this candidate."
                : "A decision can be made once the interview has been evaluated."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-sm text-body-md">
          <span className="rounded-full bg-surface-container px-3 py-1">
            AI recommends: <strong>{ai ? (AI_LABEL[ai] ?? ai) : "no report yet"}</strong>
          </span>
          {context.aiScore != null && (
            <span className="rounded-full bg-surface-container px-3 py-1">
              Score {context.aiScore}/100
            </span>
          )}
          {context.integrityScore != null && (
            <span className="rounded-full bg-surface-container px-3 py-1">
              Integrity {Math.round(context.integrityScore)}%
            </span>
          )}
        </div>
      </div>

      {awaiting && (
        <div className="mt-md space-y-sm">
          <label className="block text-body-md">
            <span className="mb-1 block text-label-caps uppercase text-on-surface-variant">
              Reason{" "}
              {pending && !noteNeeded(pending)
                ? "(optional)"
                : "(required for reject, hold and overrides)"}
            </span>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              placeholder="Why this decision? Visible in the audit trail."
              className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2"
            />
          </label>

          {pending && wouldOverride(pending) && (
            <p
              role="alert"
              className="rounded-lg bg-[#fef9c3] px-3 py-2 text-body-md text-[#854d0e]"
            >
              This goes against the AI recommendation
              {ai ? ` (${AI_LABEL[ai] ?? ai})` : " (there is no AI report)"}. Your reason will be
              recorded as an override.
            </p>
          )}

          <div className="flex flex-wrap gap-sm">
            {(["hire", "hold", "reject"] as const).map((d) => {
              const selected = pending === d;
              const base =
                "rounded-lg px-4 py-2 text-body-md font-semibold transition disabled:opacity-50";
              if (!selected) {
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setPending(d)}
                    className={`${base} border border-outline-variant hover:bg-surface-container-low`}
                  >
                    {d === "hire" ? "Approve hire" : d === "hold" ? "Put on hold" : "Reject"}
                  </button>
                );
              }
              return (
                <button
                  key={d}
                  type="button"
                  disabled={!canSubmit(d) || mutate.isPending}
                  onClick={() => mutate.mutate(d)}
                  className={`${base} ${d === "reject" ? "bg-error text-on-error" : "bg-primary text-on-primary"} hover:brightness-110`}
                >
                  {mutate.isPending
                    ? "Recording…"
                    : `Confirm: ${d === "hire" ? "approve hire" : d === "hold" ? "put on hold" : "reject"}`}
                </button>
              );
            })}
            {pending && (
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded-lg px-3 py-2 text-body-md text-on-surface-variant hover:bg-surface-container-low"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <ul className="mt-md divide-y divide-outline-variant rounded-lg border border-outline-variant">
          {history.map((h) => (
            <li key={h.id} className="px-md py-sm text-body-md">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-label-caps font-semibold ${OUTCOME[h.decision].tone}`}
                >
                  {OUTCOME[h.decision].label}
                </span>
                {h.overrode_ai && (
                  <span className="rounded-full bg-[#fef9c3] px-2 py-0.5 text-label-caps text-[#854d0e]">
                    Overrode AI (
                    {h.ai_recommendation
                      ? (AI_LABEL[h.ai_recommendation] ?? h.ai_recommendation)
                      : "no report"}
                    )
                  </span>
                )}
                <span className="text-on-surface-variant">
                  by {h.decided_by_email ?? "unknown"} · {when(h.decided_at)}
                </span>
              </div>
              {h.note && <p className="mt-1 text-on-surface">{h.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
