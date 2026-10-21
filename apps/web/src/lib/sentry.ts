import * as Sentry from "@sentry/react";

let started = false;

/** Browser error tracking; enabled only when VITE_SENTRY_DSN is set at build time. */
export function initSentry() {
  const dsn = import.meta.env?.VITE_SENTRY_DSN as string | undefined;
  if (started || !dsn || typeof window === "undefined") return;
  started = true;
  Sentry.init({
    dsn,
    environment: import.meta.env?.MODE ?? "production",
    tracesSampleRate: 0,
  });
}

export function captureWebError(error: unknown, extra: Record<string, unknown> = {}) {
  if (!started) return;
  Sentry.captureException(error, { extra });
}
