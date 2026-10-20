# Deployment guidelines

How to ship Logikality safely. Hosting is Render (API), Cloudflare (web) and Supabase (database, auth, storage).
Step-by-step setup lives in `DEPLOY_RENDER_CLOUDFLARE.md`; this page holds the rules and the gates.

## Principles
1. **Nothing reaches `main` without green CI.** CI runs on every push (`.github/workflows/ci.yml`). Render auto-deploys `main`, so a red `main` is a red production.
2. **Database first, then API, then web.** The API must never run against an older schema than it expects, and the web app must never call API routes that do not exist yet.
3. **Migrations are additive and idempotent** (`IF NOT EXISTS`). No drops or renames in the same release as the code that stops using them.
4. **Never run `supabase db push` against the live project.** Its migration history table is empty (the schema was created outside it), so it would replay every migration. Apply files by hand in the SQL editor, in order. See `supabase/manual/apply_pending_remote.md`.
5. **Secrets live only in the Render, Cloudflare and Supabase dashboards.** Never in git, chat, tickets or screenshots. The repo is public.
6. **One change per release when touching auth, roles or the database.** It makes rollback obvious.

## Environments
| Env | API | Web | Database | Purpose |
|---|---|---|---|---|
| Local | `localhost:3000` | `localhost:5173` | dev Supabase project | development, smoke tests |
| Production | Render `lokality-backend` | Cloudflare `lokality-web` | production Supabase project | real candidates |

Use a **separate Supabase project for production**. Do not point production at the project that holds demo and test accounts.

## Required configuration (production API)
`NODE_ENV=production`, `DATABASE_URL` (pooler), `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWKS_URL`, `JWT_SECRET` (32+ chars), `GEMINI_API_KEY` (paid plan), `RESEND_API_KEY` (real key, verified domain), `FRONTEND_URL` (exact web origin).

The API refuses to start in production if any of these are missing or mock-valued, or if `FRONTEND_URL` is `*`.

Optional but recommended: `REDIS_URL` (required for more than one instance), `ERROR_ALERT_WEBHOOK_URL`, `ERROR_ALERT_COOLDOWN_SEC`, `GEMINI_PRO_MODEL=gemini-pro-latest`, `QUEUE_DRIVER=postgres`, `RETENTION_ENABLED`, `RETENTION_DRY_RUN`.

## Pre-release checklist
- [ ] CI green on the commit being released
- [ ] `npm test` passes in `apps/backend` (171 tests at the time of writing)
- [ ] New SQL migrations listed, reviewed for idempotency, ready to apply
- [ ] New env vars added to Render and Cloudflare **before** the deploy
- [ ] Release noted in `CHANGELOG.md`
- [ ] Someone besides the author knows the release is going out, and when

## Release steps
1. Merge to `main` (CI green).
2. Apply new SQL migrations in the Supabase SQL editor, oldest first. Confirm each succeeded.
3. Render deploys the API automatically. Watch the deploy log until `/api/health` is healthy.
4. Deploy the web app to Cloudflare (`wrangler deploy` from `apps/web`, or the connected pipeline).
5. Run the post-deploy checks below.

## Post-deploy checks (about 10 minutes)
1. `GET https://<api>/api/health` returns 200 (it pings the database).
2. Log in as a recruiter; open Candidates, Interviews and Reports.
3. As a candidate, open the interview lobby, and confirm a candidate token gets **403** on `/api/candidates` (role gate).
4. Run `node scripts/smoke-e2e.mjs` against production (set `BACKEND_URL`, `SMOKE_EMAIL`, `SMOKE_PASSWORD`; use a dedicated smoke account).
5. Send one invitation and confirm the email arrives (proves Resend and the domain).
6. Check `error_events` and the alert channel for new errors.

## Rollback
- **API:** Render dashboard, Deploys, pick the previous good deploy, Rollback (about a minute).
- **Web:** `wrangler rollback`, or redeploy the previous commit.
- **Database:** migrations are additive, so the previous API version keeps working on the newer schema. Do not try to undo a migration under pressure; roll the code back and fix forward.
- Decide to roll back within 15 minutes of a bad release rather than debugging live.

## Go-live gates (no real candidates until all are true)
- [ ] Production Supabase project created, migrations applied, RLS enabled on every table (including `prompt_library`)
- [ ] No demo or test accounts in production; no password from `README.md` or `CREDENTIALS.md` exists there
- [ ] Real Resend key and verified sending domain
- [ ] Paid Gemini key, latency re-measured
- [ ] Always-on Render plan (the free tier sleeps)
- [ ] Live interview room tested end to end in a real browser (typing, speech, proctoring events, screen share)
- [ ] Recording capture, playback and retention verified
- [ ] Alert webhook configured and tested
- [ ] `REDIS_URL` set if running more than one API instance
- [ ] Supabase backups confirmed (point-in-time recovery on a paid plan)
