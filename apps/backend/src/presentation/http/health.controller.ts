import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/database/prisma.service";

/**
 * Public liveness/readiness probe for the host (Render health check, uptime monitors).
 * Returns 200 only when the database answers; reveals no data beyond up/down and timings.
 */
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: "degraded", db: "down" });
    }
    return {
      status: "ok",
      db: "up",
      dbMs: Date.now() - started,
      uptimeSec: Math.round(process.uptime()),
      queue:
        process.env.QUEUE_DRIVER ?? (process.env.NODE_ENV === "production" ? "postgres" : "memory"),
    };
  }
}
