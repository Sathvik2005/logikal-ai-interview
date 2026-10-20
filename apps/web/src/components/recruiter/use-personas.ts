import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listPersonas,
  getPersona,
  upsertPersona,
  deletePersona,
  type PersonaDTO,
} from "@/lib/personas.functions";

export type { PersonaDTO };
export const personasKeys = {
  all: ["personas"] as const,
  detail: (id: string) => ["personas", "detail", id] as const,
};

export const personasListOptions = () =>
  queryOptions({ queryKey: personasKeys.all, queryFn: () => listPersonas(), staleTime: 30_000 });

export function usePersonasQuery() {
  return useQuery(personasListOptions());
}
export function usePersonaQuery(id: string) {
  const fn = useServerFn(getPersona);
  return useQuery({ queryKey: personasKeys.detail(id), queryFn: () => fn({ data: { id } }) });
}
export function useUpsertPersona() {
  const qc = useQueryClient();
  const fn = useServerFn(upsertPersona);
  return useMutation({
    mutationFn: (input: {
      id?: string;
      name: string;
      personaType?: string | null;
      tone?: string | null;
      difficulty?: string | null;
      prompt?: string | null;
    }) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: personasKeys.all }),
  });
}
export function useDeletePersona() {
  const qc = useQueryClient();
  const fn = useServerFn(deletePersona);
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: personasKeys.all }),
  });
}
