import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { EmptyState } from "@/components/shared/EmptyState";

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
      <EmptyState
        icon={
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-error-container/40 border border-error/20 flex items-center justify-center">
              <span className="material-symbols-outlined icon-fill text-[32px] text-error">
                lock
              </span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-surface-container-lowest border border-outline-variant flex items-center justify-center">
              <span className="material-symbols-outlined text-[12px] text-on-surface-variant">
                shield
              </span>
            </div>
          </div>
        }
        title="Access Restricted"
        description={
          <div className="space-y-6">
            <p className="text-body-lg text-on-surface-variant max-w-md mx-auto">
              Your current role does not grant access to this resource. Contact your administrator
              to request elevated permissions.
            </p>

            {/* Access details */}
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg text-left w-full max-w-[480px] mx-auto space-y-3">
              <p className="text-label-caps uppercase text-on-surface-variant tracking-wider mb-2 font-semibold">
                Access Details
              </p>
              {resource && (
                <div className="flex items-center justify-between py-2 border-b border-outline-variant/40">
                  <span className="text-body-md text-on-surface-variant">Resource</span>
                  <code className="text-data-mono text-on-surface bg-surface-container px-2 py-0.5 rounded">
                    {resource}
                  </code>
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
          </div>
        }
        action={
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Link
              to="/recruiter"
              className="inline-flex items-center justify-center gap-2 bg-primary text-on-primary px-5 py-3 rounded-lg hover:brightness-110 transition text-body-md font-semibold"
            >
              <span className="material-symbols-outlined text-[18px]">dashboard</span>
              Return to Dashboard
            </Link>
            <button
              type="button"
              onClick={() => navigate({ to: "/" })}
              className="inline-flex items-center justify-center gap-2 bg-surface-container-lowest text-on-surface border border-outline-variant px-5 py-3 rounded-lg hover:bg-surface-container-low transition text-body-md font-semibold"
            >
              <span className="material-symbols-outlined text-[18px]">home</span>
              Home
            </button>
          </div>
        }
      />

      <p className="text-center text-label-caps text-on-surface-variant mt-6">
        Need help?{" "}
        <a href="mailto:admin@logikality.ai" className="text-primary hover:underline">
          Contact your administrator
        </a>
      </p>
    </div>
  );
}
