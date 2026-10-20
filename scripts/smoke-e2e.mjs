// End-to-end smoke test against a RUNNING backend with a real Supabase login.
// Usage: SMOKE_EMAIL=... SMOKE_PASSWORD=... node scripts/smoke-e2e.mjs
// Env: SUPABASE_URL, SUPABASE_ANON_KEY (read from apps/backend/.env if unset), BACKEND_URL (default http://localhost:3000)
import { readFileSync } from "node:fs";

const env = { ...process.env };
try {
  for (const line of readFileSync(new URL("../apps/backend/.env", import.meta.url), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)="?([^"]*)"?\s*$/);
    if (m && !(m[1] in env)) env[m[1]] = m[2];
  }
} catch {}
const API = (env.BACKEND_URL || "http://localhost:3000") + "/api";
let failed = 0;
const step = async (name, fn) => {
  try {
    const out = await fn();
    console.log(`PASS ${name}${out ? " - " + out : ""}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name} - ${e.message}`);
  }
};

let token, candidateId;
const call = async (method, path, body) => {
  const r = await fetch(API + path, {
    method,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${text.slice(0, 160)}`);
  return text ? JSON.parse(text) : null;
};

await step("login (Supabase)", async () => {
  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: env.SUPABASE_ANON_KEY, "content-type": "application/json" },
    body: JSON.stringify({ email: env.SMOKE_EMAIL, password: env.SMOKE_PASSWORD }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(j.error_description || j.msg || "no token");
  token = j.access_token;
});

if (token) {
  const ts = Date.now();
  await step("create candidate", async () => {
    const c = await call("POST", "/candidates", {
      name: "Smoke Test Candidate",
      email: `smoke+${ts}@example.com`,
      role: "QA Engineer",
    });
    candidateId = c.id ?? c.candidate?.id;
    if (!candidateId) throw new Error("no id in response: " + JSON.stringify(c).slice(0, 120));
    return candidateId;
  });
  if (candidateId) {
    await step("invalid status rejected (400)", async () => {
      try {
        await call("PATCH", `/candidates/${candidateId}/status`, { status: "bogus" });
      } catch (e) {
        if (String(e.message).includes("400")) return;
        throw e;
      }
      throw new Error("bogus status was accepted");
    });
    await step("advance to shortlisted (multi-step)", async () => {
      await call("PATCH", `/candidates/${candidateId}/status`, { status: "shortlisted", advance: true });
    });
    await step("timeline has entries", async () => {
      const t = await call("GET", `/candidates/${candidateId}/timeline`);
      const n = Array.isArray(t) ? t.length : (t.items?.length ?? 0);
      if (n < 2) throw new Error(`only ${n} timeline entries`);
      return `${n} entries`;
    });
    await step("list contains candidate", async () => {
      const l = await call("GET", "/candidates?search=Smoke");
      const rows = Array.isArray(l) ? l : (l.items ?? l.data ?? []);
      if (!rows.some((r) => r.id === candidateId)) throw new Error("not found in list");
    });
    await step("archive (cleanup)", async () => {
      await call("PATCH", `/candidates/${candidateId}/status`, { status: "archived", advance: true });
    });
  }
}
console.log(failed ? `\n${failed} step(s) failed` : "\nAll smoke steps passed");
process.exit(failed ? 1 : 0);
