# Runbook

Day-to-day operation and first response. Scenario scripts are in `PLAYBOOKS.md`.

## Where things are
| What | Where |
|---|---|
| API health | `GET /api/health` (public; 200 means the database answers) |
| API logs | Render dashboard, service `lokality-backend`, Logs. Errors are single JSON lines with a `requestId` |
| Stored errors | table `error_events` (the admin dashboard shows "Errors (24h)") |
| Alerts | the channel behind `ERROR_ALERT_WEBHOOK_URL` (one post per distinct error per cooldown) |
| Background jobs | table `job_queue` (statuses include pending, running, dead) |
| Notifications | table `notification_outbox` (unique `dedupe_key` prevents double sends) |
| Web logs | Cloudflare dashboard, Workers, `lokality-web` |
| Database, auth, storage | Supabase dashboard |

## Daily checks (2 minutes)
- Health endpoint returns 200
- Alert channel quiet, or every alert understood
- `job_queue`: no growing pile of pending or dead rows
- Render: instance up, no restart loop

## How the system works (for diagnosing)
- Candidates and recruiters sign in through Supabase Auth. The API verifies the token and reads **role and organization from the database**, never from token metadata.
- Staff routes are recruiter and admin only. Candidates can call only their own interview routes, checked per interview. In production a recruiter without an organization is refused.
- Resume parsing, matching, evaluation and emails run as background jobs on a Postgres queue. Jobs retry with exponential backoff, then park as `dead`.
- Live interview events travel over Socket.IO. With one API instance this is in-process; with several, `REDIS_URL` must be set.
- The retention service deletes data older than the retention window (default 12 months) every 6 hours in production. `RETENTION_DRY_RUN=true` only counts.

## Common problems
| Symptom | Likely cause | Action |
|---|---|---|
| API will not start, log names a missing or mock env var | production env check | Set the variable in Render, redeploy |
| Health returns 503 or times out | database unreachable or pooler exhausted | Check Supabase status and connection count; confirm `DATABASE_URL` is the pooler URL |
| First request after a quiet period is slow | free-tier Render sleeping | Move to a paid always-on plan |
| Every browser call fails with a CORS error | `FRONTEND_URL` differs from the web origin | Set it to the exact origin (scheme and host, no trailing slash) |
| Users get 401 after working yesterday | Supabase signing key rotated, or `SUPABASE_JWKS_URL` wrong | Check the URL; the API refetches keys on a miss |
| Recruiter gets 403 "not assigned to an organization" | profile has no `org_id` | Assign the organization on the profile |
| Candidate gets 403 on their own interview | candidate row's `user_id` does not match their login | Fix the link on the candidate row |
| Interview questions slow or generic | Gemini quota or latency | Check the Gemini plan; the 10 s fallback keeps interviews moving at lower quality |
| Invitation or outcome emails missing | Resend key or domain, or the job is dead | Check `notification_outbox` and `job_queue`, fix, requeue |
| Live events missing for some viewers | more than one instance without Redis | Set `REDIS_URL`, or run one instance |
| Evaluation stuck "running" | job crashed midway | See playbook 5 |

## Escalation
1. First responder: check health, logs by `requestId`, `error_events`.
2. If candidates are mid-interview and affected, treat it as **Sev 1** and follow the incident playbook.
3. Any security concern (data exposure, leaked key): go straight to the "Secret leaked" playbook.

## Backups and recovery
- Supabase holds the only copy of production data. Enable daily backups and point-in-time recovery (paid plan).
- Test a restore into a scratch project once before launch and quarterly after.
- Recordings live in the Supabase `recordings` bucket and are not covered by database backups.

## Access
- Render, Cloudflare, Supabase, GitHub, Resend and Gemini: named individual accounts with 2FA, no shared logins.
- The Supabase **service role key bypasses all access rules**. Only the API runtime holds it.
