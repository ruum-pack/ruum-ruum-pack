/**
 * P1 — Instrumentación Next.js (Sentry-ready) para app-usuario.
 * Se activa automáticamente por Next 15 si existe en la raíz de la app.
 * Si SENTRY_DSN no está configurado, es no-op y no afecta el bundle.
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  const env = process.env.SENTRY_ENVIRONMENT || process.env.NEXT_PUBLIC_RUUM_AMBIENTE || process.env.NODE_ENV;
  const version = process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0";

  if (!dsn) return;

  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn,
      environment: env,
      release: `ruum-usuario@${version}`,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
      sendDefaultPii: false,
      beforeSend(event) {
        if (event.request?.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
          delete event.request.headers["x-supabase-auth"];
        }
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.filter(
            (b) => !/password|token|jwt|service_role|secret|curp|clabe|cuenta|tarjeta|cvv|documento|foto/i.test(JSON.stringify(b))
          );
        }
        return event;
      }
    });
  } catch {
    // Sentry no instalado — ignorar en entornos sin dep.
  }
}

export function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string> },
  context: { routerKind: string; routePath: string; routeType: string }
) {
  // Log estructurado sanitizado en servidor
  console.error("[usuario:onRequestError]", {
    err: err instanceof Error ? { name: err.name, message: err.message } : err,
    path: request.path,
    method: request.method,
    context
  });
}
