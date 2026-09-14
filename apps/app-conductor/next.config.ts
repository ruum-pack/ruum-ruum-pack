import type { NextConfig } from "next";
import {
  buildCspEstatico,
  CSP_PRESETS,
  IMAGES_REMOTE_PATTERNS,
  IMAGE_FORMATS,
} from "@ruum/shared/seguridad";

const nextConfig: NextConfig = {
  transpilePackages: ["@ruum/shared", "@ruum/ui", "@ruum/api"],
  images: {
    remotePatterns: [...IMAGES_REMOTE_PATTERNS],
    formats: [...IMAGE_FORMATS],
    deviceSizes: [320, 420, 640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256]
  },
  compress: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["@ruum/ui", "@ruum/shared"],
  },
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    const isStaging = process.env.NEXT_PUBLIC_RUUM_AMBIENTE === "staging";
    // P2 CSP — prod sin unsafe-eval, dev con unsafe-eval para HMR
    // SEC-002 (P1): next.config es fallback para requests sin middleware (estáticos/_next).
    // Middleware (src/middleware.ts) es autoritativo y genera nonce por request.
    // Fuente única: @ruum/shared/seguridad (buildCsp/buildCspEstatico/CSP_PRESETS).
    // Ver CSP_DEUDA_P2.md y scripts/assert-csp.mjs — CI bloquea si el fallback
    // reintroduce unsafe-eval o unsafe-inline en script-src de prod.
    // SEC-003: CSP_STRICT_STYLES=true elimina unsafe-inline de style-src (validación 2026-11-01)
    const cspProd = buildCspEstatico(true, CSP_PRESETS.conductor);
    // cspDev mantiene unsafe-inline/unsafe-eval para HMR (solo non-prod)
    const cspDev = buildCspEstatico(false, CSP_PRESETS.conductor);
    const csp = isProd ? cspProd : cspDev;
    const headersForAll: Array<{ key: string; value: string }> = [
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(self \"https://verify.didit.me\" \"https://*.didit.me\"), geolocation=(self \"https://verify.didit.me\" \"https://*.didit.me\"), microphone=(self \"https://verify.didit.me\" \"https://*.didit.me\")" },
      { key: "Content-Security-Policy", value: csp }
    ];
    // Report-Only en staging para validar sin romper
    if (isStaging) {
      headersForAll.push({
        key: "Content-Security-Policy-Report-Only",
        value: csp + "; report-uri /api/csp-report; report-to csp-endpoint"
      });
    }
    return [
      {
        source: "/imagenes/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/(.*)",
        headers: headersForAll
      }
    ];
  }
};

// PERF-002 — Bundle analyzer opcional (no rompe build si no está instalado).
// Usar `pnpm dlx @next/bundle-analyzer` o `ANALYZE=true pnpm build` tras `pnpm add -D @next/bundle-analyzer`.
// Ver package.json script `analyze`.
export default nextConfig;
