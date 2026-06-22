import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { useAuth, roleHome, type AppRole } from "@/hooks/use-auth";

const searchSchema = z.object({ mode: z.enum(["login", "signup"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Sign in — Logikality AI" }] }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">(search.mode ?? "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [signupRole, setSignupRole] = useState<AppRole>("recruiter");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && role) navigate({ to: roleHome(role) });
  }, [user, role, loading, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName, role: signupRole },
          },
        });
        if (error) throw error;
        toast.success("Account created. Welcome to Logikality AI.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in.");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) toast.error("Google sign-in failed");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-md radial-gradient-bg relative">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-secondary-container/10 rounded-full blur-3xl pointer-events-none"></div>

      <main className="w-full max-w-[440px] z-10 flex flex-col items-center">
        <div className="mb-xl text-center">
          <Link to="/" className="text-headline-lg font-headline-lg md:text-display-lg md:font-display-lg font-extrabold text-primary tracking-tight">Logikality AI</Link>
          <p className="text-body-md text-on-surface-variant mt-2">Enterprise Grade Recruitment</p>
        </div>

        <div className="glass-card w-full rounded-xl border border-outline-variant p-xl">
          <div className="flex gap-2 mb-lg p-1 bg-surface-container-low rounded-lg">
            <button onClick={() => setMode("login")} className={`flex-1 py-2 text-body-md rounded-md transition-colors ${mode === "login" ? "bg-surface-container-lowest shadow-soft text-on-surface" : "text-on-surface-variant"}`}>Sign in</button>
            <button onClick={() => setMode("signup")} className={`flex-1 py-2 text-body-md rounded-md transition-colors ${mode === "signup" ? "bg-surface-container-lowest shadow-soft text-on-surface" : "text-on-surface-variant"}`}>Create account</button>
          </div>

          <h2 className="text-headline-sm font-headline-sm text-on-surface mb-lg">{mode === "login" ? "Sign in to your account" : "Create your account"}</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-md">
            {mode === "signup" && (
              <div className="flex flex-col gap-xs">
                <label className="text-label-caps font-label-caps text-on-surface-variant uppercase">Full Name</label>
                <input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
              </div>
            )}
            <div className="flex flex-col gap-xs">
              <label className="text-label-caps font-label-caps text-on-surface-variant uppercase">Work Email</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">mail</span>
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
              </div>
            </div>
            <div className="flex flex-col gap-xs">
              <label className="text-label-caps font-label-caps text-on-surface-variant uppercase">Password</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">lock</span>
                <input required type="password" minLength={mode === "signup" ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
              </div>
              {mode === "signup" && <p className="text-xs text-outline mt-1">Must be at least 8 characters.</p>}
            </div>

            {mode === "signup" && (
              <div className="flex flex-col gap-xs">
                <label className="text-label-caps font-label-caps text-on-surface-variant uppercase">I am a</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["recruiter", "candidate"] as AppRole[]).map((r) => (
                    <button type="button" key={r} onClick={() => setSignupRole(r)} className={`py-2 rounded-lg border text-body-md capitalize transition-all ${signupRole === r ? "border-primary bg-primary/5 text-primary" : "border-outline-variant text-on-surface-variant hover:bg-surface-container-low"}`}>{r}</button>
                  ))}
                </div>
              </div>
            )}

            {mode === "login" && (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-body-md text-on-surface-variant cursor-pointer">
                  <input type="checkbox" className="h-4 w-4 rounded border-outline-variant" /> Remember me
                </label>
                <Link to="/reset-password" className="text-body-md text-primary hover:underline">Forgot password?</Link>
              </div>
            )}

            <button disabled={submitting} type="submit" className="mt-2 w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-lg bg-primary text-on-primary text-label-caps font-label-caps uppercase hover:brightness-110 shadow-soft disabled:opacity-60 transition-all">
              {submitting ? "Please wait…" : (mode === "login" ? "Sign In" : "Join Logikality AI")}
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </form>

          <div className="my-lg flex items-center gap-3">
            <hr className="flex-1 border-outline-variant" />
            <span className="text-label-caps font-label-caps text-outline uppercase">Or</span>
            <hr className="flex-1 border-outline-variant" />
          </div>

          <button onClick={handleGoogle} className="w-full flex justify-center items-center gap-3 py-2.5 px-4 bg-surface-container-lowest border border-outline-variant text-on-surface text-body-md rounded-lg hover:bg-surface-container-low transition-colors shadow-soft">
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>
        </div>

        <footer className="mt-xl flex flex-col md:flex-row items-center justify-center gap-2 text-body-md text-on-surface-variant">
          <span>© 2024 Logikality AI</span>
          <div className="flex items-center gap-3">
            <a href="#" className="hover:text-primary">Privacy</a>
            <span className="text-outline-variant">•</span>
            <a href="#" className="hover:text-primary">Terms</a>
          </div>
        </footer>
      </main>
    </div>
  );
}
