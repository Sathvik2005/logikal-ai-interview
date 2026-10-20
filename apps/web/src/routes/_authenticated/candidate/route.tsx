import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { CandidateShell } from "@/components/candidate/CandidateShell";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { EmptyState } from "@/components/shared/EmptyState";

export const Route = createFileRoute("/_authenticated/candidate")({
  beforeLoad: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["candidate", "admin"])
      .maybeSingle();
    if (!data) throw redirect({ to: "/access-denied" });
  },
  component: CandidateShell,
  pendingComponent: () => (
    <div className="p-lg">
      <LoadingState variant="detail" />
    </div>
  ),
  errorComponent: ({ error, reset }) => <ErrorState error={error} reset={reset} />,
  notFoundComponent: () => (
    <div className="p-lg">
      <EmptyState
        icon="search_off"
        title="Page not found"
        description="That candidate page doesn't exist."
        action={
          <Link to="/candidate" className="text-primary hover:underline">
            Back to Dashboard
          </Link>
        }
      />
    </div>
  ),
});
