import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listCandidates,
  getCandidate,
  createCandidate,
  archiveCandidate,
  updateCandidateStatus,
  updateCandidateProfile,
  type CandidateDTO,
  type CandidateStatus,
  type CreateCandidateInput,
} from "@/lib/candidates.functions";

export type { CandidateDTO, CandidateStatus, CreateCandidateInput };

export const candidatesKeys = {
  all: ["candidates"] as const,
  list: (filters?: { status?: CandidateStatus; search?: string }) =>
    ["candidates", "list", filters ?? {}] as const,
  detail: (id: string) => ["candidates", "detail", id] as const,
};

export function candidatesListOptions(filters?: { status?: CandidateStatus; search?: string }) {
  return queryOptions({
    queryKey: candidatesKeys.list(filters),
    queryFn: () => listCandidates({ data: filters ?? {} }),
    staleTime: 30_000,
  });
}

export function candidateDetailOptions(id: string) {
  return queryOptions({
    queryKey: candidatesKeys.detail(id),
    queryFn: () => getCandidate({ data: { id } }),
  });
}

export function useCandidatesQuery(filters?: { status?: CandidateStatus; search?: string }) {
  return useQuery(candidatesListOptions(filters));
}

export function useCandidateQuery(id: string) {
  return useQuery(candidateDetailOptions(id));
}

export function useCreateCandidate() {
  const qc = useQueryClient();
  const fn = useServerFn(createCandidate);
  return useMutation({
    mutationFn: (input: CreateCandidateInput) => fn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: candidatesKeys.all });
    },
  });
}

export function useArchiveCandidate() {
  const qc = useQueryClient();
  const fn = useServerFn(archiveCandidate);
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: candidatesKeys.all }),
  });
}

export function useUpdateCandidateStatus() {
  const qc = useQueryClient();
  const fn = useServerFn(updateCandidateStatus);
  return useMutation({
    mutationFn: (input: { id: string; status: Exclude<CandidateStatus, "archived"> }) =>
      fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: candidatesKeys.all }),
  });
}

export type UpdateProfileInput = {
  id: string;
  phone?: string;
  role?: string;
  experienceYears?: number;
  skills?: string[];
  resumeSummary?: string;
};

export function useUpdateCandidateProfile() {
  const qc = useQueryClient();
  const fn = useServerFn(updateCandidateProfile);
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => fn({ data: input }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: candidatesKeys.all });
      qc.invalidateQueries({ queryKey: candidatesKeys.detail(vars.id) });
    },
  });
}

export function makeInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}
