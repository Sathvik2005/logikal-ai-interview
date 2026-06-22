import { useMemo, useState, useRef, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Icon } from "@/components/recruiter/RecruiterShell";
import type { Interview } from "@/components/recruiter/mock-data";

const HOUR_START = 8;
const HOUR_END = 20;
const SLOT_MIN = 30;
const SLOT_PX = 28; // px per 30-min slot

const STATUS_STYLES: Record<Interview["status"], string> = {
  scheduled: "bg-primary-fixed border-primary/40 text-primary hover:bg-primary-fixed",
  live: "bg-error-container border-error text-on-error-container hover:bg-error-container ring-1 ring-error/40",
  completed: "bg-surface-container border-outline-variant text-on-surface",
  cancelled: "bg-surface-container-low border-outline-variant text-outline line-through",
};

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7; // Monday=0
  x.setDate(x.getDate() - day);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function WeekCalendar({
  interviews,
  onReschedule,
  onAction,
  onCreateAt,
}: {
  interviews: Interview[];
  onReschedule: (id: string, newISO: string) => void;
  onAction: (action: "join" | "cancel" | "report", interview: Interview) => void;
  onCreateAt: (date: string, time: string) => void;
}) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [popoverId, setPopoverId] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setPopoverId(null);
    };
    if (popoverId) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [popoverId]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const slots = useMemo(() => {
    const out: { h: number; m: number }[] = [];
    for (let h = HOUR_START; h < HOUR_END; h++) {
      out.push({ h, m: 0 });
      out.push({ h, m: 30 });
    }
    return out;
  }, []);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, Interview[]>();
    for (const i of interviews) {
      const d = new Date(i.scheduledAt);
      const key = d.toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
    }
    return map;
  }, [interviews]);

  const now = new Date();
  const todayIdx = days.findIndex((d) => sameDay(d, now));

  function onDrop(day: Date, h: number, m: number, e: React.DragEvent) {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/interview-id");
    if (!id) return;
    const newDate = new Date(day);
    newDate.setHours(h, m, 0, 0);
    onReschedule(id, newDate.toISOString());
  }

  function eventTop(i: Interview): number {
    const d = new Date(i.scheduledAt);
    const mins = (d.getHours() - HOUR_START) * 60 + d.getMinutes();
    return (mins / SLOT_MIN) * SLOT_PX;
  }
  function eventHeight(i: Interview): number {
    return Math.max(SLOT_PX, (i.durationMin / SLOT_MIN) * SLOT_PX - 2);
  }

  const popoverInterview = popoverId ? interviews.find((i) => i.id === popoverId) : null;

  return (
    <div className="bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            className="p-1.5 rounded-md hover:bg-surface-container text-on-surface-variant"
          >
            <Icon name="chevron_left" />
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="px-3 py-1.5 text-sm font-medium text-on-surface border border-outline-variant rounded-md hover:bg-surface-container-low"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            className="p-1.5 rounded-md hover:bg-surface-container text-on-surface-variant"
          >
            <Icon name="chevron_right" />
          </button>
          <h3 className="ml-3 text-base font-semibold text-on-surface">
            {weekStart.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </h3>
        </div>
        <div className="flex items-center gap-3 text-xs text-on-surface-variant">
          <LegendDot className="bg-primary" label="Scheduled" />
          <LegendDot className="bg-error" label="Live" />
          <LegendDot className="bg-outline" label="Completed" />
        </div>
      </div>

      {/* Header row */}
      <div
        className="grid border-b border-outline-variant"
        style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}
      >
        <div />
        {days.map((d, i) => {
          const isToday = sameDay(d, now);
          return (
            <div
              key={i}
              className={`px-2 py-2 text-center border-l border-outline-variant ${isToday ? "bg-primary-fixed/60" : ""}`}
            >
              <div className="text-[11px] uppercase tracking-wide text-on-surface-variant">
                {d.toLocaleDateString(undefined, { weekday: "short" })}
              </div>
              <div
                className={`text-lg font-semibold ${isToday ? "text-primary" : "text-on-surface"}`}
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Body */}
      <div className="relative overflow-auto max-h-[640px]">
        <div className="grid relative" style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}>
          {/* Hour gutter */}
          <div>
            {slots.map((s, i) =>
              s.m === 0 ? (
                <div
                  key={i}
                  className="text-[10px] text-outline text-right pr-2 border-t border-outline-variant"
                  style={{ height: SLOT_PX * 2 }}
                >
                  {new Date(2020, 0, 1, s.h).toLocaleTimeString(undefined, { hour: "numeric" })}
                </div>
              ) : null,
            )}
          </div>

          {/* Day columns */}
          {days.map((day, di) => {
            const isToday = sameDay(day, now);
            const events = eventsByDay.get(day.toDateString()) ?? [];
            return (
              <div
                key={di}
                className={`relative border-l border-outline-variant ${isToday ? "bg-primary-fixed/30" : ""}`}
              >
                {slots.map((s, si) => {
                  const cellKey = `${di}-${si}`;
                  return (
                    <div
                      key={si}
                      role="button"
                      tabIndex={0}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(cellKey);
                      }}
                      onDragLeave={() => setDragOver((c) => (c === cellKey ? null : c))}
                      onDrop={(e) => onDrop(day, s.h, s.m, e)}
                      onClick={() => {
                        const date = day.toISOString().slice(0, 10);
                        const time = `${String(s.h).padStart(2, "0")}:${String(s.m).padStart(2, "0")}`;
                        onCreateAt(date, time);
                      }}
                      className={`${s.m === 0 ? "border-t border-outline-variant" : "border-t border-dashed border-outline-variant"} cursor-pointer transition ${
                        dragOver === cellKey
                          ? "bg-primary-fixed/70"
                          : "hover:bg-surface-container-low"
                      }`}
                      style={{ height: SLOT_PX }}
                    />
                  );
                })}

                {/* Now line */}
                {isToday && now.getHours() >= HOUR_START && now.getHours() < HOUR_END && (
                  <div
                    className="absolute left-0 right-0 pointer-events-none z-10"
                    style={{
                      top:
                        (((now.getHours() - HOUR_START) * 60 + now.getMinutes()) / SLOT_MIN) *
                        SLOT_PX,
                    }}
                  >
                    <div className="h-px bg-error" />
                    <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-error" />
                  </div>
                )}

                {/* Events */}
                {events.map((i) => {
                  const start = new Date(i.scheduledAt);
                  if (start.getHours() < HOUR_START || start.getHours() >= HOUR_END) return null;
                  const end = new Date(start.getTime() + i.durationMin * 60000);
                  return (
                    <div
                      key={i.id}
                      draggable={i.status !== "completed"}
                      onDragStart={(e) => e.dataTransfer.setData("text/interview-id", i.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPopoverId(i.id);
                      }}
                      className={`absolute left-1 right-1 rounded-md border px-2 py-1 text-xs shadow-sm cursor-grab active:cursor-grabbing overflow-hidden ${STATUS_STYLES[i.status]}`}
                      style={{ top: eventTop(i), height: eventHeight(i) }}
                      title={`${i.candidateName} — ${fmtTime(start)} → ${fmtTime(end)}`}
                    >
                      <div className="font-semibold truncate">
                        {fmtTime(start)} {i.candidateName.split(" ")[0]}
                      </div>
                      <div className="truncate opacity-80">{i.persona}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Popover */}
      {popoverInterview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
          onClick={() => setPopoverId(null)}
        >
          <div
            ref={popoverRef}
            className="bg-white border border-outline-variant rounded-xl shadow-xl p-4 w-[340px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold text-on-surface">{popoverInterview.candidateName}</p>
                <p className="text-xs text-on-surface-variant">{popoverInterview.role}</p>
              </div>
              <span
                className={`text-[10px] uppercase px-2 py-0.5 rounded ${STATUS_STYLES[popoverInterview.status]}`}
              >
                {popoverInterview.status}
              </span>
            </div>
            <div className="text-sm text-on-surface space-y-1 mb-3">
              <p className="flex items-center gap-2">
                <Icon name="schedule" className="text-base text-outline" />{" "}
                {new Date(popoverInterview.scheduledAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
              <p className="flex items-center gap-2">
                <Icon name="smart_toy" className="text-base text-outline" />{" "}
                {popoverInterview.persona}
              </p>
              <p className="flex items-center gap-2">
                <Icon name="timer" className="text-base text-outline" />{" "}
                {popoverInterview.durationMin} min
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {popoverInterview.status === "scheduled" || popoverInterview.status === "live" ? (
                <>
                  <Link
                    to="/recruiter/monitor"
                    onClick={() => setPopoverId(null)}
                    className="flex-1 text-center px-3 py-1.5 bg-primary text-on-primary text-sm rounded-md hover:bg-primary"
                  >
                    Join
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      toast("Drag the event on the calendar to reschedule.");
                      setPopoverId(null);
                    }}
                    className="flex-1 px-3 py-1.5 border border-outline-variant text-sm rounded-md hover:bg-surface-container-low"
                  >
                    Reschedule
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onAction("cancel", popoverInterview);
                      setPopoverId(null);
                    }}
                    className="px-3 py-1.5 border border-error text-on-error-container text-sm rounded-md hover:bg-error-container"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <Link
                  to="/recruiter/reports"
                  onClick={() => setPopoverId(null)}
                  className="flex-1 text-center px-3 py-1.5 bg-inverse-surface text-on-primary text-sm rounded-md hover:bg-inverse-surface"
                >
                  View report
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${className}`} /> {label}
    </span>
  );
}
