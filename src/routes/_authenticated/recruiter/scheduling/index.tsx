import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CardShadow, Icon } from "@/components/recruiter/RecruiterShell";
import { fmtDate, type Interview } from "@/components/recruiter/mock-data";
import { ScheduleInterviewWizard } from "@/components/recruiter/ScheduleInterviewWizard";
import { WeekCalendar } from "@/components/recruiter/WeekCalendar";
import {
  useInterviewsQuery,
  useScheduleInterview,
  useRescheduleInterview,
  useCancelInterview,
} from "@/components/recruiter/use-interviews";
import type { InterviewDTO } from "@/lib/interviews.functions";
import { listNotifications } from "@/lib/candidates.functions";
import { getInvitationLink, resendInterviewInvitation } from "@/lib/invitations.functions";


export const Route = createFileRoute("/_authenticated/recruiter/scheduling/")({
  component: SchedulingHub,
});

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const KIND_LABELS: Record<string, string> = {
  interview_invite: "Interview invite",
  reschedule: "Reschedule notice",
  cancel: "Cancellation",
  reminder: "Reminder",
  candidate_welcome: "Candidate welcome",
};
const kindLabel = (k: string) => KIND_LABELS[k] ?? k;

const ACTIVITY_ICON = {
  created: { name: "event_available", cls: "bg-secondary-container text-on-secondary-container" },
  rescheduled: { name: "swap_horiz", cls: "bg-primary-fixed text-primary" },
  cancelled: { name: "event_busy", cls: "bg-error-container text-on-error-container" },
  email: { name: "mail", cls: "bg-tertiary-container text-on-tertiary-container" },
  joined: { name: "videocam", cls: "bg-tertiary-container text-on-tertiary-container" },
} as const;
type ActivityKind = keyof typeof ACTIVITY_ICON;
type ActivityEntry = { id: string; kind: ActivityKind; message: string; at: string };

const UI_STATUS: Record<InterviewDTO["status"], Interview["status"]> = {
  scheduled: "scheduled",
  in_progress: "live",
  completed: "completed",
  cancelled: "cancelled",
  no_show: "cancelled",
  evaluation_pending: "completed",
};

function toMockInterview(d: InterviewDTO): Interview {
  return {
    id: d.id,
    candidateId: d.candidateId,
    candidateName: d.candidateName || "Candidate",
    role: "",
    scheduledAt: d.scheduledAt ?? new Date().toISOString(),
    durationMin: d.durationMinutes,
    persona: d.personaId ? "AI Interviewer" : "AI Interviewer",
    status: UI_STATUS[d.status],
  };
}

