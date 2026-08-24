import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ruum/shared", "@ruum/ui"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/**"
      }
    ],
    formats: ["image/avif", "image/webp"],
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
    // Middleware (src/middleware.ts) es autoritativo y genera nonce por request:
    //   script-src 'self' 'nonce-{random}' 'strict-dynamic' https://*.sentry.io
    //   style-src  'self' 'unsafe-inline' 'nonce-{random}'  (deuda P2 hasta 2026-11-01)
    // next.config mantiene fallback compatible con navegadores sin nonce/strict-dynamic:
    //   script-src conserva 'strict-dynamic' (sin unsafe-inline); style-src mantiene 'unsafe-inline' como fallback.
    // Ver CSP_DEUDA_P2.md y scripts/assert-csp.mjs — CI bloquea si next.config reintroduce unsafe-eval.
    const cspProd = [
      "default-src 'self'",
      "script-src 'self' 'strict-dynamic' https://*.sentry.io",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https://*.supabase.co https://*.mapbox.com https://*.sentry.io https://*.didit.me https://verify.didit.me",
      "img-src 'self' data: blob: https://*.supabase.co https://*.mapbox.com https://*.didit.me https://verify.didit.me",
      "font-src 'self' data:",
      "frame-src 'self' https://verify.didit.me https://*.didit.me",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "worker-src 'self' blob:"
    ].join("; ");
    const cspDev = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.sentry.io",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https://*.supabase.co https://*.mapbox.com https://*.sentry.io https://*.didit.me https://verify.didit.me ws: wss: http://localhost:* http://127.0.0.1:*",
      "img-src 'self' data: blob: https://*.supabase.co https://*.mapbox.com https://*.didit.me https://verify.didit.me",
      "font-src 'self' data:",
      "frame-src 'self' https://verify.didit.me https://*.didit.me",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "worker-src 'self' blob:"
    ].join("; ");
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
