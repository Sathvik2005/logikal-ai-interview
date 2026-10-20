import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAwaitingDecisions } from "@/lib/candidates.functions";

const AI_LABEL: Record<string, string> = {
  strong_hire: "Strong hire",
  hire: "Hire",
  no_hire: "No hire",
  strong_no_hire: "Strong no hire",
};

const waitingFor = (iso: string) => {
  const hours = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
};

/** Dashboard queue: interviews the AI has evaluated that are waiting for a person to decide. */
export function AwaitingDecisionCard() {
  const fn = useServerFn(listAwaitingDecisions);
  const q = useQuery({
    queryKey: ["awaiting-decisions"],
    queryFn: () => fn({}),
    refetchInterval: 30_000,
  });
  const items = Array.isArray(q.data) ? q.data : [];
  if (q.isLoading || items.length === 0) return null;

  return (
    <section
      aria-labelledby="awaiting-title"
      className="mb-xl rounded-xl border border-primary bg-surface-container-lowest p-lg shadow-soft"
    >
      <h3 id="awaiting-title" className="text-headline-sm text-on-background">
        Waiting for your decision{" "}
        <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-label-caps text-on-primary">
          {items.length}
        </span>
      </h3>
      <p className="text-body-md text-on-surface-variant">
        The AI has finished these interviews. Nobody is hired or rejected until you decide.
      </p>
      <ul className="mt-md divide-y divide-outline-variant">
        {items.slice(0, 6).map((c) => (
          <li
            key={c.candidateId}
            className="flex flex-wrap items-center justify-between gap-md py-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold text-on-background">{c.name}</p>
              <p className="truncate text-body-md text-on-surface-variant">
                {c.role ?? "—"} · waiting {waitingFor(c.waitingSince)}
              </p>
            </div>
            <div className="flex items-center gap-sm text-body-md">
              <span className="rounded-full bg-surface-container px-3 py-1">
                AI:{" "}
                {c.aiRecommendation ? (AI_LABEL[c.aiRecommendation] ?? c.aiRecommendation) : "—"}
                {c.aiScore != null ? ` · ${c.aiScore}` : ""}
              </span>
              {c.interviewId ? (
                <Link
                  to="/recruiter/reports/$interviewId"
                  params={{ interviewId: c.interviewId }}
                  className="rounded-lg bg-primary px-3 py-2 font-semibold text-on-primary hover:brightness-110"
                >
                  Review &amp; decide
                </Link>
              ) : (
                <Link
                  to="/recruiter/candidates/$id"
                  params={{ id: c.candidateId }}
                  className="rounded-lg border border-outline-variant px-3 py-2 font-semibold hover:bg-surface-container-low"
                >
                  Open candidate
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
