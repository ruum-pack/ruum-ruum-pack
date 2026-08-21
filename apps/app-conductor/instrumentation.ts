/**
 * P0.3 — Instrumentación Next.js (Sentry-ready)
 * Se activa automáticamente por Next 15 si existe en la raíz de la app.
 * Si SENTRY_DSN no está configurado, es no-op y no afecta el bundle.
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  const env = process.env.SENTRY_ENVIRONMENT || process.env.NEXT_PUBLIC_RUUM_AMBIENTE || process.env.NODE_ENV;
  const version = process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0";

  if (!dsn) return;

  try {
    // Carga perezosa para no romper si @sentry/nextjs no está instalado en dev
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn,
      environment: env,
      release: `ruum-conductor@${version}`,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
      // No enviar PII por defecto; observability.ts ya filtra curp/clabe/token
      sendDefaultPii: false,
      beforeSend(event) {
        // Filtro adicional de PII en breadcrumbs
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.filter((b) => !/curp|clabe|token/i.test(JSON.stringify(b)));
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
  // Log estructurado + espejo a supabase vía observability si es posible
  console.error("[conductor:onRequestError]", { err, request, context });
}
