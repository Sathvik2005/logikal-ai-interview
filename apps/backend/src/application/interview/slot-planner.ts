export type SlotPlanOptions = {
  /** First possible start (ISO string or Date). */
  startAt: Date;
  count: number;
  durationMinutes: number;
  /** Buffer between consecutive interviews. */
  gapMinutes: number;
  /** Working window, local to `utcOffsetMinutes`. Hours are 0-24. */
  workStartHour: number;
  workEndHour: number;
  /** Minutes east of UTC for the working window (IST = 330). Default 0 (UTC). */
  utcOffsetMinutes?: number;
  skipWeekends?: boolean;
};

const MIN = 60_000;

/**
 * Sequential interview slots inside a daily working window.
 * A slot that would end after the window closes rolls to the next working day's opening time.
 */
export function planSlots(opts: SlotPlanOptions): Date[] {
  const {
    count,
    durationMinutes,
    gapMinutes,
    workStartHour,
    workEndHour,
    utcOffsetMinutes = 0,
    skipWeekends = true,
  } = opts;

  if (count < 0 || !Number.isFinite(count)) throw new RangeError("count must be >= 0");
  if (durationMinutes <= 0) throw new RangeError("durationMinutes must be > 0");
  if (workEndHour <= workStartHour) throw new RangeError("work window must end after it starts");
  if ((workEndHour - workStartHour) * 60 < durationMinutes) {
    throw new RangeError("work window is shorter than one interview");
  }

  const offset = utcOffsetMinutes * MIN;
  // Work in "local wall clock" expressed as UTC fields, convert back at the end.
  const toLocal = (d: Date) => new Date(d.getTime() + offset);
  const fromLocal = (d: Date) => new Date(d.getTime() - offset);

  const dayStart = (local: Date) =>
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), workStartHour, 0, 0, 0);
  const dayEnd = (local: Date) =>
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), workEndHour, 0, 0, 0);

  const isWeekend = (localMs: number) => {
    const day = new Date(localMs).getUTCDay();
    return day === 0 || day === 6;
  };
  const nextWorkingDayOpen = (localMs: number) => {
    let d = new Date(localMs);
    do {
      d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, workStartHour));
    } while (skipWeekends && isWeekend(d.getTime()));
    return d.getTime();
  };

  // Normalise the starting cursor into the working window.
  let cursor = toLocal(opts.startAt).getTime();
  const startLocal = new Date(cursor);
  if (cursor < dayStart(startLocal)) cursor = dayStart(startLocal);
  if (skipWeekends && isWeekend(cursor)) cursor = nextWorkingDayOpen(cursor - 24 * 60 * MIN);

  const slots: Date[] = [];
  for (let i = 0; i < count; i++) {
    const day = new Date(cursor);
    if (cursor + durationMinutes * MIN > dayEnd(day)) cursor = nextWorkingDayOpen(cursor);
    else if (cursor < dayStart(day)) cursor = dayStart(day);
    slots.push(fromLocal(new Date(cursor)));
    cursor += (durationMinutes + gapMinutes) * MIN;
  }
  return slots;
}
