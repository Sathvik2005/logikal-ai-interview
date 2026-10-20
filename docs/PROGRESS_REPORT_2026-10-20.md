# Lokality AI — Progress Report (2026-10-20)

> Supersedes the status sections of [PROGRESS.md](PROGRESS.md) (last updated 2026-06-23). Based on the repo at `origin/main` (`964bca4`, 2026-07-04) plus the uncommitted monorepo restructure in the working tree.

## 1. Current state

| Area | Status |
|---|---|
| Repo sync | `main` = `origin/main` (0 ahead / 0 behind). No commits since 2026-07-04. |
| Layout | Mid-migration to an npm-workspace monorepo (`apps/web`, `apps/backend`, `packages/types`, `packages/ts-config`). **Uncommitted** (229 changed paths). |
| Backend (`apps/backend`, NestJS + Prisma) | `tsc --noEmit` clean. 12/12 suites, 74/74 tests pass with `jest --runInBand`. ~63 HTTP routes across 11 controllers (admin, analytics, candidates, interviews, jobs, personas, proctoring, questions, reports, ...). |
| Web (`apps/web`, TanStack Start + React 19) | `tsc --noEmit` clean after fixes below; `vite build` succeeds. |
| Database (Supabase) | 30 migrations, latest `20260704000000_fix_database_discrepancies.sql`. **Not verified as applied** to the live project. |

## 2. Errors found and fixed this session

The web app had 25 TypeScript errors, all from two causes:

1. **Stale generated Supabase types** (`apps/web/src/integrations/supabase/types.ts`). The 2026-07-04 migration extends `candidate_status` with 13 workflow values and the candidates table has `job_id`, `custom_role`, `resume_analysis`, but the types did not.
   *Fix:* added the 13 enum values (type and `Constants`) and the three columns to `Row`/`Insert`/`Update`. Edited by hand, not regenerated — regenerate with `supabase gen types` once the migration is confirmed applied.
2. **Two status vocabularies mixed up.** `@logikality/types` exports the *workflow* `CandidateStatus` (`applied`, `shortlisted`, ...), but the recruiter UI and `mapRow()` use 8 *display* statuses (`new`...`archived`).
   *Fix:* `apps/web/src/lib/candidates.functions.ts` now defines and exports a UI-level `CandidateStatus`, re-exports `CreateCandidateInput` (which `use-candidates.ts` expected), and casts DB-bound statuses to the `candidate_status` enum at the query/insert boundary. Also `let` → `const` for `dbStatus`.

**Backend test note:** `npx jest` (parallel) showed 5 suites failing to start with a jest worker exit, though each passes alone. `npx jest --runInBand` passes everything. Likely worker crashes on this Windows machine; consider adding `--runInBand` (or `maxWorkers`) to the `test` script.

## 3. Work history (16 commits, 2026-06-22 → 2026-07-04)

- **06-22:** first commit, UI empty-state audit, NestJS backend scaffold, frontend→backend proxy, documentation suite.
- **06-25 / 06-28:** core backend integration, automated tests (12 suites), E2E schema alignment, notification history.
- **07-01:** database sync, AI resilience, frontend stabilization.
- **07-02:** demo-user seed migration, CSRF protection, wizard fixes, offline fallback routes direct to Supabase, strict service-role-key check, removal of unused `LOVABLE_API_KEY`.
- **07-04:** candidate/job creation discrepancies, extended status enum.

## 4. Mismatches found (docs vs code, code vs schema)

