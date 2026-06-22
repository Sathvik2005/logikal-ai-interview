import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
  resource: z.string().optional(),
  requiredRole: z.string().optional(),
  currentRole: z.string().optional(),
});

export const Route = createFileRoute("/access-denied")({
  head: () => ({ meta: [{ title: "Access Denied — Logikality AI" }] }),
  validateSearch: searchSchema,
  component: AccessDenied,
});

function AccessDenied() {
  const navigate = useNavigate();
  const { resource, requiredRole, currentRole } = Route.useSearch();

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col items-center justify-center p-lg">
      <div className="w-full max-w-[560px]">
        {/* Icon */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-error-container/40 border border-error/20 flex items-center justify-center">
              <span className="material-symbols-outlined icon-fill text-[48px] text-error">lock</span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-surface-container-lowest border border-outline-variant flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">shield</span>
            </div>
          </div>
        </div>

        {/* Heading */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-error-container text-on-error-container text-label-caps border border-error/20 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-error inline-block" />
            Access Restricted
          </div>
          <h1 className="text-headline-lg font-bold text-on-surface mb-3">
            You don't have permission to view this page
          </h1>
          <p className="text-body-lg text-on-surface-variant">
            Your current role does not grant access to this resource. Contact your administrator to request elevated permissions.
          </p>
        </div>

        {/* Role info */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg mb-6 space-y-3">
          <p className="text-label-caps uppercase text-on-surface-variant tracking-wider mb-3">Access Details</p>
          {resource && (
            <div className="flex items-center justify-between py-2 border-b border-outline-variant/40">
              <span className="text-body-md text-on-surface-variant">Resource</span>
              <code className="text-data-mono text-on-surface bg-surface-container px-2 py-0.5 rounded">{resource}</code>
            </div>
          )}
          <div className="flex items-center justify-between py-2 border-b border-outline-variant/40">
            <span className="text-body-md text-on-surface-variant">Your Role</span>
            <span className="px-2.5 py-1 rounded-full text-label-caps bg-surface-container text-on-surface border border-outline-variant">
              {currentRole ?? "Standard User"}
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-body-md text-on-surface-variant">Required Role</span>
            <span className="px-2.5 py-1 rounded-full text-label-caps bg-primary-container text-on-primary-container border border-primary/20">
              {requiredRole ?? "Admin"}
            </span>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/recruiter"
            className="flex-1 inline-flex items-center justify-center gap-2 bg-primary text-on-primary px-5 py-3 rounded-lg hover:brightness-110 transition text-body-md font-medium"
          >
            <span className="material-symbols-outlined text-[18px]">dashboard</span>
            Return to Dashboard
          </Link>
          <button
            type="button"
            onClick={() => navigate({ to: "/" })}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-surface-container-lowest text-on-surface border border-outline-variant px-5 py-3 rounded-lg hover:bg-surface-container-low transition text-body-md"
          >
            <span className="material-symbols-outlined text-[18px]">home</span>
            Home
          </button>
        </div>

        <p className="text-center text-label-caps text-on-surface-variant mt-6">
          Need help?{" "}
          <a href="mailto:admin@logikality.ai" className="text-primary hover:underline">
            Contact your administrator
          </a>
        </p>
      </div>
    </div>
  );
}
