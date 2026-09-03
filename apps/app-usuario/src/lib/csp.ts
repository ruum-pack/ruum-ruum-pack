/**
 * R1 — Fuente única de verdad para CSP/HSTS de app-usuario.
 * Sincroniza `next.config.ts` (headers estáticos) y `src/middleware.ts` (headers con nonce dinámico).
 * Cambia aquí y ambos consumidores se actualizan.
 */

// ── Orígenes canónicos (añade aquí y se propaga a script/connect/frame/img) ──
export const CSP_ORIGINS = {
  supabase: ["https://*.supabase.co", "https://*.supabase.in"],
  mapbox: ["https://*.mapbox.com", "https://api.mapbox.com", "https://events.mapbox.com"],
  sentry: ["https://*.sentry.io"],
  didit: ["https://verify.didit.me", "https://*.didit.me", "https://apx.didit.me"],
  stripe: {
    script: ["https://js.stripe.com", "https://*.stripe.com"],
    connect: [
      "https://api.stripe.com",
      "https://*.stripe.com",
      "https://*.stripe.network",
      "https://r.stripe.com",
      "https://m.stripe.com",
      "https://q.stripe.com",
    ],
    frame: ["https://js.stripe.com", "https://*.stripe.com", "https://*.stripe.network", "https://hooks.stripe.com"],
    img: ["https://*.stripe.com", "https://*.stripe.network"],
  },
} as const;

// ── Helpers para construir directivas ──
function joinOrigins(origins: readonly string[]): string {
  return origins.join(" ");
}

/**
 * Construye CSP dinámico con nonce (usado por middleware en runtime).
 * `isProd`  => nonce + strict-dynamic, sin unsafe-inline/eval.
 * `isStaging` => el caller decide emitir Report-Only además.
 */
export function buildCspUsuario(nonce: string, isProd: boolean, _isStaging: boolean): string {
  const scriptSrc = isProd
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${joinOrigins(CSP_ORIGINS.sentry)} ${joinOrigins(CSP_ORIGINS.stripe.script)}`
    : `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${joinOrigins(CSP_ORIGINS.sentry)} ${joinOrigins(CSP_ORIGINS.stripe.script)}`;

  const strictStyles = process.env.CSP_STRICT_STYLES === "true" || process.env.NEXT_PUBLIC_CSP_STRICT_STYLES === "true";
  const styleSrc = strictStyles && isProd ? `style-src 'self' 'nonce-${nonce}'` : `style-src 'self' 'unsafe-inline' 'nonce-${nonce}'`;

  const connectSrc =
    `connect-src 'self' ${joinOrigins(CSP_ORIGINS.supabase)} ${joinOrigins(CSP_ORIGINS.mapbox)} ${joinOrigins(CSP_ORIGINS.sentry)} ${joinOrigins(CSP_ORIGINS.didit)} ${joinOrigins(CSP_ORIGINS.stripe.connect)}` +
    (isProd ? "" : " ws: wss: http://localhost:* http://127.0.0.1:* capacitor://localhost");

  // img-src y frame-src tienen listas propias (no incluyen apx/eventos en img, ni apx en frame) para compat con tests PR-12
  const imgSrc = `img-src 'self' data: blob: ${joinOrigins(CSP_ORIGINS.supabase)} https://*.mapbox.com https://*.didit.me https://verify.didit.me ${joinOrigins(CSP_ORIGINS.stripe.img)}`;
  const frameSrc = `frame-src 'self' https://verify.didit.me https://*.didit.me ${joinOrigins(CSP_ORIGINS.stripe.frame)}`;

  const base = [
    "default-src 'self'",
    scriptSrc,
    styleSrc,
    connectSrc,
    imgSrc,
    "font-src 'self' data:",
    frameSrc,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
  ].join("; ");

  return base;
}

/**
 * CSP estático para `next.config.ts` headers() — sin nonce por request.
 * Mantiene misma lista de orígenes que buildCspUsuario para evitar divergencia.
 */
export function buildCspEstatico(isProd: boolean): string {
  const scriptSrc = isProd
    ? `script-src 'self' 'unsafe-inline' ${joinOrigins(CSP_ORIGINS.sentry)} ${joinOrigins(CSP_ORIGINS.stripe.script)}`
    : `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${joinOrigins(CSP_ORIGINS.sentry)} ${joinOrigins(CSP_ORIGINS.stripe.script)}`;

  const connectSrc =
    `connect-src 'self' ${joinOrigins(CSP_ORIGINS.supabase)} ${joinOrigins(CSP_ORIGINS.mapbox)} ${joinOrigins(CSP_ORIGINS.sentry)} ${joinOrigins(CSP_ORIGINS.didit)} ${joinOrigins(CSP_ORIGINS.stripe.connect)}` +
    (isProd ? "" : " ws: wss: http://localhost:* http://127.0.0.1:* capacitor://localhost");

  const imgSrc = `img-src 'self' data: blob: ${joinOrigins(CSP_ORIGINS.supabase)} https://*.mapbox.com https://*.didit.me https://verify.didit.me ${joinOrigins(CSP_ORIGINS.stripe.img)}`;
  const frameSrc = `frame-src 'self' https://verify.didit.me https://*.didit.me ${joinOrigins(CSP_ORIGINS.stripe.frame)}`;

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    connectSrc,
    imgSrc,
    "font-src 'self' data:",
    frameSrc,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
  ].join("; ");
}

export const PERMISSIONS_POLICY =
  'camera=(self "https://verify.didit.me" "https://*.didit.me"), geolocation=(self "https://verify.didit.me" "https://*.didit.me"), microphone=(self "https://verify.didit.me" "https://*.didit.me")';

export const HSTS_HEADER = "max-age=63072000; includeSubDomains; preload";
