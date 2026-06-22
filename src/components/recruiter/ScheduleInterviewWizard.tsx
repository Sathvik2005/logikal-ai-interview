import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Icon } from "@/components/recruiter/RecruiterShell";
import { type Interview } from "@/components/recruiter/mock-data";
import { useCandidatesQuery, type CandidateDTO } from "@/components/recruiter/use-candidates";
import { useJobsQuery } from "@/components/recruiter/use-jobs";
import { usePersonasQuery } from "@/components/recruiter/use-personas";
import {
  isProfileComplete,
  getMissingFields,
  FIELD_LABELS,
} from "@/components/recruiter/candidate-completeness";

type Candidate = CandidateDTO;

type JD = {
  id: string;
  role: string;
  department: string;
  level: string;
  skills: string[];
  updatedAt: string;
};

type Persona = {
  id: string;
  name: string;
  difficulty: "Easy" | "Medium" | "Hard";
  style: string;
  strictness: "Lenient" | "Balanced" | "Strict";
  domain: string;
  sample: string;
};

type WizardState = {
  candidate: Candidate | null;
  jd: JD | null;
  persona: Persona | null;
  duration: 15 | 30 | 45 | 60 | 90;
  date: string;
  time: string;
  timezone: string;
};

const DEFAULT_STATE: WizardState = {
  candidate: null,
  jd: null,
  persona: null,
  duration: 45,
  date: new Date().toISOString().slice(0, 10),
  time: "10:00",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

const STEPS = [
  { id: 1, title: "Candidate", icon: "person_search" },
  { id: 2, title: "Job Description", icon: "description" },
  { id: 3, title: "AI Persona", icon: "smart_toy" },
  { id: 4, title: "Schedule", icon: "event" },
  { id: 5, title: "Review", icon: "check_circle" },
] as const;

export function ScheduleInterviewWizard({
  open,
  onOpenChange,
  prefill,
  onScheduled,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  prefill?: { date?: string; time?: string };
  onScheduled?: (interview: Interview, candidateEmail: string) => void;
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(DEFAULT_STATE);

  const { data: jobsData } = useJobsQuery();
  const { data: personasData } = usePersonasQuery();

  const jds: JD[] = useMemo(
    () =>
      (jobsData ?? []).map((j) => ({
        id: j.id,
        role: j.title,
        department: j.department ?? "—",
        level: j.seniority ?? "—",
        skills: (j.requirements ?? "")
          .split(/[,\n]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 8),
        updatedAt: j.createdAt.slice(0, 10),
      })),
    [jobsData],
  );

  const personas: Persona[] = useMemo(
    () =>
      (personasData ?? []).map((p) => {
        const diff: Persona["difficulty"] =
          p.difficulty === "easy" ? "Easy" : p.difficulty === "hard" ? "Hard" : "Medium";
        return {
          id: p.id,
          name: p.name,
          difficulty: diff,
          style: p.tone ?? "Balanced",
          strictness: "Balanced",
          domain: p.personaType ?? "General",
          sample: (p.prompt ?? "").slice(0, 200) || "No sample prompt yet.",
        };
      }),
    [personasData],
  );

  const goCreateJd = () => {
    close();
    navigate({ to: "/recruiter/jobs/new" });
  };
  const goCreatePersona = () => {
    close();
    navigate({ to: "/recruiter/personas/new" });
  };

  const set = <K extends keyof WizardState>(k: K, v: WizardState[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (open && prefill) {
      setState((s) => ({
        ...s,
        date: prefill.date ?? s.date,
        time: prefill.time ?? s.time,
      }));
    }
  }, [open, prefill]);

  const canAdvance = useMemo(() => {
    if (step === 1) return !!state.candidate;
    if (step === 2) return !!state.jd;
    if (step === 3) return !!state.persona;
    if (step === 4) return !!state.date && !!state.time;
    return true;
  }, [step, state]);

  const reset = () => {
    setStep(1);
    setState(DEFAULT_STATE);
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  const saveDraft = () => {
    try {
      localStorage.setItem("interview-wizard-draft", JSON.stringify({ step, state }));
      toast.success("Draft saved");
    } catch {
      toast.error("Could not save draft");
    }
  };

  const submit = () => {
    if (!state.candidate) return;
    const scheduledAt = new Date(`${state.date}T${state.time}:00`).toISOString();

    const interview: Interview = {
      id: `i-${Date.now()}`,
      candidateId: state.candidate.id,
      candidateName: state.candidate.name,
      role: state.jd?.role ?? state.candidate.role,
      scheduledAt,
      durationMin: state.duration,
      persona: state.persona?.name ?? "AI Interviewer",
      status: "scheduled",
      jobId: state.jd?.id ?? null,
      personaId: state.persona?.id ?? null,
    };
    onScheduled?.(interview, state.candidate.email);
    toast.success(`Interview scheduled for ${state.candidate.name}`);
    close();
    navigate({ to: "/recruiter/scheduling" });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="p-0 gap-0 bg-white border border-outline-variant shadow-2xl rounded-2xl overflow-hidden max-w-[1120px] w-[96vw] h-[88vh] sm:max-w-[1120px] flex flex-col [&>button]:hidden">
        {/* Header */}
        <header className="px-6 py-3.5 border-b border-outline-variant bg-white/95 backdrop-blur flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-primary text-on-primary flex items-center justify-center">
              <Icon name="event_note" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-on-surface leading-tight">
                Schedule Interview
              </h2>
              <p className="text-xs text-on-surface-variant">
                Set up a complete interview in one flow.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={saveDraft}
              className="px-2.5 py-1.5 text-xs font-medium text-on-surface-variant hover:bg-surface-container rounded-md inline-flex items-center gap-1.5"
            >
              <Icon name="save" className="text-sm" /> Save draft
            </button>
            <button
              onClick={close}
              className="p-1.5 text-on-surface-variant hover:bg-surface-container rounded-md"
              aria-label="Close"
            >
              <Icon name="close" className="text-base" />
            </button>
          </div>
        </header>

        {/* Stepper — sleek pills with connector */}
        <div className="px-6 pt-4 pb-3 border-b border-outline-variant bg-gradient-to-b from-surface-container-low/80 to-white shrink-0">
          <ol className="flex items-center">
            {STEPS.map((s, i) => {
              const active = s.id === step;
              const done = s.id < step;
              return (
                <li key={s.id} className="flex items-center flex-1 last:flex-none min-w-0">
                  <button
                    type="button"
                    onClick={() => s.id <= step && setStep(s.id)}
                    disabled={s.id > step}
                    className={`group flex items-center gap-2 min-w-0 ${s.id > step ? "cursor-default" : "cursor-pointer"}`}
                  >
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold border transition-all shrink-0 ${
                        active
                          ? "bg-primary border-primary text-on-primary shadow-sm shadow-primary/30 ring-4 ring-primary-container/30"
                          : done
                            ? "bg-secondary border-secondary text-on-primary"
                            : "bg-white border-outline-variant text-outline"
                      }`}
                    >
                      {done ? <Icon name="check" className="text-[15px]" /> : s.id}
                    </span>
                    <span
                      className={`hidden md:inline text-xs font-medium whitespace-nowrap truncate ${
                        active
                          ? "text-on-surface"
                          : done
                            ? "text-on-surface group-hover:text-on-surface"
                            : "text-outline"
                      }`}
                    >
                      {s.title}
                    </span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`h-px flex-1 mx-2 transition-colors ${s.id < step ? "bg-secondary" : "bg-surface-container-high"}`}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 bg-white">
          {step === 1 && <StepCandidate state={state} set={set} />}
          {step === 2 && <StepJD state={state} set={set} jds={jds} onCreate={goCreateJd} />}
          {step === 3 && (
            <StepPersona state={state} set={set} personas={personas} onCreate={goCreatePersona} />
          )}
          {step === 4 && <StepSchedule state={state} set={set} />}
          {step === 5 && <StepReview state={state} onJump={setStep} />}
        </div>

        {/* Footer */}
        <footer className="px-6 py-3 border-t border-outline-variant bg-white/95 backdrop-blur flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 text-xs text-on-surface-variant">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
              Draft autosaved
            </span>
            <span className="text-outline-variant">·</span>
            <span>
              Step {step} of {STEPS.length} — {STEPS[step - 1]?.title}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={close}
              className="px-3 py-1.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="px-3 py-1.5 text-sm font-medium border border-outline-variant rounded-md hover:bg-surface-container-low disabled:opacity-40 disabled:cursor-not-allowed text-on-surface inline-flex items-center gap-1"
            >
              <Icon name="arrow_back" className="text-base" /> Back
            </button>
            {step < STEPS.length ? (
              <button
                onClick={() => canAdvance && setStep((s) => Math.min(STEPS.length, s + 1))}
                disabled={!canAdvance}
                className="px-4 py-1.5 text-sm font-semibold bg-primary text-on-primary rounded-md hover:bg-primary disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 shadow-sm shadow-primary/20"
              >
                Continue <Icon name="arrow_forward" className="text-base" />
              </button>
            ) : (
              <button
                onClick={submit}
                className="px-4 py-1.5 text-sm font-semibold bg-secondary text-on-primary rounded-md hover:bg-secondary inline-flex items-center gap-1.5 shadow-sm shadow-secondary/20"
              >
                <Icon name="event_available" className="text-base" /> Schedule interview
              </button>
            )}
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Step 1: Candidate
// ============================================================================

function StepCandidate({
  state,
  set,
}: {
  state: WizardState;
  set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [role, setRole] = useState<string>("all");

  const { data: candidates, isLoading } = useCandidatesQuery();
  const list: Candidate[] = candidates ?? [];
  const roles = Array.from(new Set(list.map((c) => c.role).filter(Boolean)));
  const filtered = list.filter((c) => {
    if (status !== "all" && c.status !== status) return false;
    if (role !== "all" && c.role !== role) return false;
    if (
      q &&
      !`${c.name} ${c.email} ${(c.skills ?? []).join(" ")}`.toLowerCase().includes(q.toLowerCase())
    )
      return false;
    return true;
  });

  return (
    <StepFrame title="Select Candidate" subtitle="Pick the candidate this interview is for.">
      <div className="grid md:grid-cols-[1fr_320px] gap-6">
        <div>
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[220px]">
              <Icon
                name="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-base"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, email, skill…"
                className="w-full pl-9 pr-3 py-2 border border-outline-variant rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-container outline-none"
              />
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white"
            >
              <option value="all">All statuses</option>
              {["new", "screening", "interviewing", "evaluated", "offer", "rejected"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white"
            >
              <option value="all">All roles</option>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 max-h-[440px] overflow-y-auto pr-1">
            {isLoading && (
              <p className="text-sm text-on-surface-variant col-span-2 p-6 text-center">
                Loading candidates…
              </p>
            )}
            {!isLoading && list.length === 0 && (
              <p className="text-sm text-on-surface-variant col-span-2 p-6 text-center">
                No candidates yet. Add one from the Candidates page first.
              </p>
            )}
            {filtered.map((c) => {
              const selected = state.candidate?.id === c.id;
              const incomplete = !isProfileComplete(c);
              const missing = incomplete
                ? getMissingFields(c)
                    .map((m) => FIELD_LABELS[m])
                    .join(", ")
                : "";
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={incomplete}
                  onClick={() => set("candidate", c)}
                  title={incomplete ? `Profile incomplete — missing: ${missing}` : undefined}
                  className={`text-left p-4 rounded-xl border transition ${
                    incomplete
                      ? "border-outline-variant bg-surface-container-low/50 opacity-70 cursor-not-allowed"
                      : selected
                        ? "border-primary bg-primary-fixed/60 ring-2 ring-primary-container/40"
                        : "border-outline-variant hover:border-outline-variant bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-surface-container text-on-surface flex items-center justify-center font-semibold">
                      {c.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-on-surface truncate">{c.name}</p>
                        {incomplete ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-error-container text-on-error-container flex items-center gap-1">
                            <Icon name="warning" className="text-[12px]" />
                            Incomplete
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant capitalize">
                            {c.status}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-on-surface-variant truncate">{c.email}</p>
                      <p className="text-sm text-on-surface mt-1">
                        {c.role || <span className="text-error">Role missing</span>}
                      </p>
                      <div className="flex items-center justify-between mt-2 text-xs text-on-surface-variant">
                        <span>{c.experienceYears} yrs exp</span>
                        {incomplete ? (
                          <span className="text-error font-medium">
                            Complete profile to schedule
                          </span>
                        ) : (
                          <span className="font-semibold text-primary">Match {c.score}%</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
            {!isLoading && list.length > 0 && filtered.length === 0 && (
              <p className="text-sm text-on-surface-variant col-span-2 p-6 text-center">
                No candidates match.
              </p>
            )}
          </div>
        </div>

        <SummaryPanel title="Selected candidate">
          {state.candidate ? (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-semibold">
                  {state.candidate.avatar}
                </div>
                <div>
                  <p className="font-semibold text-on-surface">{state.candidate.name}</p>
                  <p className="text-xs text-on-surface-variant">{state.candidate.email}</p>
                </div>
              </div>
              <SummaryRow label="Role" value={state.candidate.role} />
              <SummaryRow label="Experience" value={`${state.candidate.experienceYears} years`} />
              <SummaryRow label="Match score" value={`${state.candidate.score}%`} />
              <SummaryRow label="Status" value={state.candidate.status} />
              <div className="mt-3">
                <p className="text-xs text-on-surface-variant mb-1">Skills</p>
                <div className="flex flex-wrap gap-1">
                  {state.candidate.skills.map((s) => (
                    <span
                      key={s}
                      className="text-xs px-2 py-0.5 bg-surface-container text-on-surface rounded"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <EmptySummary label="No candidate selected yet." />
          )}
        </SummaryPanel>
      </div>
    </StepFrame>
  );
}

// ============================================================================
// Step 2: Job Description
// ============================================================================

function StepJD({
  state,
  set,
  jds,
  onCreate,
}: {
  state: WizardState;
  set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
  jds: JD[];
  onCreate: () => void;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"updated" | "role">("updated");
  const list = jds
    .filter(
      (j) =>
        !q ||
        `${j.role} ${j.department} ${j.skills.join(" ")}`.toLowerCase().includes(q.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "updated" ? b.updatedAt.localeCompare(a.updatedAt) : a.role.localeCompare(b.role),
    );

  return (
    <StepFrame
      title="Assign Job Description"
      subtitle="Choose the JD this interview should benchmark against."
    >
      <div className="grid md:grid-cols-[1fr_320px] gap-6">
        <div>
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[220px]">
              <Icon
                name="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-base"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search JD…"
                className="w-full pl-9 pr-3 py-2 border border-outline-variant rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-container outline-none"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "updated" | "role")}
              className="px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white"
            >
              <option value="updated">Recently updated</option>
              <option value="role">Role A–Z</option>
            </select>
            <button
              onClick={onCreate}
              className="px-3 py-2 text-sm font-medium border border-dashed border-primary text-primary rounded-lg hover:bg-primary-fixed inline-flex items-center gap-1"
            >
              <Icon name="add" className="text-base" /> Create JD
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 max-h-[440px] overflow-y-auto pr-1">
            {jds.length === 0 ? (
              <div className="col-span-2 p-8 text-center border-2 border-dashed border-outline-variant rounded-xl bg-surface-container-low/40">
                <Icon name="description" className="text-4xl text-outline mb-2" />
                <p className="text-sm font-semibold text-on-surface">No Job Descriptions found</p>
                <p className="text-xs text-on-surface-variant mb-4">
                  Please create a job description before scheduling an interview.
                </p>
                <button
                  onClick={onCreate}
                  className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm hover:brightness-110"
                >
                  Create Job Description
                </button>
              </div>
            ) : list.length === 0 ? (
              <p className="text-sm text-on-surface-variant col-span-2 p-6 text-center">
                No JDs match search criteria.
              </p>
            ) : (
              list.map((j) => {
                const selected = state.jd?.id === j.id;
                return (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => set("jd", j)}
                    className={`text-left p-4 rounded-xl border transition ${selected ? "border-primary bg-primary-fixed/60 ring-2 ring-primary-container/40" : "border-outline-variant hover:border-outline-variant bg-white"}`}
                  >
                    <p className="font-semibold text-on-surface">{j.role}</p>
                    <p className="text-xs text-on-surface-variant">
                      {j.department} · {j.level}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {j.skills.slice(0, 4).map((s) => (
                        <span
                          key={s}
                          className="text-xs px-2 py-0.5 bg-surface-container text-on-surface rounded"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-outline mt-2">Updated {j.updatedAt}</p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <SummaryPanel title="Selected JD">
          {state.jd ? (
            <>
              <p className="font-semibold text-on-surface mb-2">{state.jd.role}</p>
              <SummaryRow label="Department" value={state.jd.department} />
              <SummaryRow label="Level" value={state.jd.level} />
              <SummaryRow label="Updated" value={state.jd.updatedAt} />
              <div className="mt-3">
                <p className="text-xs text-on-surface-variant mb-1">Required skills</p>
                <div className="flex flex-wrap gap-1">
                  {state.jd.skills.map((s) => (
                    <span
                      key={s}
                      className="text-xs px-2 py-0.5 bg-surface-container text-on-surface rounded"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <EmptySummary label="No JD selected yet." />
          )}
        </SummaryPanel>
      </div>
    </StepFrame>
  );
}

// ============================================================================
// Step 3: Persona
// ============================================================================

function StepPersona({
  state,
  set,
  personas,
  onCreate,
}: {
  state: WizardState;
  set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
  personas: Persona[];
  onCreate: () => void;
}) {
  const [previewing, setPreviewing] = useState<Persona | null>(null);

  return (
    <StepFrame
      title="Assign AI Interview Persona"
      subtitle="The persona shapes tone, depth, and grading rigor."
    >
      <div className="flex items-center justify-end mb-3">
        <button
          onClick={onCreate}
          className="px-3 py-2 text-sm font-medium border border-dashed border-primary text-primary rounded-lg hover:bg-primary-fixed inline-flex items-center gap-1"
        >
          <Icon name="add" className="text-base" /> Create persona
        </button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {personas.length === 0 ? (
          <div className="col-span-3 p-8 text-center border-2 border-dashed border-outline-variant rounded-xl bg-surface-container-low/40">
            <Icon name="smart_toy" className="text-4xl text-outline mb-2" />
            <p className="text-sm font-semibold text-on-surface">No AI Personas found</p>
            <p className="text-xs text-on-surface-variant mb-4">
              Please create an AI persona to drive the interviewer's behavior.
            </p>
            <button
              onClick={onCreate}
              className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm hover:brightness-110"
            >
              Create AI Persona
            </button>
          </div>
        ) : (
          personas.map((p) => {
            const selected = state.persona?.id === p.id;
            return (
              <div
                key={p.id}
                className={`p-4 rounded-xl border transition ${selected ? "border-primary bg-primary-fixed/60 ring-2 ring-primary-container/40" : "border-outline-variant bg-white hover:border-outline-variant"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-on-surface">{p.name}</p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${p.difficulty === "Hard" ? "bg-error-container text-on-error-container" : p.difficulty === "Medium" ? "bg-tertiary-container text-on-tertiary-container" : "bg-secondary-container text-on-secondary-container"}`}
                  >
                    {p.difficulty}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant mt-1">{p.domain}</p>
                <div className="text-xs text-on-surface-variant mt-2 space-y-1">
                  <p>
                    <span className="text-outline">Style:</span> {p.style}
                  </p>
                  <p>
                    <span className="text-outline">Strictness:</span> {p.strictness}
                  </p>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => set("persona", p)}
                    className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium ${selected ? "bg-primary text-on-primary" : "bg-inverse-surface text-on-primary hover:bg-inverse-surface"}`}
                  >
                    {selected ? "Selected" : "Select"}
                  </button>
                  <button
                    onClick={() => setPreviewing(p)}
                    className="px-3 py-1.5 rounded-md text-sm font-medium border border-outline-variant text-on-surface hover:bg-surface-container-low"
                  >
                    Preview
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {previewing && (
        <Dialog open onOpenChange={() => setPreviewing(null)}>
          <DialogContent className="max-w-lg bg-white">
            <h3 className="text-lg font-semibold text-on-surface">{previewing.name}</h3>
            <p className="text-sm text-on-surface-variant">Sample opening question</p>
            <div className="p-4 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface mt-2">
              "{previewing.sample}"
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs mt-3">
              <Badge label="Difficulty" value={previewing.difficulty} />
              <Badge label="Style" value={previewing.style} />
              <Badge label="Strictness" value={previewing.strictness} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </StepFrame>
  );
}

// ============================================================================
// Step 4: Schedule
// ============================================================================

function StepSchedule({
  state,
  set,
}: {
  state: WizardState;
  set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
}) {
  return (
    <StepFrame title="Schedule Interview" subtitle="Pick a time and duration.">
      <div className="grid md:grid-cols-2 gap-6">
        <Field label="Date">
          <input
            type="date"
            value={state.date}
            onChange={(e) => set("date", e.target.value)}
            className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-container outline-none"
          />
        </Field>
        <Field label="Time">
          <input
            type="time"
            value={state.time}
            onChange={(e) => set("time", e.target.value)}
            className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-container outline-none"
          />
        </Field>
        <Field label="Timezone">
          <input
            value={state.timezone}
            onChange={(e) => set("timezone", e.target.value)}
            className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-container outline-none"
          />
        </Field>
        <Field label="Duration">
          <Pill
            group={state.duration}
            onChange={(v) => set("duration", v as WizardState["duration"])}
            options={[15, 30, 45, 60, 90].map((m) => ({ value: m, label: `${m} min` }))}
          />
        </Field>
      </div>

      <div className="mt-6 p-4 rounded-xl bg-secondary-container/40 border border-secondary/40 text-sm text-on-secondary-container flex items-start gap-2">
        <Icon name="check_circle" className="text-secondary" />
        <div>
          <p className="font-semibold">No conflicts detected</p>
          <p className="text-xs">
            Your calendar is clear on {state.date} at {state.time} ({state.timezone}).
          </p>
        </div>
      </div>
    </StepFrame>
  );
}

// ============================================================================
// Step 5: Review
// ============================================================================

function StepReview({ state, onJump }: { state: WizardState; onJump: (step: number) => void }) {
  const cards: { title: string; step: number; rows: [string, ReactNode][] }[] = [
    {
      title: "Candidate",
      step: 1,
      rows: [
        ["Name", state.candidate?.name ?? "—"],
        ["Email", state.candidate?.email ?? "—"],
        ["Role", state.candidate?.role ?? "—"],
      ],
    },
    {
      title: "Job Description",
      step: 2,
      rows: [
        ["Role", state.jd?.role ?? "—"],
        ["Department", state.jd?.department ?? "—"],
        ["Level", state.jd?.level ?? "—"],
      ],
    },
    {
      title: "AI Persona",
      step: 3,
      rows: [
        ["Name", state.persona?.name ?? "—"],
        ["Difficulty", state.persona?.difficulty ?? "—"],
        ["Style/Tone", state.persona?.style ?? "—"],
      ],
    },
    {
      title: "Schedule",
      step: 4,
      rows: [
        ["When", `${state.date} ${state.time}`],
        ["Duration", `${state.duration} min`],
        ["Timezone", state.timezone],
      ],
    },
  ];

  return (
    <StepFrame title="Review Assignment" subtitle="Confirm everything looks right before creating.">
      <div className="grid md:grid-cols-2 gap-3">
        {cards.map((c) => (
          <div key={c.title} className="p-4 rounded-xl border border-outline-variant bg-white">
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-on-surface">{c.title}</p>
              <button
                onClick={() => onJump(c.step)}
                className="text-xs text-primary hover:underline"
              >
                Edit
              </button>
            </div>
            <div className="space-y-1">
              {c.rows.map(([k, v]) => (
                <SummaryRow key={k} label={k} value={v} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </StepFrame>
  );
}

// ============================================================================
// Small UI primitives (light-theme, enterprise feel)
// ============================================================================

function StepFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xl font-semibold text-on-surface">{title}</h3>
      <p className="text-sm text-on-surface-variant mb-4">{subtitle}</p>
      {children}
    </div>
  );
}

function SummaryPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="rounded-xl border border-outline-variant bg-surface-container-low/60 p-4 h-fit sticky top-0">
      <p className="text-xs uppercase tracking-wide text-on-surface-variant font-semibold mb-3">
        {title}
      </p>
      {children}
    </aside>
  );
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-sm py-1">
      <span className="text-on-surface-variant">{label}</span>
      <span className="text-on-surface text-right truncate max-w-[60%]">{value}</span>
    </div>
  );
}

function EmptySummary({ label }: { label: string }) {
  return <p className="text-sm text-on-surface-variant italic">{label}</p>;
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-semibold text-on-surface-variant mb-1.5 uppercase tracking-wide">
        {label}
      </span>
      {children}
    </label>
  );
}

function Pill<T extends string | number>({
  group,
  onChange,
  options,
}: {
  group: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o.value === group;
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition ${active ? "border-primary bg-primary-fixed text-primary font-semibold" : "border-outline-variant bg-white text-on-surface hover:border-outline"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-1.5 rounded bg-surface-container text-on-surface">
      <p className="text-[10px] uppercase text-on-surface-variant">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
