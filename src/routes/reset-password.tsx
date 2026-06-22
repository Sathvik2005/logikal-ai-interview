import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset Password — Logikality AI" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (error) toast.error(error.message);
    else { setSent(true); toast.success("Reset link sent."); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-md bg-background">
      <div className="w-full max-w-[440px] bg-surface-container-lowest rounded-xl border border-outline-variant/40 shadow-soft p-xl">
        <div className="mb-lg text-center">
          <h1 className="text-headline-lg font-headline-lg text-on-surface mb-2">Logikality AI</h1>
          <h2 className="text-headline-sm font-headline-sm text-on-surface-variant">Reset Password</h2>
          <p className="text-body-md text-on-surface-variant/80 mt-1">Enter your work email to receive a reset link.</p>
        </div>
        {sent ? (
          <p className="text-body-md text-on-surface text-center p-md bg-surface-container-low rounded-lg">Check your inbox for a password reset link.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-md">
            <div>
              <label className="block text-label-caps font-label-caps text-on-surface-variant mb-2 uppercase">Work Email</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">mail</span>
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="w-full bg-surface-container-lowest border border-outline-variant/60 rounded-lg py-2.5 pl-10 pr-3 text-body-md text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
              </div>
            </div>
            <button disabled={submitting} type="submit" className="w-full bg-primary text-on-primary rounded-lg py-3 text-body-md font-semibold hover:brightness-110 shadow-soft disabled:opacity-60 transition-all">
              {submitting ? "Sending…" : "Send Reset Link"}
            </button>
          </form>
        )}
        <div className="mt-lg text-center">
          <Link to="/auth" className="inline-flex items-center gap-2 text-body-md text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
