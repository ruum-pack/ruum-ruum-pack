/**
 * P1 — Sentry server para app-usuario (activado solo si SENTRY_DSN está definido).
 */
const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  import("@sentry/nextjs")
    .then((Sentry) =>
      Sentry.init({
        dsn,
        environment: process.env.SENTRY_ENVIRONMENT || process.env.NEXT_PUBLIC_RUUM_AMBIENTE || process.env.NODE_ENV,
        release: `ruum-usuario@${process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0"}`,
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
        sendDefaultPii: false,
        beforeSend(event) {
          if (event.request?.headers) {
            delete event.request.headers.authorization;
            delete event.request.headers.cookie;
            delete event.request.headers["x-supabase-auth"];
          }
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
    .catch(() => {});
}
