/**
 * Fuente única de verdad para CSP/HSTS/Permissions-Policy de las 3 apps.
 *
 * - `buildCsp()` genera el CSP dinámico con nonce (lo usa `middleware.ts`).
 * - `buildCspEstatico()` genera el fallback estático sin nonce (lo usa
 *   `next.config.ts` para requests sin middleware: estáticos/_next).
 * - `IMAGES_REMOTE_PATTERNS` unifica el allowlist de `next/image`.
 *
 * Invariantes (verificadas por `scripts/assert-csp.mjs` en CI):
 * - prod `script-src`: nonce + 'strict-dynamic', SIN 'unsafe-inline'/'unsafe-eval'.
 * - dev `script-src`: 'unsafe-inline' + 'unsafe-eval' (HMR).
 * - `strictStyles=true` elimina 'unsafe-inline' de `style-src` en prod (SEC-003).
 */

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
    frame: [
      "https://js.stripe.com",
      "https://*.stripe.com",
      "https://*.stripe.network",
      "https://hooks.stripe.com",
    ],
    img: ["https://*.stripe.com", "https://*.stripe.network"],
  },
} as const;

export interface CspExtras {
  script?: readonly string[];
  connect?: readonly string[];
  img?: readonly string[];
  frame?: readonly string[];
}

export interface BuildCspOptions {
  /** Nonce por request. `null` = fallback estático (next.config). */
  nonce: string | null;
  isProd: boolean;
  /** SEC-003: `style-src` estricto en prod (sin 'unsafe-inline'). */
  strictStyles?: boolean;
  extras?: CspExtras;
}

function joinOrigins(origins: readonly string[]): string {
  return origins.join(" ");
}

function readStrictStylesFlag(explicit?: boolean): boolean {
  if (explicit !== undefined) return explicit;
  return (
    process.env.CSP_STRICT_STYLES === "true" ||
    process.env.NEXT_PUBLIC_CSP_STRICT_STYLES === "true"
  );
}

export function buildCsp(options: BuildCspOptions): string {
  const { nonce, isProd, extras = {} } = options;
  const strictStyles = readStrictStylesFlag(options.strictStyles);
  const extraScript = extras.script?.length ? ` ${joinOrigins(extras.script)}` : "";
  const extraConnect = extras.connect?.length ? ` ${joinOrigins(extras.connect)}` : "";
  const extraImg = extras.img?.length ? ` ${joinOrigins(extras.img)}` : "";
  const extraFrame = extras.frame?.length ? ` ${joinOrigins(extras.frame)}` : "";

  // script-src: en prod con nonce => nonce + strict-dynamic (sin inline/eval).
  // Sin nonce (fallback estático) => strict-dynamic sin inline/eval; los
  // navegadores sin soporte caen al 'self' + orígenes listados.
  const scriptSrc = isProd
    ? nonce
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${extraScript}`
      : `script-src 'self' 'strict-dynamic'${extraScript}`
    : `script-src 'self' 'unsafe-inline' 'unsafe-eval'${extraScript}`;

  const styleSrc =
    isProd && strictStyles && nonce
      ? `style-src 'self' 'nonce-${nonce}'`
      : isProd && strictStyles
        ? `style-src 'self'`
        : nonce
          ? `style-src 'self' 'unsafe-inline' 'nonce-${nonce}'`
          : `style-src 'self' 'unsafe-inline'`;

  const connectSrc =
    `connect-src 'self' ${joinOrigins(CSP_ORIGINS.supabase)} ${joinOrigins(CSP_ORIGINS.mapbox)} ${joinOrigins(CSP_ORIGINS.sentry)} ${joinOrigins(CSP_ORIGINS.didit)}${extraConnect}` +
    (isProd ? "" : " ws: wss: http://localhost:* http://127.0.0.1:* capacitor://localhost");

  const imgSrc = `img-src 'self' data: blob: ${joinOrigins(CSP_ORIGINS.supabase)} https://*.mapbox.com https://*.didit.me https://verify.didit.me${extraImg}`;
  const frameSrc = `frame-src 'self' https://verify.didit.me https://*.didit.me${extraFrame}`;

  return [
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
}

/** Fallback estático para `next.config.ts` headers() — sin nonce por request. */
export function buildCspEstatico(
  isProd: boolean,
  extras: CspExtras = {},
  strictStyles?: boolean,
): string {
  return buildCsp({ nonce: null, isProd, strictStyles, extras });
}

/** Presets por app: mismas listas que cada app usaba antes (sin divergencia). */
export const CSP_PRESETS: Record<"conductor" | "usuario" | "panel", CspExtras> = {
  conductor: { script: CSP_ORIGINS.sentry },
  usuario: {
    script: [...CSP_ORIGINS.sentry, ...CSP_ORIGINS.stripe.script],
    connect: CSP_ORIGINS.stripe.connect,
    frame: CSP_ORIGINS.stripe.frame,
    img: CSP_ORIGINS.stripe.img,
  },
  panel: { script: CSP_ORIGINS.sentry },
};

/** Allowlist unificado para `images.remotePatterns` de las 3 apps. */
export const IMAGES_REMOTE_PATTERNS = [
  { protocol: "https", hostname: "**.supabase.co" },
  { protocol: "https", hostname: "**.supabase.in" },
  { protocol: "https", hostname: "**.mapbox.com" },
  { protocol: "https", hostname: "**.didit.me" },
  { protocol: "https", hostname: "**.stripe.com" },
] as const;

export const IMAGE_FORMATS = ["image/avif", "image/webp"] as const;

export const PERMISSIONS_POLICY =
  'camera=(self "https://verify.didit.me" "https://*.didit.me"), geolocation=(self "https://verify.didit.me" "https://*.didit.me"), microphone=(self "https://verify.didit.me" "https://*.didit.me")';

export const HSTS_HEADER = "max-age=63072000; includeSubDomains; preload";
