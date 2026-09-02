/**
 * P1 — Sentry client para app-usuario (activado solo si NEXT_PUBLIC_SENTRY_DSN está definido).
 * Carga perezosa para no romper build cuando @sentry/nextjs aún no está instalado o en dev.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  import("@sentry/nextjs")
    .then((Sentry) =>
      Sentry.init({
        dsn,
        environment: process.env.NEXT_PUBLIC_RUUM_AMBIENTE || process.env.NODE_ENV,
        release: `ruum-usuario@${process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0"}`,
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
        sendDefaultPii: false,
        beforeSend(event) {
          // Filtro estricto de secretos y PII
          const FORBIDDEN = /password|token|jwt|service_role|secret|curp|clabe|cuenta|tarjeta|cvv|documento|foto|url_firmada/i;
          if (event.breadcrumbs) {
            event.breadcrumbs = event.breadcrumbs.filter(
              (b) => !FORBIDDEN.test(JSON.stringify(b))
            );
          }
          return event;
        }
      })
    )
    .catch(() => {
      // @sentry/nextjs no instalado o no-op — ignorar
    });
}
