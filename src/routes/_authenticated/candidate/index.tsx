import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, Icon } from "@/components/candidate/CandidateShell";
import { getMyUpcomingInterviews, type CandidateInterviewSummary } from "@/lib/candidate-self.functions";
import { claimInvitation } from "@/lib/invitations.functions";

export const Route = createFileRoute("/_authenticated/candidate/")({
  component: CandidateDashboard,
});

function isJoinable(s: CandidateInterviewSummary): boolean {
  if (!s.scheduledAt) return true;
  const start = new Date(s.scheduledAt).getTime();
  const end = start + s.durationMinutes * 60_000;
  const now = Date.now();
  return now >= start - 10 * 60_000 && now <= end + 30 * 60_000;
}

function CandidateDashboard() {
  const navigate = useNavigate();
  const fetchList = useServerFn(getMyUpcomingInterviews);
  const claim = useServerFn(claimInvitation);
  const [claiming, setClaiming] = useState(false);
  const [claimErr, setClaimErr] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["candidate-upcoming"],
    queryFn: () => fetchList(),
    refetchInterval: 30_000,
  });

  // Auto-claim pending invite stashed by /join/$token before sign-in
  useEffect(() => {
    const pending = typeof window !== "undefined" ? localStorage.getItem("pending_invite_token") : null;
    if (!pending || claiming) return;
    setClaiming(true);
    void claim({ data: { token: pending } as never })
      .then(({ interviewId }) => {
        localStorage.removeItem("pending_invite_token");
        list.refetch();
        navigate({ to: "/candidate/prepare", search: { interviewId } as never });
      })
      .catch((e) => {
        setClaimErr(e instanceof Error ? e.message : "Could not link your invitation");
        localStorage.removeItem("pending_invite_token");
      })
      .finally(() => setClaiming(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upcoming = list.data?.upcoming ?? [];
  const past = list.data?.past ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-lg">
      <header>
        <h1 className="text-headline-lg font-headline-lg text-on-surface">My Interviews</h1>
        <p className="text-body-lg text-on-surface-variant mt-1">
          Your upcoming AI interviews appear here. Join opens 10 minutes before the scheduled time.
        </p>
      </header>

      {claimErr && (
        <Card className="p-md border-error/30 bg-error-container/30">
          <p className="text-body-md text-on-error-container">{claimErr}</p>
        </Card>
      )}

      <section className="space-y-md">
        <h2 className="text-title-lg font-semibold text-on-surface">Upcoming</h2>
        {list.isLoading && <Card className="p-lg text-on-surface-variant">Loading…</Card>}
        {!list.isLoading && upcoming.length === 0 && (
          <Card className="p-lg text-center">
            <Icon name="event_busy" className="text-3xl text-on-surface-variant" />
            <p className="mt-2 text-body-md text-on-surface-variant">No upcoming interviews.</p>
            <p className="text-body-sm text-on-surface-variant">
              You'll get an email with a join link when one is scheduled.
            </p>
          </Card>
        )}
        {upcoming.map((iv) => (
          <UpcomingRow key={iv.id} iv={iv} />
        ))}
      </section>

      {past.length > 0 && (
        <section className="space-y-md">
          <h2 className="text-title-lg font-semibold text-on-surface">Past</h2>
          {past.map((iv) => (
            <Card key={iv.id} className="p-md flex items-center justify-between">
              <div>
                <p className="font-semibold text-on-surface">{iv.role}</p>
                <p className="text-body-sm text-on-surface-variant">
                  {iv.scheduledAt ? new Date(iv.scheduledAt).toLocaleString() : "—"} · {iv.status}
                </p>
              </div>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}

function UpcomingRow({ iv }: { iv: CandidateInterviewSummary }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const joinable = isJoinable(iv);
  const when = iv.scheduledAt ? new Date(iv.scheduledAt) : null;
  const diff = when ? when.getTime() - Date.now() : 0;
  const countdown =
    when && diff > 0
      ? `${Math.floor(diff / 86_400_000)}d ${Math.floor((diff % 86_400_000) / 3_600_000)}h ${Math.floor((diff % 3_600_000) / 60_000)}m`
      : null;

  return (
    <Card className="p-md flex flex-wrap items-center justify-between gap-md">
      <div>
        <p className="font-semibold text-on-surface">{iv.role}</p>
        <p className="text-body-sm text-on-surface-variant">
          {when ? when.toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" }) : "Flexible start"} · {iv.durationMinutes}{" "}
          min · {iv.personaName}
        </p>
        {countdown && (
          <p className="text-body-sm text-primary mt-1">Starts in {countdown}</p>
        )}
      </div>
      <div className="flex gap-2">
        <Link
          to="/candidate/prepare"
          search={{ interviewId: iv.id } as never}
          className="px-4 py-2 rounded-lg border border-outline-variant text-on-surface text-body-md hover:bg-surface-container-low"
        >
          Review prep
        </Link>
        <Link
          to="/candidate/interview"
          search={{ interviewId: iv.id } as never}
          disabled={!joinable}
          className={`px-4 py-2 rounded-lg font-semibold text-body-md flex items-center gap-2 ${
            joinable ? "bg-primary text-on-primary hover:brightness-110" : "bg-surface-container-high text-on-surface-variant pointer-events-none"
          }`}
        >
          {joinable ? "Join interview" : "Not open yet"} <Icon name="arrow_forward" />
        </Link>
      </div>
    </Card>
  );
}
