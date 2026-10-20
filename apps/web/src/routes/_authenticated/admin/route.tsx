import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { EmptyState } from "@/components/shared/EmptyState";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw redirect({ to: "/access-denied" });
  },
  component: AdminShell,
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
        description="That admin page doesn't exist."
        action={
          <Link to="/admin" className="text-primary hover:underline">
            Back to Control Center
          </Link>
        }
      />
    </div>
  ),
});
