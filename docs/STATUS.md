# Project status and remaining work

_Last updated 2026-10-20. Source of truth for "what is done, what is verified, what is left"._

## Automated checks (all passing)

| Check | Result |
|---|---|
| Backend type-check, build | clean |
| Backend tests | 18 suites, 123 tests |
| Web type-check, build, lint | clean, 0 lint errors (70 `any` warnings) |
| CI (`.github/workflows/ci.yml`) | runs the above on every push / PR |

## Done

| Area | What exists | Verified how |
|---|---|---|
| Monorepo, docs, CI | `apps/web`, `apps/backend`, `packages/*`; docs paths/counts fixed | build + CI config |
| Auth | Supabase ES256 tokens verified via JWKS; multi-role users resolve to the highest role | live login as recruiter and superadmin |
| Data layer | Prisma enums match the DB; all migrations recorded in Supabase history | live read endpoints return 200 |
| Durable queue | Postgres `job_queue` (retries, backoff, dead-letter, stale recovery, multi-instance safe) | unit tests; table exists in Supabase |
| File storage | Supabase Storage used whenever configured; refuses local disk in production | unit tests |
| AI models | Defaults moved from retired models to `-latest` aliases (lite for fast work) | real parse calls, 1-2 s |
| Resume / JD auto-fill | Drop a PDF/DOCX/TXT into Add Candidate and New Job | real file through the real UI |
| Quick + bulk scheduling | Select candidates, live preview of planned slots, one-click send; up to 100 per call; emails queued | unit tests; preview in the real UI (final send not run) |
| Human-in-the-loop | Only a person can hire/reject: `POST /candidates/:id/decision`, reasons mandatory for reject/hold/AI override, full audit table, review queue on the dashboard, decision panel on the report page. AI no longer emails candidates their score | unit tests + live API (409/403/400 checks) |
| Navigation / UI | Grouped menu, getting-started checklist, account menu, working search, layout bug fixes | screenshots of every recruiter + admin screen |

## Left to do (in priority order)

### Blocks a real launch
1. **Run one real interview end to end.** Invite, candidate joins, camera/mic check, live AI questions, proctoring, report, recruiter decision. The candidate test account now exists and its login and portal pages load; the interview itself (needs a scheduled interview + browser camera/mic) has not been run yet.
2. **Recording at production level.** Capture, storage (Supabase `recordings` bucket exists), playback and retention are unaudited.
3. **Real email.** `RESEND_API_KEY` is a mock; production needs a real key and a verified sending domain. Invitation emails and the decision outcome email depend on it.
4. **Paid Gemini key.** The current key is on a free plan (Pro returned "quota exceeded"; 20 parallel interviews will hit rate limits). Set `GEMINI_PRO_MODEL=gemini-pro-latest` on a paid key.
5. **Bulk send untested against real data.** The preview works; the actual create-and-email step has not been run (it writes to the database).
6. **Decision outcome email.** After a human decision nothing is sent to the candidate. Add an explicit, human-triggered "send outcome" action.

### Should be done before scale
7. **Tenant isolation.** The backend uses a privileged DB role, so isolation relies on code filters only; the auth guard falls back to a default org id when a token has none.
8. **Live-interview channel is single-instance** (in-memory event bus / WebSocket). Add a Redis adapter before running more than one backend instance.
9. **Queue handlers are at-least-once.** Resume parsing, matching, evaluation and notifications need an idempotency audit.
10. **Observability.** No error tracking, metrics or alerting; add before real users.
11. **Always-on hosting.** Use a paid, always-on Render instance (free tier sleeps).
12. **Demo accounts.** A candidate test account exists in the Supabase project (`candidate.test@logikality.demo`, linked to a candidate record in status `shortlisted`; password shared out of band, not in git). It has no interview yet: schedule one for it, then run the candidate flow. The older documented demo candidates (`aisha.k@`, `m.chen@`) do not exist; documented demo passwords for admin/recruiter were reset on the live project earlier.

### Nice to have
13. Replace the ~70 lint `any` warnings gradually.
14. `ARCHITECTURE.md` still says "Development, June 22".
15. The old per-candidate "Schedule" wizard and the new Quick schedule overlap; decide whether to merge them.

## Deploying

See `docs/DEPLOY_RENDER_CLOUDFLARE.md` (Render for the API, Cloudflare for the web app) and `supabase/manual/apply_pending_remote.md`.
All migrations through `20260707000000_candidate_decisions.sql` are applied to the Supabase project in `apps/backend/.env`.
