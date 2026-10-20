#!/usr/bin/env node
/**
 * Repeatable end-to-end demo of the interview pipeline, driven through the same HTTP API the app uses:
 *
 *   recruiter schedules  ->  candidate starts the session and answers  ->  session ends  ->
 *   AI evaluation runs  ->  candidate lands in "recruiter_review" waiting for a HUMAN decision
 *
 * It does not make the hiring decision: open the report in the recruiter UI and approve / hold / reject there.
 *
 * Usage (backend must be running, e.g. `npm run dev:backend`):
 *   RECRUITER_EMAIL=... RECRUITER_PASSWORD=... \
 *   CANDIDATE_EMAIL=... CANDIDATE_PASSWORD=... CANDIDATE_ID=<uuid of the candidate record> \
 *   node scripts/demo-interview.mjs [--dry-run] [--answers 4]
 *
 * Other env: BACKEND_URL (default http://localhost:3000), SUPABASE_URL / SUPABASE_ANON_KEY (read from
 * apps/backend/.env when unset), PERSONA_ID (default: first AI interviewer).
 *
 * WARNING: this writes real data (an interview, turns, a report). Use a test candidate and a dev project.
 */
import { readFileSync } from "node:fs";

const env = { ...process.env };
try {
  const file = new URL("../apps/backend/.env", import.meta.url);
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)="?([^"]*)"?\s*$/);
    if (m && !(m[1] in env)) env[m[1]] = m[2];
  }
} catch {
  /* .env is optional when everything is passed via the environment */
}

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const ANSWER_COUNT = Number(args[args.indexOf("--answers") + 1]) || 4;
const API = (env.BACKEND_URL || "http://localhost:3000") + "/api";

const need = (k) => {
  if (!env[k]) {
    console.error(`Missing ${k}. See the usage notes at the top of this file.`);
    process.exit(2);
  }
  return env[k];
};

const ANSWERS = [
  "I have about four years of backend experience, mostly Node.js and TypeScript with PostgreSQL. Most recently I owned a payments ledger service handling a few thousand requests per second.",
  "I would generate short codes from a base62-encoded counter or random keys, keep them in a key-value store, cache hot keys in Redis and put a CDN in front for reads. The trade-off is collisions versus coordination cost.",
  "When latency spiked I added tracing first, found a missing index and an N+1 query, fixed both, and added a p99 alert so we catch regressions early.",
  "I keep services small and observable, write idempotent consumers for Kafka, and use retries with backoff plus dead-letter queues so failures are visible rather than silent.",
  "I review my own pull requests first, keep changes small, and pair on risky migrations so knowledge is shared and rollbacks are rehearsed.",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const step = (msg) => console.log(`\n▶ ${msg}`);

async function login(email, password) {
  const res = await fetch(`${need("SUPABASE_URL")}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: need("SUPABASE_ANON_KEY"), "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!body.access_token) throw new Error(`Login failed for ${email}: ${body.error_description || body.msg}`);
  return { authorization: `Bearer ${body.access_token}`, "content-type": "application/json" };
}

async function call(headers, method, path, body) {
  const t0 = Date.now();
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 200)}`);
  return { json, ms: Date.now() - t0 };
}

const candidateId = need("CANDIDATE_ID");

step("Logging in as the recruiter and the candidate");
const recruiter = await login(need("RECRUITER_EMAIL"), need("RECRUITER_PASSWORD"));
const candidate = await login(need("CANDIDATE_EMAIL"), need("CANDIDATE_PASSWORD"));

step("Scheduling (bulk-schedule endpoint, dry run first)");
const personaId = env.PERSONA_ID || (await call(recruiter, "GET", "/personas")).json?.[0]?.id;
if (!personaId) throw new Error("No AI interviewer found. Create one first (or set PERSONA_ID).");
const plan = {
  candidateIds: [candidateId],
  personaId,
  startAt: new Date(Date.now() + 2 * 60_000).toISOString(),
  durationMinutes: 30,
  workStartHour: 0,
  workEndHour: 24,
};
const preview = (await call(recruiter, "POST", "/interviews/bulk-schedule", { ...plan, dryRun: true })).json;
console.log("  plan:", JSON.stringify(preview.results));
if (DRY) {
  console.log("\n--dry-run: nothing was created.");
  await sleep(100);
  process.exit(0);
}
if (!preview.schedulable) throw new Error(`Cannot schedule: ${preview.results[0]?.error ?? "unknown reason"}`);
const scheduled = (await call(recruiter, "POST", "/interviews/bulk-schedule", plan)).json;
const interviewId = scheduled.results[0]?.interviewId;
if (!interviewId) throw new Error(`Scheduling failed: ${scheduled.results[0]?.error}`);
console.log("  interview:", interviewId, "at", scheduled.results[0].scheduledAt);

step("Candidate starts the session");
const session = (await call(candidate, "POST", "/interviews/session/start", { interviewId, deviceInfo: { demo: true } })).json;
console.log("  session:", session.id);

step(`Interview: AI asks, candidate answers (${ANSWER_COUNT} rounds)`);
let q = (await call(candidate, "POST", `/interviews/session/${session.id}/next-question`)).json;
for (let i = 0; i < ANSWER_COUNT; i++) {
  console.log(`  AI : ${String(q.text).slice(0, 110)}`);
  await call(candidate, "POST", `/interviews/session/${session.id}/turn`, { speaker: "candidate", text: ANSWERS[i % ANSWERS.length] });
  const next = await call(candidate, "POST", `/interviews/session/${session.id}/next-question`);
  q = next.json;
  console.log(`  you: ${ANSWERS[i % ANSWERS.length].slice(0, 70)}…  (next question in ${(next.ms / 1000).toFixed(1)}s)`);
}

step("Candidate ends the session; AI evaluation starts in the background");
await call(candidate, "POST", "/interviews/session/end", { sessionId: session.id });

step("Waiting for the evaluation (usually 1-2 minutes)");
const deadline = Date.now() + 6 * 60_000;
let status = "";
while (Date.now() < deadline) {
  status = (await call(recruiter, "GET", `/candidates/${candidateId}`)).json?.status;
  process.stdout.write(`  candidate status: ${status}   \r`);
  if (status === "recruiter_review") break;
  await sleep(8000);
}
console.log();
if (status !== "recruiter_review") throw new Error(`Evaluation did not finish in time (status: ${status}).`);

const state = (await call(recruiter, "GET", `/candidates/${candidateId}/decisions`)).json;
console.log("\n✔ Pipeline complete.");
console.log(`  AI recommendation: ${state.context.aiRecommendation}  score: ${state.context.aiScore}  integrity: ${state.context.integrityScore}`);
console.log("  The candidate is now WAITING FOR A HUMAN DECISION. Open the report in the recruiter UI:");
console.log(`  /recruiter/reports/${state.context.interviewId}`);
