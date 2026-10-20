import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listQuestions,
  listQuestionBanks,
  upsertQuestion,
  deleteQuestion,
  type QuestionDTO,
  type QuestionBankDTO,
} from "@/lib/questions.functions";

export type { QuestionDTO, QuestionBankDTO };
export const questionsKeys = {
  all: ["questions"] as const,
  banks: ["questions", "banks"] as const,
  byCompetency: (c?: string) => ["questions", "list", c ?? "all"] as const,
};

export const questionBanksOptions = () =>
  queryOptions({
    queryKey: questionsKeys.banks,
    queryFn: () => listQuestionBanks(),
    staleTime: 30_000,
  });

export const questionsByCompetencyOptions = (competency?: string) =>
  queryOptions({
    queryKey: questionsKeys.byCompetency(competency),
    queryFn: () => listQuestions({ data: competency ? { competency } : {} }),
  });

export function useQuestionBanksQuery() {
  return useQuery(questionBanksOptions());
}
export function useQuestionsQuery(competency?: string) {
  return useQuery(questionsByCompetencyOptions(competency));
}
export function useUpsertQuestion() {
  const qc = useQueryClient();
  const fn = useServerFn(upsertQuestion);
  return useMutation({
    mutationFn: (input: {
      id?: string;
      competency: string;
      difficulty?: "easy" | "medium" | "hard";
      type?: string;
      prompt: string;
      expectedSignals?: string[];
    }) => fn({ data: { difficulty: "medium", type: "open", expectedSignals: [], ...input } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: questionsKeys.all }),
  });
}
export function useDeleteQuestion() {
  const qc = useQueryClient();
  const fn = useServerFn(deleteQuestion);
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: questionsKeys.all }),
  });
}
