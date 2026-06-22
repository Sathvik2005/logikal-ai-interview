import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, Icon } from "@/components/admin/AdminShell";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { getOrganization } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/organizations/$id")({
  component: OrgDetails,
  errorComponent: ({ error, reset }) => <ErrorState error={error} reset={reset} />,
  notFoundComponent: () => (
    <EmptyState
      icon="domain_disabled"
      title="Organization not found"
      description="This organization may have been removed or you don't have access."
      action={
        <Link to="/admin/organizations" className="text-primary hover:underline">
          ← Back to organizations
        </Link>
      }
    />
  ),
});

type OrgDetailDTO = {
  id: string;
  name: string;
  industry: string | null;
  size: string | null;
  status: string;
  createdAt: string;
  candidateCount: number;
  interviewCount: number;
  userCount: number;
};

function OrgDetails() {
  const { id } = Route.useParams();
  const fn = useServerFn(getOrganization);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "org", id],
    queryFn: () => fn({ data: { id } }),
  });
  const org = data as OrgDetailDTO | undefined;

  if (isLoading) return <p className="p-lg text-on-surface-variant">Loading organization…</p>;
  if (error) return <p className="p-lg text-error">{(error as Error).message}</p>;
  if (!org) return null;

  return (
    <div className="space-y-lg">
      <Link to="/admin/organizations" className="text-body-md text-primary hover:underline">
        ← All organizations
      </Link>

      <Card className="p-lg">
        <div className="flex items-start justify-between flex-wrap gap-md">
          <div className="flex items-center gap-md">
            <div className="w-16 h-16 rounded-xl bg-primary text-on-primary flex items-center justify-center text-headline-md font-bold">
              {org.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-headline-lg font-headline-lg text-on-surface">{org.name}</h1>
              <p className="text-body-md text-on-surface-variant">
                {org.industry ?? "—"}
                {org.size ? ` · ${org.size}` : ""}
              </p>
              <div className="mt-2 flex gap-2">
                <span
                  className={`px-2 py-1 rounded-full text-label-caps font-semibold capitalize ${
                    org.status === "active"
                      ? "bg-success-container text-on-success-container"
                      : org.status === "trial"
                        ? "bg-warning-container text-on-warning-container"
                        : org.status === "suspended"
                          ? "bg-error-container text-on-error-container"
                          : "bg-surface-container text-on-surface-variant"
                  }`}
                >
                  {org.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-3 gap-md">
        {[
          { label: "Users", value: org.userCount, icon: "groups" },
          { label: "Candidates", value: org.candidateCount, icon: "person_search" },
          { label: "Interviews", value: org.interviewCount, icon: "videocam" },
        ].map((k) => (
          <Card key={k.label} className="p-md">
            <div className="flex items-center justify-between">
              <span className="text-body-md text-on-surface-variant">{k.label}</span>
              <Icon name={k.icon} className="text-primary" />
            </div>
            <p className="text-headline-md font-headline-md mt-2 text-on-surface tabular-nums">
              {k.value}
            </p>
          </Card>
        ))}
      </div>

      <Card className="p-lg">
        <h3 className="text-headline-sm font-headline-sm text-on-surface mb-md">Metadata</h3>
        <dl className="grid grid-cols-2 gap-4 text-body-md">
          <div>
            <dt className="text-on-surface-variant">Created</dt>
            <dd>{new Date(org.createdAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-on-surface-variant">Org ID</dt>
            <dd className="font-mono text-label-caps break-all">{org.id}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
