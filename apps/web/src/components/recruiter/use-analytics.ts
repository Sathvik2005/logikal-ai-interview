import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getCandidateQualityByRole,
  getPersonaEffectiveness,
  getRecruiterFunnel,
  getTimeToHire,
  refreshAnalytics,
} from "@/lib/analytics.functions";
import { exportInterviewReport } from "@/lib/reports.functions";

export function useRecruiterFunnel() {
  const fn = useServerFn(getRecruiterFunnel);
  return useQuery({ queryKey: ["analytics", "recruiter-funnel"], queryFn: () => fn() });
}

export function useTimeToHire() {
  const fn = useServerFn(getTimeToHire);
  return useQuery({ queryKey: ["analytics", "time-to-hire"], queryFn: () => fn() });
}

export function usePersonaEffectiveness() {
  const fn = useServerFn(getPersonaEffectiveness);
  return useQuery({ queryKey: ["analytics", "persona-effectiveness"], queryFn: () => fn() });
}

export function useCandidateQualityByRole() {
  const fn = useServerFn(getCandidateQualityByRole);
  return useQuery({ queryKey: ["analytics", "candidate-quality-by-role"], queryFn: () => fn() });
}

export function useRefreshAnalytics() {
  const fn = useServerFn(refreshAnalytics);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["analytics"] }),
  });
}

export function useExportInterviewReport() {
  const fn = useServerFn(exportInterviewReport);
  return useMutation({
    mutationFn: (interviewId: string) => fn({ data: { interviewId } }),
  });
}
