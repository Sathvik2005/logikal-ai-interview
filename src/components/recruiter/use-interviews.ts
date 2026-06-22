import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  cancelInterview,
  listInterviews,
  rescheduleInterview,
  scheduleInterview,
} from "@/lib/interviews.functions";

const KEY = ["interviews"] as const;

export type ScheduleInput = {
  candidateId: string;
  jobId?: string | null;
  personaId?: string | null;
  scheduledAt: string;
  durationMinutes?: number;
  questionIds?: string[];
  customQuestions?: string[];
};

export type RescheduleInput = {
  id: string;
  scheduledAt: string;
  durationMinutes?: number;
  reason?: string;
};

export type CancelInput = { id: string; reason?: string };

export type ListInput = { status?: string; from?: string; to?: string; limit?: number };

export function useInterviewsQuery(params?: ListInput) {
  const fn = useServerFn(listInterviews);
  return useQuery({
    queryKey: [...KEY, params ?? {}],
    queryFn: () => fn({ data: (params ?? {}) as never }),
  });
}

export function useScheduleInterview() {
  const fn = useServerFn(scheduleInterview);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ScheduleInput) => fn({ data: data as never }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRescheduleInterview() {
  const fn = useServerFn(rescheduleInterview);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RescheduleInput) => fn({ data: data as never }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCancelInterview() {
  const fn = useServerFn(cancelInterview);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CancelInput) => fn({ data: data as never }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
