import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Icon } from "@/components/recruiter/RecruiterShell";
import { useJobsQuery } from "@/components/recruiter/use-jobs";
import { usePersonasQuery } from "@/components/recruiter/use-personas";
import { useCandidatesQuery } from "@/components/recruiter/use-candidates";
import { useInterviewsQuery } from "@/components/recruiter/use-interviews";

const DISMISS_KEY = "lokality.gettingStarted.dismissed";

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

type Step = { title: string; hint: string; to: string; cta: string; done: boolean };

/**
 * End-to-end checklist for a new workspace: role -> AI interviewer -> candidates -> schedule -> results.
 * Progress is derived from real data, so it stays correct without any extra state.
 */
export function GettingStarted() {
  const [dismissed, setDismissed] = useState(readDismissed);
  const jobs = useJobsQuery();
  const personas = usePersonasQuery();
  const candidates = useCandidatesQuery();
  const interviews = useInterviewsQuery();

  const count = (q: { data?: unknown }) => (Array.isArray(q.data) ? q.data.length : 0);
  const loading = [jobs, personas, candidates, interviews].some((q) => q.isLoading);
  const completed = Array.isArray(interviews.data)
    ? (interviews.data as Array<{ status?: string }>).filter((i) => i.status === "completed").length
    : 0;

  const steps: Step[] = [
    {
      title: "Create a job role",
      hint: "Describe the role you are hiring for.",
      to: "/recruiter/jobs/new",
      cta: "Create role",
      done: count(jobs) > 0,
    },
    {
      title: "Set up an AI interviewer",
      hint: "Pick the tone, difficulty and focus of the interview.",
      to: "/recruiter/personas/new",
      cta: "Set up interviewer",
      done: count(personas) > 0,
    },
    {
      title: "Add candidates",
      hint: "Upload resumes, import a CSV or add people one by one.",
      to: "/recruiter/candidates",
      cta: "Add candidates",
      done: count(candidates) > 0,
    },
    {
      title: "Schedule an interview",
      hint: "Choose a candidate, a role and a time. They get a link by email.",
      to: "/recruiter/scheduling",
      cta: "Schedule interview",
      done: count(interviews) > 0,
    },
    {
      title: "Review the results",
      hint: "Read the AI report and decide: hire, maybe or reject.",
      to: "/recruiter/reports",
      cta: "Open results",
      done: completed > 0,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (dismissed || loading || doneCount === steps.length) return null;
  const nextIndex = steps.findIndex((s) => !s.done);

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* dismissal just won't persist */
    }
  };

  return (
    <section
      aria-labelledby="getting-started-title"
      className="mb-xl rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-soft"
    >
      <div className="flex items-start justify-between gap-md">
        <div>
          <h3 id="getting-started-title" className="text-headline-sm text-on-background">
            Get your first hire moving
          </h3>
          <p className="text-body-md text-on-surface-variant mt-1">
            {doneCount} of {steps.length} steps done — follow them in order, each takes a minute or
            two.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg px-2 py-1 text-body-md text-on-surface-variant hover:bg-surface-container-low"
        >
          Hide
        </button>
      </div>

      <div
        className="mt-md h-2 w-full overflow-hidden rounded-full bg-surface-container"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={doneCount}
        aria-label="Setup progress"
      >
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>

      <ol className="mt-md grid gap-sm md:grid-cols-2 xl:grid-cols-5">
        {steps.map((s, i) => {
          const isNext = i === nextIndex;
          return (
            <li
              key={s.title}
              className={`flex flex-col justify-between rounded-lg border p-md ${
                isNext
                  ? "border-primary bg-primary-container/10"
                  : "border-outline-variant bg-surface"
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-label-caps font-semibold ${
                      s.done
                        ? "bg-[#dcfce7] text-[#166534]"
                        : "bg-surface-container text-on-surface"
                    }`}
                    aria-hidden
                  >
                    {s.done ? <Icon name="check" className="text-[16px]" /> : i + 1}
                  </span>
                  <p className="text-body-md font-semibold text-on-background">{s.title}</p>
                  {s.done && <span className="sr-only">(done)</span>}
                </div>
                <p className="mt-2 text-body-md text-on-surface-variant">{s.hint}</p>
              </div>
              {!s.done && (
                <Link
                  to={s.to}
                  className={`mt-md rounded-lg px-3 py-2 text-center text-body-md font-semibold ${
                    isNext
                      ? "bg-primary text-on-primary hover:brightness-110"
                      : "border border-outline-variant text-on-surface hover:bg-surface-container-low"
                  }`}
                >
                  {isNext ? `Next: ${s.cta}` : s.cta}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
