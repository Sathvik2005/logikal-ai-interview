import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, Icon } from "@/components/admin/AdminShell";
import { EmptyState } from "@/components/shared/EmptyState";
import { listOrganizations, type OrgDTO } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/organizations/")({
  component: OrgsPage,
});

function OrgsPage() {
  const fn = useServerFn(listOrganizations);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "orgs"],
    queryFn: () => fn({}),
  });
  const orgs = (data as OrgDTO[] | undefined) ?? [];

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "trial" | "suspended">("all");
  const list = orgs.filter(
    (o) =>
      (filter === "all" || o.status === filter) &&
      o.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="space-y-lg">
      <header className="flex items-end justify-between flex-wrap gap-md">
        <div>
          <h1 className="text-headline-lg font-headline-lg text-on-surface">Organizations</h1>
          <p className="text-body-lg text-on-surface-variant">
            Tenants on the platform and their activity.
          </p>
        </div>
      </header>

      <Card className="p-md">
        <div className="flex items-center gap-md flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Icon
              name="search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search organizations…"
              className="w-full pl-10 pr-4 py-2 bg-surface border border-outline-variant rounded-lg text-body-md outline-none focus:ring-2 focus:ring-primary-container"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {(["all", "active", "trial", "suspended"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-body-md capitalize ${filter === f ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <p className="p-lg text-on-surface-variant">Loading organizations…</p>
        ) : error ? (
          <p className="p-lg text-error">{(error as Error).message}</p>
        ) : list.length === 0 ? (
          <EmptyState
            icon="domain_disabled"
            title="No organizations match"
            description="Try adjusting your query or filter status."
            className="py-12"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-body-md min-w-[800px]">
              <thead className="text-left text-on-surface-variant border-b border-outline-variant">
                <tr>
                  {[
                    "Organization",
                    "Industry",
                    "Size",
                    "Candidates",
                    "Interviews",
                    "Status",
                    "",
                  ].map((h) => (
                    <th key={h} className="px-4 py-3 font-semibold text-label-caps">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {list.map((o) => (
                  <tr key={o.id} className="hover:bg-surface-container-low">
                    <td className="px-4 py-3">
                      <Link
                        to="/admin/organizations/$id"
                        params={{ id: o.id }}
                        className="text-on-surface font-semibold hover:text-primary"
                      >
                        {o.name}
                      </Link>
                      <p className="text-on-surface-variant text-label-caps">
                        Created {new Date(o.createdAt).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">{o.industry ?? "—"}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{o.size ?? "—"}</td>
                    <td className="px-4 py-3 text-on-surface-variant tabular-nums">
                      {o.candidateCount}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant tabular-nums">
                      {o.interviewCount}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-label-caps font-semibold capitalize ${
                          o.status === "active"
                            ? "bg-success-container text-on-success-container"
                            : o.status === "trial"
                              ? "bg-warning-container text-on-warning-container"
                              : o.status === "suspended"
                                ? "bg-error-container text-on-error-container"
                                : "bg-surface-container text-on-surface-variant"
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to="/admin/organizations/$id"
                        params={{ id: o.id }}
                        className="text-primary hover:underline text-body-md"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