| # | Mismatch | Where | Impact / fix |
|---|---|---|---|
| 1 | Stale generated types: `candidate_timeline`, `interview_templates`, `question_banks` exist in migrations and Prisma but not in `types.ts` (29 tables there vs 33 Prisma models) | `apps/web/.../supabase/types.ts` | Typed queries to these tables fail. Regenerate types after applying migrations. |
| 2 | `PromptLibrary` Prisma model has **no Supabase migration** | `prisma/schema.prisma` vs `supabase/migrations` | Table won't exist in Supabase unless created via `prisma db push`. Add a migration or drop the model. |
| 3 | `candidates.status` is a free `String` in Prisma but a Postgres **enum** in Supabase; backend `PATCH /candidates/:id/status` takes `any` | Prisma, `candidates.controller.ts:115` | Invalid values are only caught by `workflow.transition` or the DB. Validate with the shared `CandidateStatusList`. |
| 4 | Shared `CandidateStatus` (workflow: 15 values) vs UI `CandidateStatus` (8 display values) vs DB enum (21 values, incl. `screening`, `offer`, `hired`, `rejected`) | `packages/types`, web, DB | Fixed in code with explicit mapping (section 2); a `hired`/`hiring_decision` filter in `listCandidates` maps only `hiring_decision`, so DB `hired` rows are excluded from the "hired" filter. Worth a follow-up. |
| 5 | Docs say **56** routes; code has **63** route decorators in 11 controllers | `API_REFERENCE.md`, `PROGRESS.md` | Update counts / re-audit API_REFERENCE. |
| 6 | Docs say **73** tests; actual is **74** | `TEST_SUITE_SPECIFICATION.md`, `PROGRESS.md` | Update. |
| 7 | Docs use old paths: `cd backend`, `backend/.env`, `backend/src/...`, absolute `file:///e:/...` links | ADMINISTRATION_GUIDE, ARCHITECTURE, DEPLOYMENT_AND_OPERATIONS, INTEGRATION_GUIDE, PROGRESS, SETUP, TESTING_PLAYBOOK, TEST_SUITE_SPECIFICATION, DATABASE_SCHEMA, CREDENTIALS | Now `apps/backend/...`; use relative links; root scripts are `npm run dev:backend`, `dev:web`, `db:push`. |
| 8 | README/docs describe a `backend/` + root `src/` layout; code is now `apps/*` + `packages/*` | README, SETUP, ARCHITECTURE | Update project-tree diagrams. |
| 9 | `.env` has a `LOVABLE`-era web dependency (`@lovable.dev/cloud-auth-js`, `lovable-error-reporting.ts`) while the backend dropped `LOVABLE_API_KEY` | web app | Decide whether to keep or remove. |

## 5. Resolution status (updated after fixes)

| Mismatch | Status |
|---|---|
| 1 Missing table types | **Fixed** — `candidate_timeline`, `interview_templates`, `prompt_library`, `question_banks` added to `types.ts` (hand-written from Prisma; regenerate with `supabase gen types` once migrations are applied). |
| 2 `prompt_library` without migration | **Fixed** — `20260705000000_add_prompt_library.sql` (RLS on, service-role only). Must still be applied to Supabase. |
| 3 Unvalidated status endpoint | **Fixed** — `PATCH /candidates/:id/status` returns 400 for values outside `CANDIDATE_STATUSES` (domain entity). |
| 4 "Hired" filter | **Fixed** — filter now matches `hired` and `hiring_decision`. |
| 5-6 Route/test counts | **Fixed** — 63 routes, 74 tests. |
| 7-8 Old paths, trees, `file:///` links | **Fixed** — README, SETUP and 9 other docs use `apps/backend`, relative links, workspace scripts (`npm run dev:web` / `dev:backend`). |
| 9 Lovable dependency | **Not an error** — Lovable auth/error-reporting is used in `auth.tsx`, `__root.tsx`, `vite.config.ts` and the middleware; left as is. |

**Verification (local):** web `tsc` clean and `vite build` OK; backend `tsc` + `nest build` clean; 12/12 suites, 74/74 tests (`npm test` now runs `--runInBand`); ESLint 0 errors (prettier auto-fixed; `no-explicit-any` downgraded to a warning, 66 warnings remain). Ran locally: backend on :3000 (Swagger 200, API returns 401 without auth as designed), web dev server on :5173 (200).

**Known leftover:** the recruiter UI sends display statuses (e.g. `screening`) to `PATCH /candidates/:id/status`; the backend only accepts workflow statuses, so manual status changes from that UI are rejected (400) — they previously failed inside the state machine. Needs a UI-to-workflow mapping decision.

## 6. Open items / risks

1. **Apply migrations 20260704 and 20260705** to Supabase, then regenerate `types.ts`.
2. **Resolve the status-change UI mismatch** described above.
3. **Two lockfiles** at root (`package-lock.json`, `bun.lock`) — pick one.
4. **Line endings:** git warns LF→CRLF on many files; add `.gitattributes`.
5. **Secrets hygiene:** `docs/CREDENTIALS.md` and the demo-credential seed migrations hold demo logins; keep them out of production and out of public repos.
6. **Not verified:** ESLint, runtime behavior (backend + web running together), E2E flows, `apps/backend/test/jest-e2e.json`.

## 7. Suggested next steps

1. Apply the two migrations and regenerate Supabase types.
2. Decide and implement the UI-status to workflow-status mapping for manual status changes.
3. Gradually replace the 47 `any` usages flagged as lint warnings.
4. Exercise the full flow with real credentials: candidate create, shortlist, interview, report.
