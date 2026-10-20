import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  appendInterviewTurn,
  endSession,
  finalizeEvaluation,
  getEvaluation,
  listSessionTurns,
  nextPersonaQuestion,
  recordInterviewEvent,
  startSession,
} from "@/lib/interview-runtime.functions";

export function useStartSession() {
  const fn = useServerFn(startSession);
  return useMutation({
    mutationFn: (data: { interviewId: string; deviceInfo?: Record<string, unknown> }) =>
      fn({ data: data as never }),
  });
}

export function useEndSession() {
  const fn = useServerFn(endSession);
  return useMutation({
    mutationFn: (data: { sessionId: string }) => fn({ data: data as never }),
  });
}

export function useRecordInterviewEvent() {
  const fn = useServerFn(recordInterviewEvent);
  return useMutation({
    mutationFn: (data: { sessionId: string; type: string; payload?: Record<string, unknown> }) =>
      fn({ data: data as never }),
  });
}

export function useAppendInterviewTurn() {
  const fn = useServerFn(appendInterviewTurn);
  return useMutation({
    mutationFn: (data: {
      sessionId: string;
      speaker: "candidate" | "persona" | "system";
      text: string;
      startedAt: string;
      endedAt?: string;
      audioPath?: string;
    }) => fn({ data: data as never }),
  });
}

export function useFinalizeEvaluation() {
  const fn = useServerFn(finalizeEvaluation);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { interviewId: string }) => fn({ data: data as never }),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["evaluation", vars.interviewId] }),
  });
}

export function useEvaluationQuery(interviewId: string | undefined) {
  const fn = useServerFn(getEvaluation);
  return useQuery({
    queryKey: ["evaluation", interviewId],
    queryFn: () => fn({ data: { interviewId: interviewId! } as never }),
    enabled: !!interviewId,
  });
}

export function useNextPersonaQuestion() {
  const fn = useServerFn(nextPersonaQuestion);
  return useMutation({
    mutationFn: (data: { sessionId: string }) => fn({ data: data as never }),
  });
}

export function useSessionTurns(sessionId: string | undefined) {
  const fn = useServerFn(listSessionTurns);
  return useQuery({
    queryKey: ["session-turns", sessionId],
    queryFn: () => fn({ data: { sessionId: sessionId! } as never }),
    enabled: !!sessionId,
    refetchInterval: 5000,
  });
}
