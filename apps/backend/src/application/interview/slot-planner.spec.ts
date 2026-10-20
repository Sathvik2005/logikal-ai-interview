import { planSlots } from "./slot-planner";

const base = { durationMinutes: 45, gapMinutes: 15, workStartHour: 9, workEndHour: 18 };
const iso = (d: Date[]) => d.map((x) => x.toISOString());

describe("planSlots", () => {
  it("lays slots out back to back with the gap", () => {
    const slots = planSlots({ ...base, count: 3, startAt: new Date("2026-10-20T09:00:00Z") }); // Tuesday
    expect(iso(slots)).toEqual([
      "2026-10-20T09:00:00.000Z",
      "2026-10-20T10:00:00.000Z",
      "2026-10-20T11:00:00.000Z",
    ]);
  });

  it("moves a start before opening time to the opening time", () => {
    const [first] = planSlots({ ...base, count: 1, startAt: new Date("2026-10-20T05:00:00Z") });
    expect(first.toISOString()).toBe("2026-10-20T09:00:00.000Z");
  });

  it("rolls to the next working day when the window is full", () => {
    // 09:00..18:00 with 60 min stride: last 45-min slot starting 17:00 ends 17:45 (fits); next would be 18:00.
    const slots = planSlots({ ...base, count: 11, startAt: new Date("2026-10-20T09:00:00Z") });
    expect(slots[8].toISOString()).toBe("2026-10-20T17:00:00.000Z");
    expect(slots[9].toISOString()).toBe("2026-10-21T09:00:00.000Z");
    expect(slots[10].toISOString()).toBe("2026-10-21T10:00:00.000Z");
  });

  it("skips weekends", () => {
    // Friday 2026-10-23 17:00 is the last slot of the day; the next goes to Monday.
    const slots = planSlots({ ...base, count: 2, startAt: new Date("2026-10-23T17:00:00Z") });
    expect(slots[0].toISOString()).toBe("2026-10-23T17:00:00.000Z");
    expect(slots[1].toISOString()).toBe("2026-10-26T09:00:00.000Z");
  });

  it("starting on a Saturday begins Monday morning", () => {
    const [first] = planSlots({ ...base, count: 1, startAt: new Date("2026-10-24T11:00:00Z") });
    expect(first.toISOString()).toBe("2026-10-26T09:00:00.000Z");
  });

  it("honours a UTC offset for the working window (IST)", () => {
    // 09:00 IST = 03:30 UTC
    const [first] = planSlots({
      ...base,
      count: 1,
      utcOffsetMinutes: 330,
      startAt: new Date("2026-10-20T00:00:00Z"),
    });
    expect(first.toISOString()).toBe("2026-10-20T03:30:00.000Z");
  });

  it("20 candidates fit in two working days of 45+15 minute slots", () => {
    const slots = planSlots({ ...base, count: 20, startAt: new Date("2026-10-20T09:00:00Z") });
    expect(slots).toHaveLength(20);
    const days = new Set(slots.map((s) => s.toISOString().slice(0, 10)));
    expect(days.size).toBe(3); // 9 per day -> Tue, Wed, Thu
    // strictly increasing, no overlaps
    for (let i = 1; i < slots.length; i++) expect(slots[i].getTime()).toBeGreaterThan(slots[i - 1].getTime());
  });

  it("rejects impossible settings", () => {
    const s = new Date("2026-10-20T09:00:00Z");
    expect(() => planSlots({ ...base, count: 1, startAt: s, durationMinutes: 0 })).toThrow(RangeError);
    expect(() => planSlots({ ...base, count: 1, startAt: s, workEndHour: 9 })).toThrow(RangeError);
    expect(() => planSlots({ ...base, count: 1, startAt: s, durationMinutes: 600 })).toThrow(RangeError);
  });
});
