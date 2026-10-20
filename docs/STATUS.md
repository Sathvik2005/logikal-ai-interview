# Project status and remaining work

_Last updated 2026-10-20. Source of truth for "what is done, what is verified, what is left"._

## Automated checks (all passing)

| Check | Result |
|---|---|
| Backend type-check, build | clean |
| Backend tests | 19 suites, 134 tests |
| Web type-check, build, lint | clean, 0 lint errors (70 `any` warnings) |
| CI (`.github/workflows/ci.yml`) | runs the above on every push / PR |

## Verified end to end with real data (test candidate `candidate.test@logikality.demo`)

schedule (bulk endpoint) → candidate logs in, device check, identity selfie, proctoring setup → session starts →
AI asks and follows up on the candidate's answers → session ends → AI evaluation (report: recommendation, scores,
integrity) → candidate waits in "recruiter_review" → recruiter puts on hold, then rejects, each with a reason →
recruiter sends the outcome email (once). Repeatable with `scripts/demo-interview.mjs`.

## Done

| Area | What exists |
|---|---|
| Monorepo, docs, CI, deploy config | `apps/web`, `apps/backend`, `packages/*`; `render.yaml`, `wrangler.jsonc`, `docs/DEPLOY_RENDER_CLOUDFLARE.md` |
| Auth | Supabase ES256 tokens verified via JWKS; multi-role users resolve to the highest role |
| Data layer | Prisma enums match the DB; every migration through `20260708000000` applied and recorded |
| Durable queue | Postgres `job_queue`: retries, backoff, dead-letter, stale recovery, multi-instance safe |
| File storage | Supabase Storage whenever configured; refuses local disk in production |
| AI models | `-latest` aliases (retired model names had broken every AI feature); fast model for live work |
| Live interview resilience | Each live question has a 10 s budget (`LIVE_QUESTION_TIMEOUT_MS`); on timeout/error the candidate gets the next curated question or a sensible standard follow-up, and an `ai_question_fallback` event is recorded |
| End of interview | Fixed: ending a session now steps the candidate through `interview_running` to `evaluation_processing` (previously a 500 at the end of every interview) |
| Resume / JD auto-fill | Drop a PDF/DOCX/TXT into Add Candidate and New Job |
| Quick + bulk scheduling | Select candidates, live preview of planned slots, one-click send; up to 100 per call; invitation emails queued |
| Human in the loop | Only a person can hire/reject (`POST /candidates/:id/decision`); reasons mandatory for reject, hold and AI overrides; audit table; review queue on the dashboard; decision panel on the report page; AI never emails the candidate its score |
| Outcome email | Human-triggered, once per decision, contains only the outcome and the recruiter's message (never AI data or internal notes) |
| Health check | Public `GET /api/health` (database ping); Render health check points at it |
| Navigation / UI | Grouped menu, getting-started checklist, account menu, working search, layout bug fixes |

## Left to do (in priority order)

### Blocks a real launch
1. **Live room in a real browser.** The automated browser got through device check, identity and proctoring setup,
   and the interview itself was run through the API, but the in-page answer loop (typing / speech, proctoring
   events, screen-share) has not been run end to end. The first AI question also failed to appear in one headless
   run; the backend was fine, so a real-browser pass is needed to confirm whether that was the test setup.
2. **Recording at production level.** Capture, storage (Supabase `recordings` bucket exists), playback and retention are unaudited.
3. **Real email.** `RESEND_API_KEY` is a mock; production needs a real key and a verified sending domain
   (invitation and outcome emails are only logged until then).
4. **AI speed and quota.** The current Gemini key is on a free plan: question latency measured 14-80 s (the 10 s
   fallback keeps candidates moving, but quality drops to generic follow-ups) and Pro is out of quota. Use a paid
   key; set `GEMINI_PRO_MODEL=gemini-pro-latest`. Re-measure latency on the paid key.
5. **Bulk scheduling at volume.** Verified live for one candidate and by unit tests for 20; run it once with a real batch.

### Should be done before scale
6. **Tenant isolation.** The backend uses a privileged DB role, so isolation relies on code filters; the auth guard falls back to a default org id when a token has none.
7. **Live-interview channel is single-instance** (in-memory event bus / WebSocket). Add a Redis adapter before running more than one backend instance.
8. **Queue handlers are at-least-once.** Resume parsing, matching, evaluation and notifications need an idempotency audit (a retried send-notification can email twice).
9. **Observability.** Add error tracking and alerting (the health endpoint is in place).
10. **Always-on hosting.** Use a paid, always-on Render instance (free tier sleeps).
11. **Demo accounts.** Test data now in the Supabase project: candidate test account, one test interview with decisions. The documented admin/recruiter demo passwords were reset on the live project earlier.

### Nice to have
12. Replace the ~70 lint `any` warnings gradually.
13. `ARCHITECTURE.md` still says "Development, June 22".
14. The older per-candidate "Schedule" wizard and the new Quick schedule overlap; decide whether to merge them.

## Deploying

See `docs/DEPLOY_RENDER_CLOUDFLARE.md` (Render for the API, Cloudflare for the web app) and `supabase/manual/apply_pending_remote.md`.
