/**
 * P0.3 — Sentry client (activado solo si NEXT_PUBLIC_SENTRY_DSN está definido)
 * Carga perezosa para no romper build cuando @sentry/nextjs aún no está instalado.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  import("@sentry/nextjs")
    .then((Sentry) =>
      Sentry.init({
        dsn,
        environment: process.env.NEXT_PUBLIC_RUUM_AMBIENTE || process.env.NODE_ENV,
        release: `ruum-conductor@${process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0"}`,
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
        sendDefaultPii: false
      })
    )
    .catch(() => {
      // @sentry/nextjs no instalado — ignorar hasta pnpm install
    });
}
