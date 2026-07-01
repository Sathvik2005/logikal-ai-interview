import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CardShadow, Icon } from "@/components/recruiter/RecruiterShell";
import { EmptyState } from "@/components/shared/EmptyState";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { retryResumeParsing, updateCandidateSummary, getCandidateResumeUrl } from "@/lib/candidates.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useServerFn } from "@tanstack/react-start";

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
  
  const [editingSummary, setEditingSummary] = useState<{ id: string; text: string } | null>(null);

  const { data: candidates = [], isLoading, error } = useCandidatesQuery();
  const { addInterview } = useInterviewSchedule();
  const qc = useQueryClient();
  const retryResumeFn = useServerFn(retryResumeParsing);
  const saveSummaryFn = useServerFn(updateCandidateSummary);

  const retryMut = useMutation({
    mutationFn: (id: string) => retryResumeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Resume processing re-queued successfully!");
      qc.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to retry processing"),
  });

  const saveSummaryMut = useMutation({
    mutationFn: (data: { id: string; summary: string }) =>
      saveSummaryFn({ data: { id: data.id, resumeSummary: data.summary } }),
    onSuccess: () => {
      toast.success("Candidate summary updated!");
      setEditingSummary(null);
      qc.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save summary"),
  });

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
          <table className="w-full text-body-md min-w-[1200px]">
            <thead className="bg-surface-container-low text-label-caps uppercase text-on-surface-variant">
              <tr>
                <th className="text-left p-lg min-w-[200px]">Candidate</th>
                <th className="text-left p-lg min-w-[120px]">Role</th>
                <th className="text-left p-lg min-w-[120px]">Status</th>
                <th className="text-left p-lg min-w-[250px]">Professional Summary</th>
                <th className="text-left p-lg min-w-[180px]">Top Skills</th>
                <th className="text-left p-lg min-w-[180px]">Experience & Education</th>
                <th className="text-left p-lg min-w-[140px]">AI Status</th>
                <th className="text-left p-lg min-w-[100px]">JD Match</th>
                <th className="p-lg text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {isLoading && (
                <tr>
                  <td colSpan={9} className="p-xl text-center text-on-surface-variant">
                    Loading candidates…
                  </td>
                </tr>
              )}
              {error && !isLoading && (
                <tr>
                  <td colSpan={9} className="p-xl text-center text-error">
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
                          <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-semibold shrink-0">
                            {c.avatar}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold flex items-center gap-2 text-on-background truncate">
                              {c.name}
                              {incomplete && (
                                <span
                                  title="Profile incomplete"
                                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-error-container text-on-error-container inline-flex items-center gap-0.5 shrink-0"
                                >
                                  <Icon name="warning" className="text-[10px]" />
                                  Incomplete
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-on-surface-variant truncate">
                              {c.email}
                            </p>
                            <div className="mt-1 flex items-center gap-1.5">
                              {c.resumeUrl ? (
                                <div className="flex gap-1.5">
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        const res = await getCandidateResumeUrl({ data: { id: c.id } });
                                        if (res.url) {
                                          window.open(res.url, "_blank");
                                        } else {
                                          toast.error("Resume file URL is not available");
                                        }
                                      } catch (err: any) {
                                        toast.error(`Error opening resume: ${err.message || err}`);
                                      }
                                    }}
                                    className="text-[10px] px-1.5 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 rounded font-medium flex items-center gap-0.5 hover:bg-green-500/20 transition cursor-pointer"
                                    title="View resume"
                                  >
                                    <Icon name="visibility" className="text-[12px]" />
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        const res = await getCandidateResumeUrl({ data: { id: c.id } });
                                        if (res.url) {
                                          const a = document.createElement("a");
                                          a.href = res.url;
                                          a.download = c.resumeUrl?.split("/").pop() || "resume.pdf";
                                          a.click();
                                        } else {
                                          toast.error("Resume file URL is not available");
                                        }
                                      } catch (err: any) {
                                        toast.error(`Error downloading resume: ${err.message || err}`);
                                      }
                                    }}
                                    className="text-[10px] px-1.5 py-0.5 bg-primary-container/20 text-primary border border-primary/20 rounded font-medium flex items-center gap-0.5 hover:bg-primary-container/40 transition cursor-pointer"
                                    title="Download resume"
                                  >
                                    <Icon name="download" className="text-[12px]" />
                                    Download
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] px-1.5 py-0.5 bg-outline-variant/30 text-on-surface-variant/70 border border-outline-variant/40 rounded font-medium flex items-center gap-0.5">
                                  No Resume
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-lg text-on-surface-variant truncate max-w-[150px]" title={c.role || "—"}>
                        {c.role || "—"}
                      </td>
                      <td className="p-lg">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${STATUS_TONE[c.status]}`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="p-lg text-on-surface-variant max-w-[280px]">
                        {c.resumeSummary ? (
                          <div className="flex items-start gap-1 group">
                            <p className="text-xs line-clamp-3 leading-relaxed flex-1" title={c.resumeSummary}>
                              {c.resumeSummary}
                            </p>
                            <button
                              type="button"
                              onClick={() => setEditingSummary({ id: c.id, text: c.resumeSummary || "" })}
                              className="p-1 rounded hover:bg-surface-container-low text-primary opacity-0 group-hover:opacity-100 transition focus:opacity-100 shrink-0"
                              title="Edit Summary"
                            >
                              <Icon name="edit" className="text-[16px]" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-on-surface-variant/50 italic">No summary generated</span>
                            <button
                              type="button"
                              onClick={() => setEditingSummary({ id: c.id, text: "" })}
                              className="p-1 rounded hover:bg-surface-container-low text-primary"
                              title="Add Summary"
                            >
                              <Icon name="edit" className="text-[16px]" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="p-lg max-w-[200px]">
                        {c.skills && c.skills.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {c.skills.slice(0, 4).map((skill, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] px-1.5 py-0.5 bg-primary-container/40 text-on-primary-container/90 border border-primary-container/60 rounded font-medium truncate max-w-[80px]"
                                title={skill}
                              >
                                {skill}
                              </span>
                            ))}
                            {c.skills.length > 4 && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 bg-surface-container-low text-on-surface-variant border border-outline-variant/60 rounded font-medium shrink-0"
                                title={c.skills.slice(4).join(", ")}
                              >
                                +{c.skills.length - 4}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-on-surface-variant/50">—</span>
                        )}
                      </td>
                      <td className="p-lg text-on-surface-variant max-w-[200px]">
                        <div className="flex flex-col gap-1 text-xs">
                          <div className="flex items-center gap-1">
                            <Icon name="work" className="text-[14px] text-on-surface-variant/70 shrink-0" />
                            <span className="font-medium">
                              {c.experienceYears ? `${c.experienceYears} yrs` : "—"}
                            </span>
                            {c.resumeAnalysis?.suggestedSeniority && (
                              <span className="text-[10px] px-1 bg-surface-container-high text-on-surface-variant rounded border border-outline-variant shrink-0">
                                {c.resumeAnalysis.suggestedSeniority}
                              </span>
                            )}
                          </div>
                          <div className="flex items-start gap-1 text-[11px] text-on-surface-variant/80">
                            <Icon name="school" className="text-[14px] text-on-surface-variant/70 mt-0.5 shrink-0" />
                            <span className="line-clamp-2" title={c.resumeAnalysis?.education || "—"}>
                              {c.resumeAnalysis?.education || "—"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-lg">
                        {(() => {
                          const processingStatus = c.resumeAnalysis?.processingStatus || "completed";
                          const errorText = c.resumeAnalysis?.error || "Unknown processing error";

                          let badgeClass = "bg-success-container/30 text-success border-success/30";
                          let label = "Completed";
                          let isProcessing = false;

                          if (processingStatus === "queued") {
                            badgeClass = "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20 animate-pulse";
                            label = "Queued";
                            isProcessing = true;
                          } else if (processingStatus === "processing") {
                            badgeClass = "bg-primary-container/40 text-primary border-primary/30 animate-pulse";
                            label = "Processing";
                            isProcessing = true;
                          } else if (processingStatus === "failed") {
                            badgeClass = "bg-error-container/30 text-error border-error/30";
                            label = "Failed";
                          }

                          return (
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-semibold border flex items-center gap-1 ${badgeClass}`}
                                title={processingStatus === "failed" ? errorText : undefined}
                              >
                                {isProcessing && <Icon name="progress_activity" className="text-[12px] animate-spin shrink-0" />}
                                {label}
                              </span>
                              {processingStatus === "failed" && (
                                <button
                                  type="button"
                                  disabled={retryMut.isPending}
                                  onClick={() => retryMut.mutate(c.id)}
                                  className="p-1 text-primary hover:bg-primary/10 rounded transition disabled:opacity-50 shrink-0"
                                  title="Retry resume intelligence parsing"
                                >
                                  <Icon name="refresh" className={`text-[16px] ${retryMut.isPending ? "animate-spin" : ""}`} />
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className={`p-lg text-data-mono font-bold text-base ${scoreColor(c.score)}`}>
                        {c.score ? `${c.score}%` : "—"}
                      </td>
                      <td className="p-lg text-right font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to="/recruiter/candidates/$id"
                            params={{ id: c.id }}
                            className="text-primary hover:underline text-xs"
                          >
                            Profile
                          </Link>
                          {incomplete ? (
                            <Link
                              to="/recruiter/candidates/$id"
                              params={{ id: c.id }}
                              title="Complete the profile before scheduling"
                              className="text-on-surface-variant hover:underline text-xs flex items-center gap-0.5"
                            >
                              <Icon name="lock" className="text-[12px]" />
                              Complete
                            </Link>
                          ) : (
                            <Link to="/recruiter/scheduling" className="text-primary hover:underline text-xs">
                              Schedule
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              {!isLoading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-0">
                    <EmptyState
                      icon="person_search"
                      title="No candidates match your filters"
                      description="Try adjusting your keywords or filters to find candidates."
                    />
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

      <Dialog open={editingSummary !== null} onOpenChange={(open) => { if (!open) setEditingSummary(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Professional Summary</DialogTitle>
            <DialogDescription>
              Update the AI-generated professional summary for this candidate.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <textarea
              className="w-full h-32 p-3 bg-surface border border-outline-variant rounded-lg outline-none focus:ring-2 focus:ring-primary-container text-body-md"
              value={editingSummary?.text ?? ""}
              onChange={(e) =>
                setEditingSummary((prev) => (prev ? { ...prev, text: e.target.value } : null))
              }
              placeholder="Enter professional summary..."
            />
          </div>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setEditingSummary(null)}
              className="px-4 py-2 border border-outline-variant rounded-lg text-body-md hover:bg-surface-container-low"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saveSummaryMut.isPending}
              onClick={() => {
                if (editingSummary) {
                  saveSummaryMut.mutate({ id: editingSummary.id, summary: editingSummary.text });
                }
              }}
              className="px-4 py-2 bg-primary text-on-primary rounded-lg text-body-md hover:brightness-110 flex items-center gap-2 disabled:opacity-50"
            >
              {saveSummaryMut.isPending ? (
                <>
                  <Icon name="progress_activity" className="text-[16px] animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
