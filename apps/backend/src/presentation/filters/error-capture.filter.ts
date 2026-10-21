import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import * as Sentry from "@sentry/node";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../infrastructure/database/prisma.service";

const MAX_EVENTS_PER_MINUTE = 30;

/**
 * Global error capture. Client errors (4xx) pass through untouched. Server errors (5xx / unexpected throws):
 *  - are logged as one structured JSON line (easy to ship to any log platform),
 *  - are stored in `error_events` (the admin dashboard's "Errors (24h)" reads this table),
 *  - get a request id returned to the caller so support can find the exact failure.
 *  - are sent to Sentry when `SENTRY_DSN` is set (no-op otherwise),
 *  - are posted to `ERROR_ALERT_WEBHOOK_URL` when set (Slack/Teams/Discord-style `{ text }` JSON), at most once
 *    per `ERROR_ALERT_COOLDOWN_SEC` (default 300) per distinct error message, so an outage pages once, not 1000 times.
 * Capturing never throws and is rate-limited so an outage can't flood the database.
 */
@Catch()
export class ErrorCaptureFilter implements ExceptionFilter {
  private readonly logger = new Logger("ErrorCapture");
  private readonly lastAlertAt = new Map<string, number>();
  private windowStart = Date.now();
  private inWindow = 0;

  constructor(private readonly prisma: PrismaService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req: any = ctx.getRequest();
    const res: any = ctx.getResponse();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttp ? exception.getResponse() : null;

    if (status < 500) {
      res
        .status(status)
        .json(typeof body === "string" ? { statusCode: status, message: body } : body);
      return;
    }

    const requestId: string = String(req?.headers?.["x-request-id"] ?? randomUUID());
    const err = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(
      JSON.stringify({
        level: "error",
        requestId,
        method: req?.method,
        url: req?.originalUrl ?? req?.url,
        status,
        userId: req?.user?.userId,
        message: err.message,
      }),
      err.stack,
    );
    Sentry.withScope((scope) => {
      scope.setTag("request_id", requestId);
      scope.setUser({ id: req?.user?.userId });
      scope.setContext("request", { method: req?.method, url: req?.originalUrl ?? req?.url, status });
      Sentry.captureException(err);
    });
    this.persist(req, err, status, requestId);
    this.alert(req, err, status, requestId);

    res.status(status).json({
      statusCode: status,
      message: isHttp ? ((body as any)?.message ?? err.message) : "Internal server error",
      requestId,
    });
  }

  private persist(req: any, err: Error, status: number, requestId: string) {
    const now = Date.now();
    if (now - this.windowStart > 60_000) {
      this.windowStart = now;
      this.inWindow = 0;
    }
    if (++this.inWindow > MAX_EVENTS_PER_MINUTE) return;

    void this.prisma.errorEvent
      .create({
        data: {
          org_id: req?.user?.orgFromProfile ?? null,
          actor_id: req?.user?.userId ?? null,
          source: "backend",
          level: "error",
          message: err.message.slice(0, 2000),
          stack: err.stack?.slice(0, 8000) ?? null,
          context: { method: req?.method, url: req?.originalUrl ?? req?.url, status },
          request_id: requestId,
        },
      })
      .catch((e: unknown) =>
        this.logger.warn(`Could not store error event: ${e instanceof Error ? e.message : e}`),
      );
  }

  private alert(req: any, err: Error, status: number, requestId: string) {
    const url = process.env.ERROR_ALERT_WEBHOOK_URL;
    if (!url) return;
    const cooldownMs = Number(process.env.ERROR_ALERT_COOLDOWN_SEC ?? 300) * 1000;
    const key = err.message.slice(0, 200);
    const now = Date.now();
    if (now - (this.lastAlertAt.get(key) ?? 0) < cooldownMs) return;
    this.lastAlertAt.set(key, now);
    if (this.lastAlertAt.size > 200) this.lastAlertAt.delete(this.lastAlertAt.keys().next().value!);

    const text =
      `:rotating_light: ${process.env.NODE_ENV ?? "dev"} backend error ${status} ` +
      `${req?.method ?? ""} ${req?.originalUrl ?? req?.url ?? ""}
${err.message.slice(0, 500)}
requestId: ${requestId}`;
    void fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, content: text }),
      signal: AbortSignal.timeout(5000),
    }).catch((e: unknown) =>
      this.logger.warn(`Error alert webhook failed: ${e instanceof Error ? e.message : e}`),
    );
  }
}