function SchedulingHub() {
  const { data: dtos, isLoading } = useInterviewsQuery();
  const scheduleMut = useScheduleInterview();
  const rescheduleMut = useRescheduleInterview();
  const cancelMut = useCancelInterview();

  const interviews: Interview[] = useMemo(() => (dtos ?? []).map(toMockInterview), [dtos]);
  const dtoById = useMemo(() => new Map((dtos ?? []).map((d) => [d.id, d])), [dtos]);

  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const logActivity = (kind: ActivityKind, message: string) =>
    setActivity((a) => [
      { id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, kind, message, at: new Date().toISOString() },
      ...a,
    ].slice(0, 30));

  const [wizardOpen, setWizardOpen] = useState(false);
  const [prefill, setPrefill] = useState<{ date?: string; time?: string } | undefined>();
  const [showMail, setShowMail] = useState(false);
  const notificationsFn = useServerFn(listNotifications);
  const getLinkFn = useServerFn(getInvitationLink);
  const resendFn = useServerFn(resendInterviewInvitation);
  const { data: mail = [] } = useQuery({
    queryKey: ["notifications", "list", 20],
    queryFn: () => notificationsFn({ data: { limit: 20 } }),
    refetchInterval: 15_000,
  });

  const joinUrlFor = (token: string) =>
    `${typeof window !== "undefined" ? window.location.origin : ""}/join/${token}`;

  const handleCopyLink = async (id: string, name: string) => {
    try {
      const { token } = await getLinkFn({ data: { interviewId: id } as never });
      await navigator.clipboard.writeText(joinUrlFor(token));
      logActivity("email", `Copied join link for ${name}`);
      toast.success("Join link copied to clipboard");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not get join link");
    }
  };

  const handleResend = async (id: string, name: string, email?: string) => {
    try {
      await resendFn({ data: { interviewId: id } as never });
      logActivity("email", `Invite resent to ${email ?? name}`);
      toast.success("Invitation resent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not resend invitation");
    }
  };

  const upcoming = useMemo(
    () => interviews.filter((i) => i.status === "scheduled" || i.status === "live").sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
    [interviews],
  );
  const past = interviews.filter((i) => i.status === "completed");

  const handleReschedule = async (id: string, newISO: string) => {
    const dto = dtoById.get(id);
    try {
      await rescheduleMut.mutateAsync({ id, scheduledAt: newISO });
      const email = dto?.candidateEmail ?? "candidate@example.com";
      logActivity("rescheduled", `Rescheduled ${dto?.candidateName ?? "interview"} to ${new Date(newISO).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`);
      logActivity("email", `Reschedule notice queued for ${email}`);
      toast.success("Interview rescheduled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reschedule");
    }
  };

  const handleCancel = async (id: string) => {
    const dto = dtoById.get(id);
    try {
      await cancelMut.mutateAsync({ id });
      const email = dto?.candidateEmail ?? "candidate@example.com";
      logActivity("cancelled", `Cancelled ${dto?.candidateName ?? "interview"}`);
      logActivity("email", `Cancellation queued for ${email}`);
      toast.success("Interview cancelled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel");
    }
  };


  return (
    <>
      <div className="mb-lg grid grid-cols-[minmax(0,1fr)_auto] items-center gap-md sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-headline-lg">Interview Scheduling Hub</h2>
          <p className="text-body-lg text-on-surface-variant">Drag to reschedule. Click an empty slot to create.</p>
        </div>
        <button
          type="button"
          onClick={() => { setPrefill(undefined); setWizardOpen(true); }}
          className="px-4 py-2 bg-primary text-on-primary rounded-lg flex items-center gap-2 hover:brightness-110"
        >
          <Icon name="add" />Schedule Interview
        </button>
      </div>

      <ScheduleInterviewWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        prefill={prefill}
        onScheduled={async (i, candEmail) => {
          try {
            await scheduleMut.mutateAsync({
              candidateId: i.candidateId,
              jobId: i.jobId ?? null,
              personaId: i.personaId ?? null,
              scheduledAt: i.scheduledAt,
              durationMinutes: i.durationMin,
              questionIds: i.questionIds,
              customQuestions: i.customQuestions,
            });
            logActivity("created", `Scheduled ${i.candidateName}`);
            logActivity("email", `Invite queued for ${candEmail}`);

            toast.success("Interview scheduled");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not schedule");
          }
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-lg">
        <div className="space-y-lg">
          <CardShadow className="overflow-hidden">
            {isLoading ? (
              <div className="p-lg text-body-md text-on-surface-variant">Loading calendar…</div>
            ) : (
              <WeekCalendar
                interviews={interviews}
                onReschedule={handleReschedule}
                onAction={(action, i) => {
                  if (action === "cancel") handleCancel(i.id);
                }}
                onCreateAt={(date, time) => {
                  setPrefill({ date, time });
                  setWizardOpen(true);
                }}
              />
            )}
          </CardShadow>

          <CardShadow>
            <div className="p-lg border-b border-outline-variant"><h3 className="text-headline-sm">Past interviews</h3></div>
            <ul className="divide-y divide-outline-variant">
              {past.length === 0 && <li className="p-lg text-body-md text-on-surface-variant">No past interviews yet.</li>}
              {past.map((i) => (
                <li key={i.id} className="p-lg flex items-center justify-between hover:bg-surface-container-low gap-md flex-wrap">
                  <div>
                    <p className="font-semibold">{i.candidateName}</p>
                    <p className="text-body-md text-on-surface-variant">{fmtDate(i.scheduledAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link to="/recruiter/monitor" hash={`playback-${i.id}`} className="text-primary text-body-md hover:underline flex items-center gap-1">
                      <Icon name="play_circle" />Playback
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </CardShadow>
        </div>

        {/* Right rail */}
        <div className="space-y-lg">
          <CardShadow className="p-lg space-y-md h-fit">
            <h3 className="text-headline-sm">Upcoming</h3>
            {upcoming.length === 0 && <p className="text-body-md text-on-surface-variant">Nothing scheduled.</p>}
            {upcoming.slice(0, 6).map((i) => {
              const dto = dtoById.get(i.id);
              return (
                <div key={i.id} className="p-md border border-outline-variant rounded-lg">
                  <p className="font-semibold">{i.candidateName}</p>
                  <p className="text-body-md text-on-surface-variant">{i.persona}</p>
                  <p className="text-label-caps uppercase text-on-surface-variant mt-1">{fmtDate(i.scheduledAt)}</p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => handleCopyLink(i.id, i.candidateName)}
                      className="text-body-md px-2 py-1 border border-outline-variant rounded hover:bg-surface-container-low flex items-center justify-center gap-1"
                    >
                      <Icon name="link" className="text-base" />Copy link
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResend(i.id, i.candidateName, dto?.candidateEmail)}
                      className="text-body-md px-2 py-1 border border-outline-variant rounded hover:bg-surface-container-low flex items-center justify-center gap-1"
                    >
                      <Icon name="mail" className="text-base" />Resend
                    </button>
                    <Link to="/recruiter/monitor" className="col-span-1 text-center text-body-md px-2 py-1 bg-primary text-on-primary rounded">Monitor</Link>
                    <button
                      type="button"
                      onClick={() => handleCancel(i.id)}
                      className="col-span-1 text-body-md px-2 py-1 border border-outline-variant rounded hover:bg-surface-container-low"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            })}
          </CardShadow>

          <CardShadow className="p-lg h-fit">
            <h3 className="text-headline-sm mb-md">Activity</h3>
            <ul className="space-y-3">
              {activity.length === 0 && <li className="text-body-md text-on-surface-variant">No recent activity.</li>}
              {activity.slice(0, 10).map((a) => {
                const meta = ACTIVITY_ICON[a.kind];
                return (
                  <li key={a.id} className="flex items-start gap-3">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${meta.cls}`}>
                      <Icon name={meta.name} className="text-base" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-body-md leading-tight">{a.message}</p>
                      <p className="text-xs text-on-surface-variant">{relTime(a.at)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardShadow>

          <CardShadow className="p-lg h-fit">
            <button
              type="button"
              onClick={() => setShowMail((s) => !s)}
              className="w-full flex items-center justify-between text-left"
            >
              <span className="text-headline-sm flex items-center gap-2">
                <Icon name="outbox" /> Sent emails <span className="text-xs text-on-surface-variant">({mail.length})</span>
              </span>
              <Icon name={showMail ? "expand_less" : "expand_more"} />
            </button>
            {showMail && (
              <ul className="mt-md space-y-2 max-h-72 overflow-y-auto pr-1">
                {mail.length === 0 && <li className="text-body-md text-on-surface-variant">No emails sent yet.</li>}
                {mail.map((m) => (
                  <li key={m.id} className="p-2 border border-outline-variant rounded-lg text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold truncate">{kindLabel(m.kind)}</span>
                      <span className="text-on-surface-variant shrink-0">{relTime(m.sent_at ?? m.created_at)}</span>
                    </div>
                    <p className="text-on-surface-variant truncate">to {m.recipient_email}</p>
                    <p className="text-on-surface-variant truncate uppercase mt-0.5">{m.status}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardShadow>
        </div>
      </div>
    </>
  );
}
