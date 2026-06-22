import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CardShadow, Icon, EmptyState, SkeletonCard } from "@/components/recruiter/RecruiterShell";
import { useJobsQuery, type JobDTO } from "@/components/recruiter/use-jobs";
import { ImportCandidatesWizard } from "@/components/recruiter/ImportCandidatesWizard";

export const Route = createFileRoute("/_authenticated/recruiter/jobs/")({
  component: JobsList,
});

const STATUS_TONE: Record<JobDTO["status"], string> = {
  draft: "bg-surface-container text-on-surface-variant",
  open: "bg-secondary-container text-on-secondary-container",
  paused: "bg-warning-container text-on-warning-container",
  closed: "bg-surface-container-high text-on-surface-variant",
  archived: "bg-surface-container-high text-on-surface-variant",
};

function JobsList() {
  const { data, isLoading, error } = useJobsQuery();
  const jobs = (data ?? []) as JobDTO[];
  const [importJobId, setImportJobId] = useState<string | null>(null);

  return (
    <>
      <div className="mb-lg grid grid-cols-[minmax(0,1fr)_auto] items-center gap-md sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-headline-lg">Job Description Builder</h2>
          <p className="text-body-lg text-on-surface-variant">Author and publish JD specs your AI personas will interview against.</p>
        </div>
        <Link to="/recruiter/jobs/new" className="px-4 py-2 bg-primary text-on-primary rounded-lg flex items-center gap-2 hover:brightness-110"><Icon name="add" />New Job Description</Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : error ? (
        <CardShadow className="p-lg">
          <EmptyState title="Couldn't load jobs" hint={(error as Error).message} />
        </CardShadow>
      ) : jobs.length === 0 ? (
        <CardShadow className="p-lg">
          <EmptyState
            title="No job descriptions yet"
            hint="Create your first JD to start inviting candidates."
            action={<Link to="/recruiter/jobs/new" className="px-4 py-2 bg-primary text-on-primary rounded-lg inline-flex items-center gap-2"><Icon name="add" />New Job Description</Link>}
          />
        </CardShadow>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
          {jobs.map((j) => (
            <CardShadow key={j.id} className="p-lg flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-headline-sm">{j.title}</h3>
                <span className={`px-2 py-1 rounded-full text-label-caps uppercase ${STATUS_TONE[j.status]}`}>{j.status}</span>
              </div>
              <p className="text-body-md text-on-surface-variant">{j.department ?? "Department —"}{j.location ? ` • ${j.location}` : ""}</p>
              <p className="text-data-mono text-on-surface-variant mt-md">{j.candidateCount} candidates matched</p>
              <div className="mt-auto pt-lg flex gap-sm flex-wrap">
                <Link to="/recruiter/jobs/new" className="flex-1 text-center px-3 py-2 border border-outline-variant rounded-lg hover:bg-surface-container-low">Edit</Link>
                <button type="button" onClick={() => setImportJobId(j.id)} className="flex-1 text-center px-3 py-2 border border-outline-variant rounded-lg hover:bg-surface-container-low inline-flex items-center justify-center gap-1"><Icon name="upload" />Bulk import</button>
                <Link to="/recruiter/candidates" className="flex-1 text-center px-3 py-2 bg-primary text-on-primary rounded-lg hover:brightness-110">View pipeline</Link>
              </div>
            </CardShadow>
          ))}
        </div>
      )}

      <ImportCandidatesWizard
        open={importJobId !== null}
        onOpenChange={(o) => { if (!o) setImportJobId(null); }}
        jobId={importJobId}
      />
    </>
  );
}
