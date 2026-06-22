# Phase 1 Completion Plan — Wizard + Prompt Editor Wiring

Goal: close the last two gaps so recruiter-side configuration actually flows into scheduled interviews end-to-end. No new features; only wiring of already-built APIs.

## Scope

1. **ScheduleInterviewWizard → real DB data**
   - File: `src/components/recruiter/ScheduleInterviewWizard.tsx`, `src/routes/_authenticated/recruiter/scheduling/index.tsx`
   - Remove `SEED_JDS` / `SEED_PERSONAS` mock arrays.
   - Replace with live data via existing hooks: `useJobsQuery` (`use-jobs.ts`), `usePersonasQuery` (`use-personas.ts`), `useCandidatesQuery` (`use-candidates.ts`).
   - Wizard state: keep `jobId`, `personaId`, `candidateId`, `scheduledAt`, `durationMinutes`. Drop `strategy` / `mode` / `difficulty` / `meetingProvider` UI from Phase 1 (deferred — Phase 2).
   - `onScheduled` in `scheduling/index.tsx` calls `useScheduleInterview().mutate({ candidateId, jobId, personaId, scheduledAt, durationMinutes })` — already supported by `scheduleInterview` server fn.
   - Loading / empty states: if no jobs or personas exist, show inline CTA linking to `/recruiter/jobs/new` and `/recruiter/personas/new`; disable Next until both selected.

2. **Persona prompt-editor save**
   - File: `src/routes/_authenticated/recruiter/personas/prompt.tsx`
   - Replace placeholder save with `useUpsertPersona()` mutation, passing `{ id, name, prompt }`.
   - On success: toast confirm, invalidate `personasKeys.all` (handled by hook), navigate back to persona detail / list.
   - Server-side `upsertPersona` already snapshots `persona_versions` on every save (done in prior turn).

## Out of Scope (Phase 2 — do not implement now)

- Rubric authoring UI / `personas.config` editor
- Strategy / difficulty / mode knobs in wizard
- Persona version history UI
- Curated question picker in wizard (auto-pulled from `persona_questions` by `scheduleInterview` already)

## Validation

- Schedule a real interview via the wizard → verify `interviews` row has non-null `job_id`, `persona_id`, `persona_version_id`.
- Edit a persona prompt → verify a new `persona_versions` row is inserted with incremented `version`.
- Start that interview as a candidate → confirm `nextPersonaQuestion` system prompt contains JD title + persona name (already wired).

## Files Touched

- `src/components/recruiter/ScheduleInterviewWizard.tsx` (replace mocks, simplify state)
- `src/routes/_authenticated/recruiter/scheduling/index.tsx` (pass real IDs to mutation)
- `src/routes/_authenticated/recruiter/personas/prompt.tsx` (wire save mutation)

No DB migrations. No new server functions. No new dependencies.
