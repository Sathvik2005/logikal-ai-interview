import { RetentionService } from "./retention.service";

describe("RetentionService", () => {
  let db: any;
  let prisma: any;
  let storage: { deleteFiles: jest.Mock };
  let service: RetentionService;

  beforeEach(() => {
    db = {
      $queryRaw: jest.fn(),
      proctoringSnapshot: { deleteMany: jest.fn().mockResolvedValue({}) },
      identityVerification: { updateMany: jest.fn().mockResolvedValue({}) },
    };
    prisma = { $transaction: jest.fn(async (fn: any) => fn(db)) };
    storage = { deleteFiles: jest.fn().mockResolvedValue(undefined) };
    service = new RetentionService(prisma, storage as any);
    jest.spyOn((service as any).logger, "log").mockImplementation(() => {});
    jest.spyOn((service as any).logger, "error").mockImplementation(() => {});
    delete process.env.RETENTION_DRY_RUN;
  });

  it("deletes expired snapshots from storage first, then the database rows", async () => {
    db.$queryRaw
      .mockResolvedValueOnce([
        { id: "s1", storage_path: "i1/webcam/1.jpg" },
        { id: "s2", storage_path: "i1/screen/2.jpg" },
      ])
      .mockResolvedValueOnce([]); // no expired identity files

    const res = await service.purge(db);

    expect(res).toEqual({ snapshots: 2, identityFiles: 0, dryRun: false });
    expect(storage.deleteFiles).toHaveBeenCalledWith("snapshots", [
      "i1/webcam/1.jpg",
      "i1/screen/2.jpg",
    ]);
    expect(db.proctoringSnapshot.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["s1", "s2"] } },
    });
    const order = [
      storage.deleteFiles.mock.invocationCallOrder[0],
      db.proctoringSnapshot.deleteMany.mock.invocationCallOrder[0],
    ];
    expect(order[0]).toBeLessThan(order[1]); // never drop the DB reference before the file is gone
  });

  it("removes identity photos but keeps the verification record (paths are cleared)", async () => {
    db.$queryRaw
      .mockResolvedValueOnce([]) // no expired snapshots
      .mockResolvedValueOnce([{ id: "v1", selfie_path: "i1/selfie.jpg", id_document_path: null }]);

    const res = await service.purge(db);

    expect(res.identityFiles).toBe(1);
    expect(storage.deleteFiles).toHaveBeenCalledWith("identity", ["i1/selfie.jpg"]);
    expect(db.identityVerification.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["v1"] } },
      data: { selfie_path: null, id_document_path: null },
    });
  });

  it("dry run counts but deletes nothing", async () => {
    db.$queryRaw
      .mockResolvedValueOnce([{ id: "s1", storage_path: "a.jpg" }])
      .mockResolvedValueOnce([{ id: "v1", selfie_path: "b.jpg", id_document_path: "c.jpg" }]);

    const res = await service.purge(db, true);

    expect(res).toEqual({ snapshots: 1, identityFiles: 2, dryRun: true });
    expect(storage.deleteFiles).not.toHaveBeenCalled();
    expect(db.proctoringSnapshot.deleteMany).not.toHaveBeenCalled();
    expect(db.identityVerification.updateMany).not.toHaveBeenCalled();
  });

  it("keeps the database rows when the storage deletion fails (so it is retried next run)", async () => {
    db.$queryRaw.mockResolvedValueOnce([{ id: "s1", storage_path: "a.jpg" }]);
    storage.deleteFiles.mockRejectedValue(new Error("storage down"));

    await expect(service.purge(db)).rejects.toThrow("storage down");
    expect(db.proctoringSnapshot.deleteMany).not.toHaveBeenCalled();
  });

  it("does nothing when another instance holds the purge lock", async () => {
    db.$queryRaw.mockResolvedValueOnce([{ locked: false }]);
    const res = await service.run();
    expect(res).toBeNull();
    expect(storage.deleteFiles).not.toHaveBeenCalled();
  });

  it("run() takes the lock inside one transaction and reports the result", async () => {
    db.$queryRaw
      .mockResolvedValueOnce([{ locked: true }])
      .mockResolvedValueOnce([]) // snapshots
      .mockResolvedValueOnce([]); // identity
    const res = await service.run();
    expect(res).toEqual({ snapshots: 0, identityFiles: 0, dryRun: false });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("run() never throws, even when the database fails", async () => {
    prisma.$transaction.mockRejectedValue(new Error("db down"));
    await expect(service.run()).resolves.toBeNull();
  });
});
