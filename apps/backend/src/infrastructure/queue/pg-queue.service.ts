import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { IQueueService } from "../../application/common/queue/queue.service";
import { PrismaService } from "../database/prisma.service";

type Handler = (payload: any) => Promise<void>;
type ClaimedJob = {
  id: string;
  task: string;
  payload: any;
  attempts: number;
  max_attempts: number;
};

/**
 * Durable queue on top of the `job_queue` table (see migration 20260706000000).
 * - Delivery is at-least-once: handlers must be idempotent.
 * - Jobs are claimed with FOR UPDATE SKIP LOCKED, so multiple instances never run the same job at once.
 * - Failures are retried with exponential backoff, then parked as `dead`.
 * - Jobs whose worker died mid-run (lock older than the visibility timeout) are put back to `pending`.
 */
@Injectable()
export class PgQueueService implements IQueueService, OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(PgQueueService.name);
  private readonly handlers = new Map<string, Handler>();
  private readonly workerId = `${process.env.RENDER_INSTANCE_ID ?? "worker"}-${randomUUID().slice(0, 8)}`;
  private readonly pollMs = Number(process.env.QUEUE_POLL_MS ?? 1000);
  private readonly concurrency = Number(process.env.QUEUE_CONCURRENCY ?? 2);
  private readonly visibilityTimeoutSec = Number(process.env.QUEUE_VISIBILITY_TIMEOUT_SEC ?? 300);
  private readonly baseBackoffSec = Number(process.env.QUEUE_BACKOFF_BASE_SEC ?? 5);
  private timer: NodeJS.Timeout | null = null;
  private lastRecovery = 0;
  private readonly inFlight = new Set<Promise<void>>();
  private stopping = false;

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.tick(), this.pollMs);
    this.logger.log(
      `Postgres queue worker ${this.workerId} started (poll ${this.pollMs}ms, concurrency ${this.concurrency}).`,
    );
  }

  async onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await Promise.allSettled([...this.inFlight]); // let running jobs finish on shutdown
  }

  registerProcessor(taskName: string, processor: Handler) {
    this.handlers.set(taskName, processor);
    this.logger.log(`Registered background processor for task: ${taskName}`);
  }

  async enqueue(taskName: string, payload: any, delayMs?: number): Promise<void> {
    const delaySec = Math.max(0, (delayMs ?? 0) / 1000);
    await this.prisma.$executeRaw`
      INSERT INTO public.job_queue (task, payload, run_at)
      VALUES (${taskName}, ${JSON.stringify(payload ?? {})}::jsonb, now() + make_interval(secs => ${delaySec}))`;
    this.logger.log(`Enqueued task [${taskName}] (Delay: ${delayMs ?? 0}ms)`);
  }

  /** One poll cycle: recover stale jobs now and then, then claim and run up to the free concurrency. */
  async tick(): Promise<void> {
    if (this.stopping) return;
    try {
      if (Date.now() - this.lastRecovery > 30_000) {
        this.lastRecovery = Date.now();
        await this.recoverStale();
      }
      const free = this.concurrency - this.inFlight.size;
      const tasks = [...this.handlers.keys()];
      if (free <= 0 || tasks.length === 0) return;

      const jobs = await this.claim(free, tasks);
      for (const job of jobs) {
        const run: Promise<void> = this.run(job).finally(() => this.inFlight.delete(run));
        this.inFlight.add(run);
      }
    } catch (err) {
      this.logger.error(`Queue poll failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private claim(limit: number, tasks: string[]): Promise<ClaimedJob[]> {
    return this.prisma.$queryRaw<ClaimedJob[]>`
      UPDATE public.job_queue SET
        status = 'running', locked_at = now(), locked_by = ${this.workerId},
        attempts = attempts + 1, updated_at = now()
      WHERE id IN (
        SELECT id FROM public.job_queue
        WHERE status = 'pending' AND run_at <= now() AND task = ANY(${tasks})
        ORDER BY run_at, created_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, task, payload, attempts, max_attempts`;
  }

  private async run(job: ClaimedJob): Promise<void> {
    const handler = this.handlers.get(job.task)!;
    try {
      this.logger.log(
        `Executing background task [${job.task}] attempt ${job.attempts}/${job.max_attempts}`,
      );
      await handler(job.payload);
      await this.prisma.$executeRaw`
        UPDATE public.job_queue SET status = 'done', completed_at = now(), locked_at = NULL,
          locked_by = NULL, last_error = NULL, updated_at = now() WHERE id = ${job.id}::uuid`;
      this.logger.log(`Completed background task [${job.task}]`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const dead = job.attempts >= job.max_attempts;
      const backoffSec = this.baseBackoffSec * 2 ** (job.attempts - 1);
      this.logger.error(
        `Task [${job.task}] failed (attempt ${job.attempts}/${job.max_attempts}${dead ? ", giving up" : `, retry in ${backoffSec}s`}): ${message}`,
        err instanceof Error ? err.stack : undefined,
      );
      await this.prisma.$executeRaw`
        UPDATE public.job_queue SET
          status = ${dead ? "dead" : "pending"}, last_error = ${message.slice(0, 2000)},
          run_at = now() + make_interval(secs => ${backoffSec}),
          locked_at = NULL, locked_by = NULL, updated_at = now()
        WHERE id = ${job.id}::uuid`;
    }
  }

  private async recoverStale(): Promise<void> {
    const n = await this.prisma.$executeRaw`
      UPDATE public.job_queue SET status = 'pending', locked_at = NULL, locked_by = NULL,
        last_error = 'Recovered after worker timeout/crash', updated_at = now()
      WHERE status = 'running' AND locked_at < now() - make_interval(secs => ${this.visibilityTimeoutSec})`;
    if (n > 0) this.logger.warn(`Recovered ${n} stale job(s) from dead workers.`);
  }
}
