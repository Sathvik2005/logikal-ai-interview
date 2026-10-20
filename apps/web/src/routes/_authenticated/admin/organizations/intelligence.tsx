import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, Icon } from "@/components/admin/AdminShell";
import { EmptyState } from "@/components/shared/EmptyState";
import { listOrganizations, type OrgDTO } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/organizations/intelligence")({
  component: OrgIntelligence,
});

function OrgIntelligence() {
  const fn = useServerFn(listOrganizations);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "orgs"], queryFn: () => fn({}) });
  const orgs = (data as OrgDTO[] | undefined) ?? [];
  const top = [...orgs].sort((a, b) => b.interviewCount - a.interviewCount).slice(0, 8);
  const topCands = [...orgs].sort((a, b) => b.candidateCount - a.candidateCount).slice(0, 8);
  const totalInterviews = orgs.reduce((a, o) => a + o.interviewCount, 0) || 1;

  return (
    <div className="space-y-lg">
      <header className="flex items-end justify-between flex-wrap gap-md">
        <div>
          <h1 className="text-headline-lg font-headline-lg text-on-surface">
            Organization Intelligence
          </h1>
          <p className="text-body-lg text-on-surface-variant">Cross-tenant usage patterns.</p>
        </div>
        <Link to="/admin/organizations" className="text-body-md text-primary hover:underline">
          ← Back to organizations
        </Link>
      </header>

      {isLoading ? (
        <p className="text-on-surface-variant">Loading…</p>
      ) : orgs.length === 0 ? (
        <Card className="p-0 overflow-hidden">
          <EmptyState
            icon="domain_disabled"
            title="No organizations yet"
            description="Organizations will show up here once they are registered."
            className="py-12"
          />
        </Card>
      ) : (
        <div className="grid lg:grid-cols-2 gap-lg">
          <Card className="p-lg">
            <div className="flex items-center justify-between mb-md">
              <h3 className="text-headline-sm font-headline-sm text-on-surface">
                Top orgs by interview volume
              </h3>
              <Icon name="trending_up" className="text-primary" />
            </div>
            <div className="space-y-2">
              {top.map((o, i) => (
                <Link
                  key={o.id}
                  to="/admin/organizations/$id"
                  params={{ id: o.id }}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-container-low border border-outline-variant"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container font-semibold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-body-md font-semibold text-on-surface truncate">
                        {o.name}
                      </p>
                      <p className="text-body-md text-on-surface-variant truncate">
                        {o.industry ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-headline-sm font-headline-sm text-on-surface tabular-nums">
                      {o.interviewCount}
                    </p>
                    <p className="text-label-caps text-on-surface-variant">interviews</p>
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          <Card className="p-lg">
            <div className="flex items-center justify-between mb-md">
              <h3 className="text-headline-sm font-headline-sm text-on-surface">
                Top orgs by candidate volume
              </h3>
              <Icon name="groups" className="text-primary" />
            </div>
            <div className="space-y-2">
              {topCands.map((o, i) => (
                <Link
                  key={o.id}
                  to="/admin/organizations/$id"
                  params={{ id: o.id }}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-container-low border border-outline-variant"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container font-semibold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-body-md font-semibold text-on-surface truncate">
                        {o.name}
                      </p>
                      <p className="text-body-md text-on-surface-variant truncate">
                        {o.industry ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-headline-sm font-headline-sm text-on-surface tabular-nums">
                      {o.candidateCount}
                    </p>
                    <p className="text-label-caps text-on-surface-variant">candidates</p>
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          <Card className="p-lg lg:col-span-2">
            <h3 className="text-headline-sm font-headline-sm text-on-surface mb-md">
              Interview share
            </h3>
            <div className="space-y-3">
              {top.map((o) => {
                const pct = Math.round((o.interviewCount / totalInterviews) * 100);
                return (
                  <div key={o.id}>
                    <div className="flex justify-between text-body-md mb-1">
                      <span className="text-on-surface">{o.name}</span>
                      <span className="text-on-surface-variant">{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-container overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
