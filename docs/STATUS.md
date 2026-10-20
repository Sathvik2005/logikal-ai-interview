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
6. **Tenant isolation (hardened, not RLS).** Per-interview ownership guard added; in production a recruiter with no organization is refused instead of falling into the shared default org. Still code-level filters on a privileged DB role: add database RLS for defence in depth.
7. **Live-interview channel (Redis adapter added).** Set `REDIS_URL` to run more than one backend instance; without it, keep a single instance. The domain event bus is still in-process (nothing consumes it across instances today).
8. **Queue handlers (audited).** Notifications are de-duplicated, evaluation and JD matching are now safe to retry. Resume parsing and state transitions in retried jobs are not yet audited.
9. **Observability (partial).** Errors are logged, stored in `error_events` and sent to `ERROR_ALERT_WEBHOOK_URL` when set. Still no external tracker (Sentry) or uptime monitor.
10. **Always-on hosting.** Use a paid, always-on Render instance (free tier sleeps).
11. **Demo accounts.** Test data now in the Supabase project: candidate test account, one test interview with decisions. The documented admin/recruiter demo passwords were reset on the live project earlier.

### Nice to have
12. Replace the ~70 lint `any` warnings gradually.
13. `ARCHITECTURE.md` still says "Development, June 22".
14. The older per-candidate "Schedule" wizard and the new Quick schedule overlap; decide whether to merge them.

## Deploying

See `docs/DEPLOY_RENDER_CLOUDFLARE.md` (Render for the API, Cloudflare for the web app) and `supabase/manual/apply_pending_remote.md`.
