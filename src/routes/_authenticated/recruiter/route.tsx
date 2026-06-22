import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { RecruiterShell } from "@/components/recruiter/RecruiterShell";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { EmptyState } from "@/components/shared/EmptyState";

export const Route = createFileRoute("/_authenticated/recruiter")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["recruiter", "admin"])
      .maybeSingle();
    if (!data) throw redirect({ to: "/access-denied" });
  },
  component: RecruiterShell,
  pendingComponent: () => <div className="p-lg"><LoadingState variant="detail" /></div>,
  errorComponent: ({ error, reset }) => <ErrorState error={error} reset={reset} />,
  notFoundComponent: () => (
    <div className="p-lg">
      <EmptyState
        icon="search_off"
        title="Page not found"
        description="That recruiter page doesn't exist."
        action={<Link to="/recruiter" className="text-primary hover:underline">Back to Dashboard</Link>}
      />
    </div>
  ),
});
