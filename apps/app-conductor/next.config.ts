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
  // Nunca configuramos ESLint en este proyecto (la validación real se apoya
  // en tsc, no en linting — ver README, "Por qué este repo no repite los
  // errores de la sesión anterior"). Sin esto, `next build` intenta abrir un
  // asistente interactivo para configurar ESLint cuando corre en una
  // terminal con TTY (como PowerShell) en vez de un pipeline no interactivo
  // — ese asistente se queda esperando una respuesta que nunca llega.
  eslint: { ignoreDuringBuilds: true },
  async headers() {
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
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "connect-src 'self' https://*.supabase.co https://*.mapbox.com https://*.sentry.io",
              "img-src 'self' data: blob: https://*.supabase.co https://*.mapbox.com",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
              "frame-ancestors 'none'"
            ].join("; ")
          }
        ]
      }
    ];
  }
};

export default nextConfig;
