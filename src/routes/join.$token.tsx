import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { validateInvitationToken, claimInvitation, type InvitationLookup } from "@/lib/invitations.functions";

export const Route = createFileRoute("/join/$token")({
  ssr: false,
  validateSearch: z.object({}).optional(),
  component: JoinPage,
});

function JoinPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const validate = useServerFn(validateInvitationToken);
  const claim = useServerFn(claimInvitation);

  const [lookup, setLookup] = useState<InvitationLookup | null | "missing">(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        localStorage.setItem("pending_invite_token", token);
      } catch {/* ignore */}
      const [res, sess] = await Promise.all([
        validate({ data: { token } as never }).catch(() => null),
        supabase.auth.getUser(),
      ]);
      setLookup(res ?? "missing");
      setSignedIn(!!sess.data.user);
    })();
  }, [token, validate]);

  async function doClaim() {
    setBusy(true);
    setErr(null);
    try {
      const { interviewId } = await claim({ data: { token } as never });
      try {
        localStorage.removeItem("pending_invite_token");
      } catch {/* ignore */}
      navigate({ to: "/candidate/prepare", search: { interviewId } as never });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not join interview");
    } finally {
      setBusy(false);
    }
  }

  if (lookup === null || signedIn === null) {
    return <Centered title="Loading your invitation…" />;
  }
  if (lookup === "missing") {
    return (
      <Centered
        title="Invitation not found"
        body="This link is invalid or has been revoked. Please contact your recruiter."
      />
    );
  }

  const iv = lookup.interview;
  const when = iv.scheduledAt
    ? new Date(iv.scheduledAt).toLocaleString(undefined, {
        dateStyle: "full",
        timeStyle: "short",
      })
    : "Flexible — start anytime";

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full p-8 space-y-6">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-indigo-100 text-indigo-700 text-2xl mb-2">
            🎤
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">You're invited to an AI Interview</h1>
          <p className="text-slate-600">For: <span className="font-medium text-slate-900">{iv.role}</span></p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Tile label="Candidate" value={iv.candidateName} />
          <Tile label="Interviewer" value={iv.personaName} />
          <Tile label="When" value={when} className="col-span-2" />
          <Tile label="Duration" value={`${iv.durationMinutes} minutes`} />
          <Tile label="Status" value={iv.status} />
        </div>

        {lookup.windowState === "cancelled" && (
          <Banner tone="error">This interview was cancelled. Please reach out to your recruiter.</Banner>
        )}
        {lookup.windowState === "closed" && (
          <Banner tone="error">The interview window has closed. Please contact your recruiter to reschedule.</Banner>
        )}
        {lookup.windowState === "too_early" && iv.scheduledAt && (
          <Countdown to={iv.scheduledAt} />
        )}

        {err && <Banner tone="error">{err}</Banner>}

        <div className="pt-2">
          {!signedIn ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 text-center">
                Sign in with <span className="font-medium">{lookup.email}</span> to join your interview.
              </p>
              <div className="flex flex-col gap-2">
                <Link
                  to="/auth"
                  search={{ mode: "signup" } as never}
                  className="w-full text-center px-4 py-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
                >
                  Create account
                </Link>
                <Link
                  to="/auth"
                  search={{ mode: "login" } as never}
                  className="w-full text-center px-4 py-3 rounded-lg border border-slate-300 text-slate-900 font-semibold hover:bg-slate-50"
                >
                  Sign in
                </Link>
              </div>
              <p className="text-xs text-slate-500 text-center">
                After signing in we'll bring you back here automatically.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={doClaim}
              disabled={busy || lookup.windowState === "cancelled" || lookup.windowState === "closed"}
              className="w-full px-4 py-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? "Joining…" : lookup.windowState === "too_early" ? "Reserve my spot" : "Join interview"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`bg-slate-50 rounded-lg p-3 ${className}`}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-900 mt-0.5">{value}</p>
    </div>
  );
}

function Banner({ tone, children }: { tone: "error" | "info"; children: React.ReactNode }) {
  const cls =
    tone === "error" ? "bg-red-50 text-red-800 border-red-200" : "bg-blue-50 text-blue-800 border-blue-200";
  return <div className={`rounded-lg border px-3 py-2 text-sm ${cls}`}>{children}</div>;
}

function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const diff = Math.max(0, new Date(to).getTime() - now);
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2 text-sm text-center">
      Interview opens in <span className="font-semibold tabular-nums">{d}d {h}h {m}m {s}s</span>
    </div>
  );
}

function Centered({ title, body }: { title: string; body?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white rounded-2xl shadow border border-slate-200 max-w-md w-full p-8 text-center space-y-3">
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {body && <p className="text-slate-600">{body}</p>}
      </div>
    </div>
  );
}
