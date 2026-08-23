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
    // Deuda documentada: style-src 'unsafe-inline' requerido por Tailwind/Next;
    // script-src 'unsafe-inline' requerido por Next hydration hasta migrar a nonce/hash (ver docs/CSP_DEUDA.md)
    const cspProd = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://*.sentry.io",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https://*.supabase.co https://*.mapbox.com https://*.sentry.io",
      "img-src 'self' data: blob: https://*.supabase.co https://*.mapbox.com",
      "font-src 'self' data:",
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
      "connect-src 'self' https://*.supabase.co https://*.mapbox.com https://*.sentry.io ws: wss: http://localhost:* http://127.0.0.1:*",
      "img-src 'self' data: blob: https://*.supabase.co https://*.mapbox.com",
      "font-src 'self' data:",
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
      { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
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

export default nextConfig;
