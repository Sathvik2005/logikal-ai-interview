import { PgQueueService } from "./pg-queue.service";

/** Tagged-template Prisma mocks: first arg is the strings array, the rest are interpolated values. */
const sqlText = (call: any[]) => (call[0] as string[]).join("?");

describe("PgQueueService", () => {
  let prisma: { $executeRaw: jest.Mock; $queryRaw: jest.Mock };
  let service: PgQueueService;

  const job = (over: Partial<{ attempts: number; max_attempts: number }> = {}) => ({
    id: "11111111-1111-1111-1111-111111111111",
    task: "t",
    payload: { a: 1 },
    attempts: 1,
    max_attempts: 3,
    ...over,
  });

  beforeEach(() => {
    prisma = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    service = new PgQueueService(prisma as any);
  });

  it("enqueue inserts a durable row with the delay applied", async () => {
    await service.enqueue("process-candidate-resume", { candidateId: "c1" }, 2500);

    const call = prisma.$executeRaw.mock.calls[0];
    expect(sqlText(call)).toContain("INSERT INTO public.job_queue");
    expect(call.slice(1)).toEqual([
      "process-candidate-resume",
      JSON.stringify({ candidateId: "c1" }),
      2.5,
    ]);
  });

  it("tick claims jobs only for registered tasks, runs them and marks them done", async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    service.registerProcessor("t", handler);
    prisma.$queryRaw.mockResolvedValueOnce([job()]);

    await service.tick();
    await (service as any).inFlight.values().next().value; // wait for the run

    const claim = prisma.$queryRaw.mock.calls[0];
    expect(sqlText(claim)).toContain("FOR UPDATE SKIP LOCKED");
    expect(claim.slice(1)).toContain(2); // limit = concurrency
    expect(claim.slice(1)).toEqual(expect.arrayContaining([["t"]]));
    expect(handler).toHaveBeenCalledWith({ a: 1 });
    const doneCall = prisma.$executeRaw.mock.calls.find((c) =>
      sqlText(c).includes("status = 'done'"),
    );
    expect(doneCall).toBeDefined();
  });

  it("failed job is rescheduled with exponential backoff", async () => {
    service.registerProcessor("t", jest.fn().mockRejectedValue(new Error("boom")));
    prisma.$queryRaw.mockResolvedValueOnce([job({ attempts: 2 })]);

    await service.tick();
    await (service as any).inFlight.values().next().value;

    const fail = prisma.$executeRaw.mock.calls.find(
      (c) =>
        sqlText(c).includes("locked_at = NULL, locked_by = NULL, updated_at = now()") &&
        sqlText(c).includes("status = ?"),
    );
    expect(fail).toBeDefined();
    const values = fail!.slice(1);
    expect(values[0]).toBe("pending");
    expect(values[1]).toBe("boom");
    expect(values[2]).toBe(10); // 5s * 2^(attempts-1) with attempts=2
  });

  it("job that exhausted its attempts is parked as dead", async () => {
    service.registerProcessor("t", jest.fn().mockRejectedValue(new Error("nope")));
    prisma.$queryRaw.mockResolvedValueOnce([job({ attempts: 3, max_attempts: 3 })]);

    await service.tick();
    await (service as any).inFlight.values().next().value;

    const fail = prisma.$executeRaw.mock.calls.find(
      (c) =>
        sqlText(c).includes("locked_at = NULL, locked_by = NULL, updated_at = now()") &&
        sqlText(c).includes("status = ?"),
    );
    expect(fail!.slice(1)[0]).toBe("dead");
  });

  it("does not claim when no processors are registered or workers are saturated", async () => {
    await service.tick();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();

    service.registerProcessor("t", () => new Promise(() => undefined)); // never finishes
    prisma.$queryRaw.mockResolvedValueOnce([job(), job({ attempts: 1 })]); // fills concurrency=2
    await service.tick();
    prisma.$queryRaw.mockClear();
    await service.tick();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("recovers stale running jobs on the first tick", async () => {
    service.registerProcessor("t", jest.fn());
    await service.tick();
    expect(
      prisma.$executeRaw.mock.calls.some((c) =>
        sqlText(c).includes("Recovered after worker timeout"),
      ),
    ).toBe(true);
  });
});
