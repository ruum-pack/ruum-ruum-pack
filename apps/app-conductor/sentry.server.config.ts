/**
 * P0.3 — Sentry server (activado solo si SENTRY_DSN está definido)
 */
const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  import("@sentry/nextjs")
    .then((Sentry) =>
      Sentry.init({
        dsn,
        environment: process.env.SENTRY_ENVIRONMENT || process.env.NEXT_PUBLIC_RUUM_AMBIENTE || process.env.NODE_ENV,
        release: `ruum-conductor@${process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0"}`,
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
        sendDefaultPii: false
      })
    )
    .catch(() => {});
}
