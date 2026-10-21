# Deploying: backend on Render, frontend on Cloudflare

The web app is built for **Cloudflare Workers** (the TanStack Start/Lovable build config fixes that target;
`NITRO_PRESET=vercel` is ignored, so Vercel is not supported without changing the build setup).

## 0. Before you start
- Use a **separate Supabase project for production**. Do not enable `app.seed_demo` there.
- Apply migrations to it: `npx supabase db push --db-url "<PROD DIRECT_URL>"` (a fresh project has no history, so all migrations run).
- Create the first admin user from Supabase Authentication, then add a row in `user_roles` (role `admin`).
- Push the repo to GitHub (`git push origin main`) and confirm CI is green.

## 1. Backend on Render
1. Render Dashboard > **New > Blueprint** > pick this repo. It reads `render.yaml` (service `lokality-backend`).
2. Fill the prompted secrets:

| Variable | Value |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Supabase pooler / direct Postgres URLs |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Settings > API |
| `SUPABASE_JWKS_URL` | `https://<project>.supabase.co/auth/v1/.well-known/jwks.json` |
| `JWT_SECRET` | Supabase JWT secret, at least 32 chars |
| `GEMINI_API_KEY` | Google AI Studio |
| `RESEND_API_KEY` | real `re_...` key (mock values abort startup in production) |
| `FRONTEND_URL` | exact web origin, e.g. `https://lokality-web.<account>.workers.dev` (no trailing slash) |

3. Deploy. Health check is `/api/docs`. Note the URL, e.g. `https://lokality-backend.onrender.com`.
   Free/starter instances sleep or restart, and the in-memory queue and local file storage are not durable:
   use a paid always-on instance and Supabase Storage for resumes before real use.

## 2. Frontend on Cloudflare
From `apps/web` (needs a Cloudflare account; `npx wrangler login` once):

```bash
# build-time public vars
export VITE_SUPABASE_URL=https://<project>.supabase.co
export VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
npm run build            # in apps/web
npx wrangler deploy      # uses apps/web/wrangler.jsonc

# server-side secrets (runtime)
npx wrangler secret put BACKEND_URL                 # the Render URL, no trailing slash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```
Or connect the repo in Cloudflare Workers Builds with root `apps/web`, build command `npm run build`,
deploy command `npx wrangler deploy`, and add the same variables in the dashboard.

## 3. Wire and verify
1. Set Render's `FRONTEND_URL` to the final web URL and redeploy the backend (CORS).
2. In Supabase > Authentication > URL configuration, add the web URL as Site URL and redirect URL.
3. Open the web URL, log in, and run `BACKEND_URL=<render url> SMOKE_EMAIL=... SMOKE_PASSWORD=... node scripts/smoke-e2e.mjs`.

## 4. Continuous deployment (free)
Every push to `main` runs `.github/workflows/ci.yml`: typecheck, tests and build (`check`), then `deploy-web` publishes the web app to Cloudflare. Render redeploys the backend only after the same check passes (`autoDeployTrigger: checksPass`). GitHub Actions is free for public repos.

One-time setup in GitHub > Settings > Secrets and variables > Actions:
`CLOUDFLARE_API_TOKEN` (Workers edit permission), `CLOUDFLARE_ACCOUNT_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. Without `CLOUDFLARE_API_TOKEN` the deploy job skips itself.

Collaborators: add them under Settings > Collaborators (Write access). Their pull requests run `check`; once merged to `main` they deploy automatically. Optionally protect `main` (require PR + the `check` status) so nothing deploys without a green build.

## 5. Error tracking (Sentry, free tier)
The backend reports every 5xx to Sentry when `SENTRY_DSN` is set (unset = disabled, nothing else changes). Create a free Sentry project (platform: Node.js), copy its DSN, and add it as `SENTRY_DSN` in the Render service's environment. Errors carry the `request_id` returned to the caller, so they match the logs and the `error_events` table.

The web app reports browser errors (React error boundaries, uncaught errors, unhandled rejections) when `VITE_SENTRY_DSN` is set at build time. Add it as a GitHub Actions secret named `VITE_SENTRY_DSN` (a browser DSN is public by design; the same project's DSN as the backend works, or create a second Node/React project). Unset = disabled. Cloudflare Worker (SSR) errors are not sent to Sentry.
