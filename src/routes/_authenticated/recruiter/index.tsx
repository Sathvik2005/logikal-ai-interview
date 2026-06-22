import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CardShadow, Icon, EmptyState, SkeletonCard } from "@/components/recruiter/RecruiterShell";
import { fmtDate, scoreColor } from "@/components/recruiter/mock-data";
import { useAuth } from "@/hooks/use-auth";
import {
  getRecruiterDashboard,
  type RecruiterDashboardDTO,
} from "@/lib/recruiter-dashboard.functions";

export const Route = createFileRoute("/_authenticated/recruiter/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuth();
  const fn = useServerFn(getRecruiterDashboard);
  const { data, isLoading } = useQuery({
    queryKey: ["recruiter", "dashboard"],
    queryFn: () => fn({}),
    refetchInterval: 30_000,
  });
  const dashboard = data as RecruiterDashboardDTO | undefined;
  const firstName =
    user?.user_metadata?.full_name?.toString().split(" ")[0] ??
    user?.email?.split("@")[0] ??
    "there";

  const stats = [
    {
      label: "Active Interviews",
      value: dashboard?.liveOrScheduledCount ?? 0,
      hint: "Live or scheduled this week",
      icon: "video_camera_front",
      tone: "text-primary",
    },
    {
      label: "Pipeline Candidates",
      value: dashboard?.pipelineCount ?? 0,
      hint: "Across all open roles",
      icon: "groups",
      tone: "text-secondary",
    },
    {
      label: "Hiring Recs",
      value: dashboard?.evaluatedCount ?? 0,
      hint: "Ready to review",
      icon: "lightbulb",
      tone: "text-primary-container",
    },
    {
      label: "Interviews / wk",
      value: dashboard?.interviewsThisWeek ?? 0,
      hint: "This calendar week",
      icon: "calendar_today",
      tone: "text-tertiary",
    },
  ];

  return (
    <>
      <div className="mb-lg">
        <h2 className="text-display-lg text-on-background mb-2">Welcome back, {firstName}.</h2>
        <p className="text-body-lg text-on-surface-variant">
          Here is the latest intelligence on your recruitment pipeline.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md mb-xl">
        {stats.map((s) => (
          <CardShadow key={s.label} className="p-lg flex flex-col justify-between min-h-[130px]">
            <div>
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-label-caps uppercase text-on-surface-variant">{s.label}</h3>
                <Icon name={s.icon} className={s.tone} />
              </div>
              <div className="text-headline-lg font-bold text-on-background leading-none">
                {isLoading ? "—" : s.value}
              </div>
            </div>
            <div className="text-data-mono text-on-surface-variant leading-normal mt-3 pt-2 border-t border-outline-variant/30">
              {s.hint}
            </div>
          </CardShadow>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        <div className="lg:col-span-2 space-y-lg">
          <CardShadow>
            <div className="p-lg border-b border-outline-variant flex justify-between items-center">
              <h3 className="text-headline-sm">Today's Interviews</h3>
              <Link
                to="/recruiter/scheduling"
                className="text-primary text-body-md hover:underline"
              >
                View calendar →
              </Link>
            </div>
            {isLoading ? (
              <div className="p-lg">
                <SkeletonCard />
              </div>
            ) : (dashboard?.todaysInterviews ?? []).length === 0 ? (
              <EmptyState
                icon="event_busy"
                title="No interviews scheduled for today"
                hint="Scheduled candidate sessions will appear here."
                className="py-8"
              />
            ) : (
              <ul className="divide-y divide-outline-variant">
                {dashboard!.todaysInterviews.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center justify-between p-lg hover:bg-surface-container-low transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-semibold shrink-0">
                        {i.candidateName
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{i.candidateName}</p>
                        <p className="text-body-md text-on-surface-variant truncate">
                          {i.role}
                          {i.scheduledAt ? ` • ${fmtDate(i.scheduledAt)}` : ""}
                        </p>
                      </div>
                    </div>
                    {i.status === "in_progress" ? (
                      <Link
                        to="/recruiter/monitor"
                        className="px-3 py-1.5 rounded-full bg-error text-on-error text-label-caps uppercase flex items-center gap-1 shrink-0"
                      >
                        <span className="w-2 h-2 rounded-full bg-on-error animate-pulse" />
                        LIVE
                      </Link>
                    ) : (
                      <Link
                        to="/recruiter/monitor"
                        className="px-3 py-1.5 rounded-full bg-surface-container text-on-surface text-label-caps uppercase shrink-0"
                      >
                        {i.status.replace(/_/g, " ")}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardShadow>
        </div>

        <div className="space-y-lg">
          <CardShadow>
            <div className="p-lg border-b border-outline-variant">
              <h3 className="text-headline-sm">Top Candidates</h3>
            </div>
            {isLoading ? (
              <div className="p-lg">
                <SkeletonCard />
              </div>
            ) : (dashboard?.topCandidates ?? []).length === 0 ? (
              <EmptyState
                icon="person_search"
                title="No scored candidates yet"
                hint="Candidate profiles with AI reports will be listed here."
                className="py-8"
              />
            ) : (
              <ul className="divide-y divide-outline-variant">
                {dashboard!.topCandidates.map((c) => (
                  <li key={c.id}>
                    <Link
                      to="/recruiter/candidates/$id"
                      params={{ id: c.id }}
                      className="flex items-center justify-between p-md hover:bg-surface-container-low"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center font-semibold shrink-0">
                          {c.avatar}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-body-md truncate">{c.name}</p>
                          <p className="text-label-caps uppercase text-on-surface-variant truncate">
                            {c.role}
                          </p>
                        </div>
                      </div>
                      <span className={`text-data-mono font-bold shrink-0 ${scoreColor(c.score)}`}>
                        {c.score || "—"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardShadow>

          <CardShadow>
            <div className="p-lg border-b border-outline-variant">
              <h3 className="text-headline-sm">Quick Actions</h3>
            </div>
            <div className="p-lg grid grid-cols-2 gap-2">
              {[
                { to: "/recruiter/jobs/new", label: "New JD", icon: "post_add" },
                { to: "/recruiter/personas/new", label: "New Persona", icon: "psychology" },
                { to: "/recruiter/scheduling", label: "Schedule", icon: "calendar_today" },
                { to: "/recruiter/candidates", label: "Candidates", icon: "groups" },
              ].map((a) => (
                <Link
                  key={a.to}
                  to={a.to}
                  className="flex flex-col items-center gap-1 p-3 rounded-lg border border-outline-variant hover:bg-surface-container-low transition"
                >
                  <Icon name={a.icon} className="text-primary" />
                  <span className="text-label-caps">{a.label}</span>
                </Link>
              ))}
            </div>
          </CardShadow>
        </div>
      </div>
    </>
  );
}
