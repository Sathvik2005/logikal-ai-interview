import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../infrastructure/database/prisma.service";

const MAX_EVENTS_PER_MINUTE = 30;

/**
 * Global error capture. Client errors (4xx) pass through untouched. Server errors (5xx / unexpected throws):
 *  - are logged as one structured JSON line (easy to ship to any log platform),
 *  - are stored in `error_events` (the admin dashboard's "Errors (24h)" reads this table),
 *  - get a request id returned to the caller so support can find the exact failure.
 * Capturing never throws and is rate-limited so an outage can't flood the database.
 */
@Catch()
export class ErrorCaptureFilter implements ExceptionFilter {
  private readonly logger = new Logger("ErrorCapture");
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
    this.persist(req, err, status, requestId);

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
}
