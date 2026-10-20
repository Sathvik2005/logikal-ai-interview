import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { StorageService } from "./storage.service";

const LOCK_KEY = 727401; // arbitrary constant: only one backend instance runs a purge at a time
const PURGE_TX_TIMEOUT_MS = 5 * 60_000;
const DEFAULT_RETENTION_MONTHS = 12;

export type PurgeResult = { snapshots: number; identityFiles: number; dryRun: boolean };

/**
 * Enforces the "Retain interview recordings for (months)" workspace setting (default 12, minimum 1).
 * Deletes proctoring snapshots and identity photos older than each organization's retention period,
 * from storage first and then the database, in small batches. Transcripts, scores and reports are kept.
 *
 * Runs every RETENTION_INTERVAL_HOURS (default 6). Enabled by default in production only; override with
 * RETENTION_ENABLED=true|false. RETENTION_DRY_RUN=true only counts what would be deleted.
 */
@Injectable()
export class RetentionService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(RetentionService.name);
  private timer: NodeJS.Timeout | null = null;
  private readonly batch = 200;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  onApplicationBootstrap() {
    const enabled = process.env.RETENTION_ENABLED
      ? process.env.RETENTION_ENABLED === "true"
      : process.env.NODE_ENV === "production";
    if (!enabled) {
      this.logger.log("Retention purge is disabled (set RETENTION_ENABLED=true to enable).");
      return;
    }
    const everyMs = Number(process.env.RETENTION_INTERVAL_HOURS ?? 6) * 3_600_000;
    setTimeout(() => void this.run(), 60_000).unref();
    this.timer = setInterval(() => void this.run(), everyMs);
    this.timer.unref();
    this.logger.log(`Retention purge scheduled every ${everyMs / 3_600_000}h.`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * One purge pass. A transaction-scoped advisory lock (released automatically at commit/rollback, so it is safe
   * with connection pooling) ensures multiple backend instances never purge at the same time.
   */
  async run(): Promise<PurgeResult | null> {
    const dryRun = process.env.RETENTION_DRY_RUN === "true";
    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`
            SELECT pg_try_advisory_xact_lock(${LOCK_KEY}) AS locked`;
          if (!locked) return null; // another instance is already purging
          return this.purge(tx, dryRun);
        },
        { timeout: PURGE_TX_TIMEOUT_MS, maxWait: 5_000 },
      );
      if (result && (result.snapshots || result.identityFiles)) {
        this.logger.log(
          `Retention ${dryRun ? "(dry run) would remove" : "removed"}: ${result.snapshots} snapshots, ${result.identityFiles} identity files.`,
        );
      }
      return result;
    } catch (err) {
      this.logger.error(
        `Retention purge failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  async purge(db: Prisma.TransactionClient | PrismaService, dryRun = false): Promise<PurgeResult> {
    let snapshots = 0;
    let identityFiles = 0;

    // Proctoring snapshots (webcam / screen captures)
    for (;;) {
      const rows = await db.$queryRaw<{ id: string; storage_path: string }[]>`
        SELECT s.id, s.storage_path
        FROM public.proctoring_snapshots s
        LEFT JOIN public.workspace_settings w ON w.org_id = s.org_id
        WHERE s.captured_at < now() - make_interval(months => GREATEST(COALESCE(w.retention_months, ${DEFAULT_RETENTION_MONTHS}), 1))
        ORDER BY s.captured_at
        LIMIT ${this.batch}`;
      if (rows.length === 0) break;
      snapshots += rows.length;
      if (dryRun) break; // counting one batch is enough for a dry run
      await this.storage.deleteFiles(
        "snapshots",
        rows.map((r) => r.storage_path),
      );
      await db.proctoringSnapshot.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
      if (rows.length < this.batch) break;
    }

    // Identity photos (selfie / ID document): remove the files, keep the verification result
    for (;;) {
      const rows = await db.$queryRaw<
        { id: string; selfie_path: string | null; id_document_path: string | null }[]
      >`
        SELECT v.id, v.selfie_path, v.id_document_path
        FROM public.identity_verifications v
        LEFT JOIN public.workspace_settings w ON w.org_id = v.org_id
        WHERE (v.selfie_path IS NOT NULL OR v.id_document_path IS NOT NULL)
          AND v.created_at < now() - make_interval(months => GREATEST(COALESCE(w.retention_months, ${DEFAULT_RETENTION_MONTHS}), 1))
        ORDER BY v.created_at
        LIMIT ${this.batch}`;
      if (rows.length === 0) break;
      const paths = rows
        .flatMap((r) => [r.selfie_path, r.id_document_path])
        .filter((p): p is string => !!p);
      identityFiles += paths.length;
      if (dryRun) break;
      await this.storage.deleteFiles("identity", paths);
      await db.identityVerification.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { selfie_path: null, id_document_path: null },
      });
      if (rows.length < this.batch) break;
    }

    return { snapshots, identityFiles, dryRun };
  }
}
