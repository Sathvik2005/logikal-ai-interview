import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, Icon } from "@/components/admin/AdminShell";
import { getAdminDashboard, type AdminDashboardDTO } from "@/lib/admin.functions";
import { listAuditEvents } from "@/lib/governance.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminControlCenter,
});

type AuditRow = { id: string; actor_id: string | null; entity_type: string; entity_id: string; action: string; created_at: string };

function AdminControlCenter() {
  const dashFn = useServerFn(getAdminDashboard);
  const auditFn = useServerFn(listAuditEvents);
  const dashQ = useQuery({ queryKey: ["admin", "dashboard"], queryFn: () => dashFn({}), refetchInterval: 60_000 });
  const auditQ = useQuery({ queryKey: ["admin", "audit", "recent"], queryFn: () => auditFn({ data: { limit: 6 } }) });
  const d = dashQ.data as AdminDashboardDTO | undefined;
  const audit = (auditQ.data as AuditRow[] | undefined) ?? [];
  const max = Math.max(1, ...(d?.trend ?? []).map((x) => x.count));

  return (
    <div className="space-y-lg">
      <header className="flex items-end justify-between flex-wrap gap-md">
        <div>
          <h1 className="text-headline-lg font-headline-lg text-on-surface">Admin Control Center</h1>
          <p className="text-body-lg text-on-surface-variant">Platform-wide health, usage and admin activity.</p>
        </div>
        <Link to="/admin/organizations" className="bg-primary text-on-primary px-4 py-2.5 rounded-lg text-body-md font-semibold hover:brightness-110 transition flex items-center gap-2">
          <Icon name="domain" /> Manage organizations
        </Link>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
        {[
          { label: "Organizations", value: d?.orgCount ?? "—", icon: "domain" },
          { label: "Candidates", value: d?.candidateCount ?? "—", icon: "groups" },
          { label: "Interviews / mo", value: d?.interviewsThisMonth ?? "—", icon: "videocam" },
          { label: "Errors (24h)", value: d?.errorCount24h ?? "—", icon: "report" },
        ].map((k) => (
          <Card key={k.label} className="p-md">
            <div className="flex items-center justify-between">
              <span className="text-body-md text-on-surface-variant">{k.label}</span>
              <Icon name={k.icon} className="text-primary" />
            </div>
            <p className="text-headline-md font-headline-md mt-2 text-on-surface">{k.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-lg">
        <Card className="lg:col-span-2 p-lg">
          <div className="flex items-center justify-between mb-md">
            <h2 className="text-headline-sm font-headline-sm text-on-surface">Interview volume — last 7 days</h2>
            <span className="text-body-md text-on-surface-variant">{(d?.trend ?? []).reduce((a, b) => a + b.count, 0)} total</span>
          </div>
          <div className="flex items-end gap-3 h-48">
            {(d?.trend ?? []).map((day) => (
              <div key={day.day} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-primary-container rounded-t-lg relative" style={{ height: `${(day.count / max) * 100}%` }}>
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-label-caps text-on-surface-variant">{day.count}</span>
                </div>
                <span className="text-label-caps text-on-surface-variant">{day.day}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-lg">
          <div className="flex items-center justify-between mb-md">
            <h3 className="text-headline-sm font-headline-sm text-on-surface">System health</h3>
            <Link to="/admin/security" className="text-body-md text-primary hover:underline">View security →</Link>
          </div>
          <div className="space-y-3">
            <Row label="Errors (24h)" value={d?.errorCount24h ?? "—"} />
            <Row label="Org count" value={d?.orgCount ?? "—"} />
            <Row label="Candidates" value={d?.candidateCount ?? "—"} />
            <Row label="Interviews / mo" value={d?.interviewsThisMonth ?? "—"} />
          </div>
        </Card>
      </div>

      <Card className="p-lg">
        <div className="flex items-center justify-between mb-md">
          <h3 className="text-headline-sm font-headline-sm text-on-surface">Recent admin activity</h3>
          <Link to="/admin/security" className="text-body-md text-primary hover:underline">Full audit log →</Link>
        </div>
        {audit.length === 0 ? (
          <p className="text-body-md text-on-surface-variant">No audit events yet.</p>
        ) : (
          <ul className="space-y-3">
            {audit.map((a) => (
              <li key={a.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
                  <Icon name="bolt" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-body-md text-on-surface truncate">
                    <span className="font-semibold">{a.action}</span> on <span className="text-on-surface-variant">{a.entity_type}</span>
                  </p>
                  <p className="text-label-caps text-on-surface-variant">{new Date(a.created_at).toLocaleString()}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-body-md text-on-surface">{label}</span>
      <span className="text-body-md text-on-surface-variant tabular-nums">{value}</span>
    </div>
  );
}
