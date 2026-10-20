# Playbooks

Step-by-step scripts for specific situations. Operating basics are in `RUNBOOK.md`; release rules in `DEPLOYMENT_GUIDELINES.md`.

## 1. Production account switch (test to real)
Goal: move from demo data to a clean production setup.
1. Create a **new** Supabase project for production. Apply every file in `supabase/migrations/` in order via the SQL editor. Enable RLS on all tables.
2. Create the first admin in Supabase Auth, then add its `user_roles` row. Use a strong unique password and 2FA.
3. Create the organization and the real recruiter accounts. Recruiters **must** have an organization on their profile.
4. In Render set the production env values (see `DEPLOYMENT_GUIDELINES.md`) pointing at the new project. Set `FRONTEND_URL` to the real web origin.
5. In Cloudflare set the web app's `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `BACKEND_URL` for the new project.
6. Resend: verify the sending domain (SPF, DKIM), create a key, set `RESEND_API_KEY`.
7. Gemini: use a paid key and set `GEMINI_PRO_MODEL=gemini-pro-latest`.
8. Deploy, run the post-deploy checks, then take one internal "candidate" through the whole flow.
9. Only then remove or disable remaining demo and test users, and rotate any password that ever appeared in docs.
10. Record the date and who did it in `CHANGELOG.md`.

## 2. Rotate credentials (demo passwords or any secret)
1. Treat anything that appeared in a public repo as compromised.
2. Passwords: reset in Supabase Auth (for demo users on a non-production project, `supabase/manual/reset_demo_passwords.sql`). Remove them from `README.md` and `docs/CREDENTIALS.md`.
3. API keys (Gemini, Resend, Supabase service role): create a new key, update Render, redeploy, then revoke the old key.
4. Confirm login and an email send still work.

## 3. Secret leaked
1. Revoke the key at its provider **first**, before cleaning git.
2. Create a replacement, update Render and Cloudflare, redeploy.
3. Check provider logs for use during the exposure window.
4. If personal data may have been accessed, follow `COMPLIANCE_AND_SECURITY.md` for notification duties.
5. Remove the secret from the repo. Rewriting history on a public repo does not undo exposure; revocation does.

## 4. Incident response (API down or interviews failing)
1. **Declare** severity. Sev 1 means candidates currently in interviews are affected.
2. **Stabilize**: if the last release caused it, roll back. Do not debug live first.
3. **Communicate**: tell affected recruiters; interviews can be rescheduled (`PATCH /interviews/:id/reschedule`).
4. **Diagnose**: health, Render logs by `requestId`, `error_events`, Supabase status.
5. **Fix forward** with a normal release once stable.
6. **Review** within two days: timeline, cause, one preventive change. Add a row to `RUNBOOK.md` if it can recur.

## 5. Stuck evaluation
Symptom: an interview shows evaluation "running" or "failed" for a long time.
1. Look in `job_queue` for the `finalize-evaluation` row for that interview: dead or pending?
2. Read the error on the job row and in `error_events`.
3. Fix the cause (usually Gemini quota or key).
4. Requeue by setting the job back to pending, or have a recruiter call `POST /interviews/:id/finalize-evaluation`. Retrying is safe: a completed evaluation is skipped, and the report is updated rather than duplicated.

## 6. Dead or backlogged jobs
1. Count rows in `job_queue` by status.
2. Group dead jobs by `task` and error; usually there is one cause.
3. After fixing, reset the rows to pending. Notification jobs are de-duplicated; evaluation and matching jobs are safe to retry. Resume-parsing retries are not yet audited, so check one before resetting many.

## 7. Scale to more than one API instance
1. Provision Redis and set `REDIS_URL` on the API.
2. Redeploy and confirm the log line "Socket.IO is using the Redis adapter".
3. Scale instances. Queue claiming already uses `SKIP LOCKED`, so jobs will not double-run.
4. Test a live interview with the recruiter monitor on a different instance than the candidate.

## 8. Candidate data request or deletion
1. Verify the requester's identity out of band.
2. Export: candidate record, interview turns, report, recordings (storage bucket).
3. Delete: remove the candidate record and the storage objects. The retention service handles routine expiry; do not rely on it for a legal deadline.
4. Log the request and the completion date.

## 9. Apply a database migration to production
1. Back up first (on-demand backup, or confirm PITR).
2. Read the file; confirm it is idempotent and additive.
3. Run it in the SQL editor, off-peak.
4. Verify with a quick query, then deploy the code that needs it.
5. Never use `supabase db push` here.

## 10. Hotfix
1. Branch from `main`, make the smallest possible change, add a test.
2. CI green, merge, deploy, run the post-deploy checks.
3. Note it in `CHANGELOG.md`.
