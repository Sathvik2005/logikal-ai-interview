// Shared frontend store for the scheduling workspace.
// Holds a mutable copy of MOCK_INTERVIEWS plus an in-memory activity log.
import { useSyncExternalStore } from "react";
import { MOCK_INTERVIEWS, type Interview } from "@/components/recruiter/mock-data";

export type ActivityKind = "created" | "rescheduled" | "cancelled" | "email" | "joined";

export type ActivityEntry = {
  id: string;
  kind: ActivityKind;
  message: string;
  at: string;
  interviewId?: string;
};

type State = {
  interviews: Interview[];
  activity: ActivityEntry[];
};

let state: State = {
  interviews: [...MOCK_INTERVIEWS],
  activity: [
    {
      id: "a-seed",
      kind: "created",
      at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      message: "Schedule synced with calendar provider",
    },
  ],
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const getSnapshot = () => state;

function pushActivity(entry: Omit<ActivityEntry, "id" | "at"> & { at?: string }) {
  state = {
    ...state,
    activity: [
      {
        id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        at: entry.at ?? new Date().toISOString(),
        ...entry,
      },
      ...state.activity,
    ].slice(0, 30),
  };
}

export function useInterviewSchedule() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    interviews: snap.interviews,
    activity: snap.activity,
    addInterview: (i: Interview) => {
      state = { ...state, interviews: [...state.interviews, i] };
      pushActivity({
        kind: "created",
        interviewId: i.id,
        message: `Scheduled ${i.candidateName} — ${i.role}`,
      });
      emit();
    },
    rescheduleInterview: (id: string, newISO: string, newDuration?: number) => {
      const before = state.interviews.find((x) => x.id === id);
      state = {
        ...state,
        interviews: state.interviews.map((x) =>
          x.id === id
            ? { ...x, scheduledAt: newISO, durationMin: newDuration ?? x.durationMin }
            : x,
        ),
      };
      if (before) {
        pushActivity({
          kind: "rescheduled",
          interviewId: id,
          message: `Rescheduled ${before.candidateName} to ${new Date(newISO).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`,
        });
      }
      emit();
    },
    cancelInterview: (id: string) => {
      const before = state.interviews.find((x) => x.id === id);
      state = {
        ...state,
        interviews: state.interviews.map((x) => (x.id === id ? { ...x, status: "cancelled" } : x)),
      };
      if (before)
        pushActivity({
          kind: "cancelled",
          interviewId: id,
          message: `Cancelled ${before.candidateName}`,
        });
      emit();
    },
    logActivity: (kind: ActivityKind, message: string, interviewId?: string) => {
      pushActivity({ kind, message, interviewId });
      emit();
    },
  };
}
