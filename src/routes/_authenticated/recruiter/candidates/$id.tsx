import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { CardShadow, Icon } from "@/components/recruiter/RecruiterShell";
import { STATUS_TONE, fmtDate, scoreColor } from "@/components/recruiter/mock-data";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import {
  useCandidateQuery,
  useUpdateCandidateProfile,
  type UpdateProfileInput,
} from "@/components/recruiter/use-candidates";
import { useInterviewsQuery } from "@/components/recruiter/use-interviews";
import {
  FIELD_LABELS,
  completenessPct,
  getMissingFields,
  isProfileComplete,
  type MissingField,
} from "@/components/recruiter/candidate-completeness";

export const Route = createFileRoute("/_authenticated/recruiter/candidates/$id")({
  component: CandidateProfile,
  errorComponent: ({ error, reset }) => <ErrorState error={error} reset={reset} />,
  notFoundComponent: () => (
    <EmptyState
      icon="person_off"
      title="Candidate not found"
      description="This candidate profile is unavailable."
      action={
        <Link to="/recruiter/candidates" className="text-primary hover:underline">
          ← Back to candidates
        </Link>
      }
    />
  ),
});

const inputCls =
  "w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-container outline-none placeholder:text-outline";

function CandidateProfile() {
  const { id } = Route.useParams();
  const { data: c, isLoading, error } = useCandidateQuery(id);
  const { data: allInterviews } = useInterviewsQuery();
  const updateMut = useUpdateCandidateProfile();

  const interviews = useMemo(
    () => (allInterviews ?? []).filter((i) => i.candidateId === id),
    [allInterviews, id],
  );

  const missing: MissingField[] = c ? getMissingFields(c) : [];
  const complete = c ? isProfileComplete(c) : false;
  const pct = c ? completenessPct(c) : 0;

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    phone: "",
    role: "",
    experienceYears: 0,
    skillsCsv: "",
    resumeSummary: "",
  });

  useEffect(() => {
    if (c) {
      setForm({
        phone: c.phone ?? "",
        role: c.role ?? "",
        experienceYears: c.experienceYears,
        skillsCsv: c.skills.join(", "),
        resumeSummary: c.resumeSummary ?? "",
      });
      if (!isProfileComplete(c)) setEditing(true);
    }
  }, [c]);

  const submit = async () => {
    if (!c) return;
    const skills = form.skillsCsv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const patch: UpdateProfileInput = { id: c.id };
    if (form.phone.trim() !== (c.phone ?? "")) patch.phone = form.phone.trim();
    if (form.role.trim() !== c.role) patch.role = form.role.trim();
    if (form.experienceYears !== c.experienceYears) patch.experienceYears = form.experienceYears;
    if (JSON.stringify(skills) !== JSON.stringify(c.skills)) patch.skills = skills;
    if (form.resumeSummary.trim() !== (c.resumeSummary ?? ""))
      patch.resumeSummary = form.resumeSummary.trim();

    try {
      await updateMut.mutateAsync(patch);
      toast.success("Profile updated");
      setEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update profile");
    }
  };

  if (isLoading) {
    return <div className="p-lg text-on-surface-variant">Loading candidate…</div>;
  }
  if (error) return <ErrorState error={error} reset={() => window.location.reload()} />;
  if (!c) {
    return (
      <EmptyState
        icon="person_off"
        title="Candidate not found"
        description="This candidate profile is unavailable."
        action={
          <Link to="/recruiter/candidates" className="text-primary hover:underline">
            ← Back to candidates
          </Link>
        }
      />
    );
  }

  return (
    <>
      <Link
        to="/recruiter/candidates"
        className="text-primary text-body-md hover:underline mb-md inline-flex items-center gap-1"
      >
        <Icon name="arrow_back" />
        Back to candidates
      </Link>

      {/* Completeness banner */}
      <CardShadow
        className={`p-lg mb-lg border-l-4 ${complete ? "border-l-secondary" : "border-l-error"}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-md">
          <div className="min-w-0 flex-1">
            <h3 className="text-headline-sm flex items-center gap-2">
              <Icon
                name={complete ? "verified" : "warning"}
                className={complete ? "text-secondary" : "text-error"}
              />
              Profile {pct}% complete
            </h3>
            <div className="mt-2 h-2 w-full bg-surface-container rounded-full overflow-hidden">
              <div
                className={`h-full ${complete ? "bg-secondary" : "bg-error"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {!complete && (
              <p className="text-body-md text-on-surface-variant mt-2">
                Finish the profile before scheduling interviews. Missing:{" "}
                {missing.map((m) => FIELD_LABELS[m]).join(" · ")}
              </p>
            )}
            {complete && (
              <p className="text-body-md text-on-surface-variant mt-2">
                All required fields captured. Ready to schedule.
              </p>
            )}
          </div>
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="px-3 py-2 border border-outline-variant rounded-lg text-body-md hover:bg-surface-container-low inline-flex items-center gap-1 shrink-0"
            >
              <Icon name="edit" />
              Edit profile
            </button>
          )}
        </div>

        {editing && (
          <div className="mt-md grid grid-cols-1 md:grid-cols-2 gap-md pt-md border-t border-outline-variant">
            <label className="block">
              <span className="block text-label-caps uppercase text-on-surface-variant mb-1">
                Phone *
              </span>
              <input
                className={inputCls}
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+1 555 123 4567"
              />
            </label>
            <label className="block">
              <span className="block text-label-caps uppercase text-on-surface-variant mb-1">
                Target role *
              </span>
              <input
                className={inputCls}
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                placeholder="Senior Software Engineer"
              />
            </label>
            <label className="block">
              <span className="block text-label-caps uppercase text-on-surface-variant mb-1">
                Experience — {form.experienceYears} yrs *
              </span>
              <input
                type="range"
                min={0}
                max={25}
                value={form.experienceYears}
                onChange={(e) =>
                  setForm((f) => ({ ...f, experienceYears: Number(e.target.value) }))
                }
                className="w-full accent-primary"
              />
            </label>
            <label className="block">
              <span className="block text-label-caps uppercase text-on-surface-variant mb-1">
                Skills * (≥3, comma-separated)
              </span>
              <input
                className={inputCls}
                value={form.skillsCsv}
                onChange={(e) => setForm((f) => ({ ...f, skillsCsv: e.target.value }))}
                placeholder="TypeScript, React, AWS"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="block text-label-caps uppercase text-on-surface-variant mb-1">
                Resume summary * ({form.resumeSummary.trim().length}/40+ chars)
              </span>
              <textarea
                className={`${inputCls} min-h-[88px] resize-y`}
                value={form.resumeSummary}
                onChange={(e) => setForm((f) => ({ ...f, resumeSummary: e.target.value }))}
                placeholder="Background, key strengths, screening highlights…"
              />
            </label>
            <div className="md:col-span-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-3 py-2 border border-outline-variant rounded-lg text-body-md hover:bg-surface-container-low"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={updateMut.isPending}
                className="px-4 py-2 bg-primary text-on-primary rounded-lg text-body-md hover:brightness-110 disabled:opacity-50 inline-flex items-center gap-2"
              >
                <Icon name="save" />
                {updateMut.isPending ? "Saving…" : "Save profile"}
              </button>
            </div>
          </div>
        )}
      </CardShadow>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        <div className="lg:col-span-2 space-y-lg">
          <CardShadow className="p-lg">
            <div className="flex items-start gap-lg">
              <div className="w-20 h-20 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-headline-md font-bold">
                {c.avatar}
              </div>
              <div className="flex-1">
                <h2 className="text-headline-lg">{c.name}</h2>
                <p className="text-body-lg text-on-surface-variant">{c.role || "Role not set"}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span
                    className={`px-2 py-1 rounded-full text-label-caps uppercase ${STATUS_TONE[c.status]}`}
                  >
                    {c.status}
                  </span>
                  <span className="px-2 py-1 rounded-full text-label-caps uppercase bg-surface-container text-on-surface-variant">
                    {c.experienceYears} yrs experience
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-label-caps uppercase text-on-surface-variant">AI Score</p>
                <p className={`text-display-lg ${scoreColor(c.score)}`}>{c.score || "—"}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-md mt-lg pt-lg border-t border-outline-variant text-body-md">
              <div>
                <p className="text-label-caps uppercase text-on-surface-variant">Email</p>
                <p className="truncate">{c.email}</p>
              </div>
              <div>
                <p className="text-label-caps uppercase text-on-surface-variant">Phone</p>
                <p>{c.phone ?? <span className="text-error">Missing</span>}</p>
              </div>
              <div>
                <p className="text-label-caps uppercase text-on-surface-variant">Applied</p>
                <p>{c.appliedAt}</p>
              </div>
            </div>
          </CardShadow>

          <CardShadow className="p-lg ai-insight">
            <h3 className="text-headline-sm mb-2 flex items-center gap-2">
              <Icon name="auto_awesome" className="text-secondary" />
              AI Resume Intelligence
            </h3>
            <p className="text-body-md mb-md">
              {c.resumeSummary ? (
                c.resumeSummary
              ) : (
                <span className="text-on-surface-variant italic">
                  No resume summary captured yet.
                </span>
              )}
            </p>
            <Link
              to="/recruiter/candidates/$id/resume"
              params={{ id: c.id }}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Open full resume intelligence <Icon name="arrow_forward" />
            </Link>
          </CardShadow>

          <CardShadow>
            <div className="p-lg border-b border-outline-variant flex justify-between items-center">
              <h3 className="text-headline-sm">Interview history</h3>
              {complete ? (
                <Link
                  to="/recruiter/scheduling"
                  className="text-primary text-body-md hover:underline"
                >
                  Schedule another →
                </Link>
              ) : (
                <span className="text-body-md text-on-surface-variant">
                  Complete profile to schedule
                </span>
              )}
            </div>
            <ul className="divide-y divide-outline-variant">
              {interviews.length === 0 && (
                <li className="p-lg text-on-surface-variant text-body-md">
                  No interviews scheduled yet.
                </li>
              )}
              {interviews.map((i) => (
                <li
                  key={i.id}
                  className="p-lg flex items-center justify-between hover:bg-surface-container-low"
                >
                  <div>
                    <p className="font-semibold">AI Interviewer</p>
                    <p className="text-body-md text-on-surface-variant">
                      {i.scheduledAt ? fmtDate(i.scheduledAt) : "Unscheduled"} • {i.durationMinutes}{" "}
                      min
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 rounded-full text-label-caps uppercase bg-surface-container text-on-surface-variant">
                      {i.status.replace("_", " ")}
                    </span>
                    <Link
                      to={
                        i.status === "completed"
                          ? "/recruiter/reports/$interviewId"
                          : "/recruiter/monitor"
                      }
                      params={i.status === "completed" ? { interviewId: i.id } : {}}
                      className="text-primary text-body-md hover:underline"
                    >
                      {i.status === "completed" ? "Report" : "Monitor"}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </CardShadow>
        </div>

        <div className="space-y-lg">
          <CardShadow className="p-lg">
            <h3 className="text-headline-sm mb-md">Skills</h3>
            <div className="flex flex-wrap gap-2">
              {c.skills.length === 0 && (
                <p className="text-body-md text-error">No skills captured.</p>
              )}
              {c.skills.map((s) => (
                <span
                  key={s}
                  className="px-2 py-1 rounded-md text-label-caps uppercase bg-primary-fixed text-on-primary-fixed-variant"
                >
                  {s}
                </span>
              ))}
            </div>
          </CardShadow>
          <CardShadow className="p-lg space-y-2">
            <h3 className="text-headline-sm mb-2">Actions</h3>
            {complete ? (
              <Link
                to="/recruiter/scheduling"
                className="w-full px-3 py-2 bg-primary text-on-primary rounded-lg flex items-center justify-center gap-2 hover:brightness-110"
              >
                <Icon name="calendar_today" />
                Schedule Interview
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  toast.error(
                    `Complete the profile first — missing ${missing.length} field${missing.length === 1 ? "" : "s"}`,
                  );
                }}
                title={`Missing: ${missing.map((m) => FIELD_LABELS[m]).join(", ")}`}
                className="w-full px-3 py-2 bg-surface-container text-on-surface-variant rounded-lg flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <Icon name="lock" />
                Schedule Interview
              </button>
            )}
            <a
              href={`mailto:${c.email}`}
              className="w-full px-3 py-2 border border-outline-variant rounded-lg flex items-center justify-center gap-2 hover:bg-surface-container-low"
            >
              <Icon name="email" />
              Send Email
            </a>
          </CardShadow>
        </div>
      </div>
    </>
  );
}
