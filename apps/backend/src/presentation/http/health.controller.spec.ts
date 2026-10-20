import { ServiceUnavailableException } from "@nestjs/common";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  it("reports ok with timings when the database answers", async () => {
    const prisma: any = { $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]) };
    const res = await new HealthController(prisma).check();

    expect(res).toMatchObject({ status: "ok", db: "up" });
    expect(typeof res.dbMs).toBe("number");
    expect(typeof res.uptimeSec).toBe("number");
  });

  it("returns 503 when the database is unreachable", async () => {
    const prisma: any = { $queryRaw: jest.fn().mockRejectedValue(new Error("connection refused")) };
    await expect(new HealthController(prisma).check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
