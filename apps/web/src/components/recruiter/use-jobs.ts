import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listJobs, getJob, upsertJob, archiveJob, type JobDTO } from "@/lib/jobs.functions";

export type { JobDTO };
export const jobsKeys = {
  all: ["jobs"] as const,
  detail: (id: string) => ["jobs", "detail", id] as const,
};

export const jobsListOptions = () =>
  queryOptions({ queryKey: jobsKeys.all, queryFn: () => listJobs(), staleTime: 30_000 });

export function useJobsQuery() {
  return useQuery(jobsListOptions());
}
export function useJobQuery(id: string) {
  const fn = useServerFn(getJob);
  return useQuery({ queryKey: jobsKeys.detail(id), queryFn: () => fn({ data: { id } }) });
}
export function useUpsertJob() {
  const qc = useQueryClient();
  const fn = useServerFn(upsertJob);
  return useMutation({
    mutationFn: (input: {
      id?: string;
      title: string;
      department?: string | null;
      location?: string | null;
      employmentType?: string | null;
      seniority?: string | null;
      description?: string | null;
      requirements?: string | null;
      personaId?: string | null;
      status?: "draft" | "open" | "paused" | "closed" | "archived";
    }) => fn({ data: { status: "draft", ...input } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: jobsKeys.all }),
  });
}
export function useArchiveJob() {
  const qc = useQueryClient();
  const fn = useServerFn(archiveJob);
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: jobsKeys.all }),
  });
}
