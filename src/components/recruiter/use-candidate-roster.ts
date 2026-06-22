// Shared frontend store for the candidate roster.
// Seeds from MOCK_CANDIDATES and lets the wizard append new records live.
import { useSyncExternalStore } from "react";
import { MOCK_CANDIDATES, type Candidate } from "@/components/recruiter/mock-data";

type State = { candidates: Candidate[] };

let state: State = { candidates: [...MOCK_CANDIDATES] };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const getSnapshot = () => state;

export function useCandidateRoster() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    candidates: snap.candidates,
    addCandidate: (c: Candidate) => {
      state = { ...state, candidates: [c, ...state.candidates] };
      emit();
    },
  };
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
