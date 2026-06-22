import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CardShadow, Icon } from "@/components/recruiter/RecruiterShell";
import { STATUS_TONE, scoreColor } from "@/components/recruiter/mock-data";
import {
  useCandidatesQuery,
  candidatesListOptions,
  type CandidateStatus,
} from "@/components/recruiter/use-candidates";
import { AddCandidateWizard } from "@/components/recruiter/AddCandidateWizard";
import { ImportCandidatesWizard } from "@/components/recruiter/ImportCandidatesWizard";
import { ScheduleInterviewWizard } from "@/components/recruiter/ScheduleInterviewWizard";
import { useInterviewSchedule } from "@/components/recruiter/use-interview-schedule";
import { isProfileComplete } from "@/components/recruiter/candidate-completeness";


export const Route = createFileRoute("/_authenticated/recruiter/candidates/")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(candidatesListOptions());
  },
  component: CandidatesPage,
});

const STATUS_VALUES: CandidateStatus[] = [
  "new",
  "screening",
  "interviewing",
  "evaluated",
  "offer",
  "hired",
  "rejected",
];

function CandidatesPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<CandidateStatus | "all">("all");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const { data: candidates = [], isLoading, error } = useCandidatesQuery();
  const { addInterview } = useInterviewSchedule();

  const filtered = candidates.filter((c) => {
    const matchesQ =
      !q ||
      c.name.toLowerCase().includes(q.toLowerCase()) ||
      c.role.toLowerCase().includes(q.toLowerCase());
    const matchesS = status === "all" || c.status === status;
    return matchesQ && matchesS;
  });

  return (
    <>
      <div className="mb-lg grid grid-cols-[minmax(0,1fr)_auto] items-center gap-md sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-headline-lg text-on-background mb-1">Candidate Management</h2>
          <p className="text-body-lg text-on-surface-variant">
            Search, filter, and triage your full pipeline.
          </p>
        </div>
        <div className="flex gap-sm">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="px-4 py-2 border border-outline-variant rounded-lg flex items-center gap-2 hover:bg-surface-container-low"
          >
            <Icon name="upload" />
            Import CSV
          </button>
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="px-4 py-2 bg-primary text-on-primary rounded-lg flex items-center gap-2 hover:brightness-110"
          >
            <Icon name="add" />
            Add Candidate
          </button>
        </div>
      </div>

      <CardShadow className="p-md mb-lg flex flex-wrap items-center gap-md">
        <div className="relative flex-1 min-w-[240px]">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or role…"
            className="w-full pl-10 pr-4 py-2 bg-surface border border-outline-variant rounded-lg outline-none focus:ring-2 focus:ring-primary-container"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as CandidateStatus | "all")}
          className="px-3 py-2 bg-surface border border-outline-variant rounded-lg"
        >
          <option value="all">All statuses</option>
          {STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </CardShadow>

      <CardShadow className="overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-body-md min-w-[800px]">
            <thead className="bg-surface-container-low text-label-caps uppercase text-on-surface-variant">
              <tr>
                <th className="text-left p-lg">Candidate</th>
                <th className="text-left p-lg">Role</th>
                <th className="text-left p-lg">Status</th>
                <th className="text-left p-lg">AI Score</th>
                <th className="text-left p-lg">Experience</th>
                <th className="p-lg" />
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="p-xl text-center text-on-surface-variant">
                    Loading candidates…
                  </td>
                </tr>
              )}
              {error && !isLoading && (
                <tr>
                  <td colSpan={6} className="p-xl text-center text-error">
                    Failed to load candidates: {(error as Error).message}
                  </td>
                </tr>
              )}
              {!isLoading &&
                !error &&
                filtered.map((c) => {
                  const incomplete = !isProfileComplete(c);
                  return (
                  <tr key={c.id} className="hover:bg-surface-container-low transition">
                    <td className="p-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-semibold">
                          {c.avatar}
                        </div>
                        <div>
                          <p className="font-semibold flex items-center gap-2">
                            {c.name}
                            {incomplete && (
                              <span title="Profile incomplete" className="text-xs px-1.5 py-0.5 rounded-full bg-error-container text-on-error-container inline-flex items-center gap-1">
                                <Icon name="warning" className="text-[12px]" />Incomplete
                              </span>
                            )}
                          </p>
                          <p className="text-label-caps text-on-surface-variant uppercase">{c.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-lg text-on-surface-variant">{c.role || "—"}</td>
                    <td className="p-lg">
                      <span
                        className={`px-2 py-1 rounded-full text-label-caps uppercase ${STATUS_TONE[c.status]}`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className={`p-lg text-data-mono font-bold ${scoreColor(c.score)}`}>
                      {c.score || "—"}
                    </td>
                    <td className="p-lg text-on-surface-variant">{c.experienceYears} yrs</td>
                    <td className="p-lg text-right font-medium">
                      <Link
                        to="/recruiter/candidates/$id"
                        params={{ id: c.id }}
                        className="text-primary hover:underline mr-3"
                      >
                        Profile
                      </Link>
                      {incomplete ? (
                        <Link
                          to="/recruiter/candidates/$id"
                          params={{ id: c.id }}
                          title="Complete the profile before scheduling"
                          className="text-on-surface-variant hover:underline inline-flex items-center gap-1"
                        >
                          <Icon name="lock" className="text-[14px]" />Complete
                        </Link>
                      ) : (
                        <Link
                          to="/recruiter/scheduling"
                          className="text-primary hover:underline"
                        >
                          Schedule
                        </Link>
                      )}
                    </td>
                  </tr>
                  );
                })}
              {!isLoading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-xl text-center text-on-surface-variant">
                    No candidates match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardShadow>

      <AddCandidateWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onScheduleRequest={() => setScheduleOpen(true)}
      />
      <ImportCandidatesWizard open={importOpen} onOpenChange={setImportOpen} />

      <ScheduleInterviewWizard
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onScheduled={(interview) => {
          addInterview(interview);
          toast.success(`Interview scheduled with ${interview.candidateName}`);
        }}
      />
    </>
  );
}
