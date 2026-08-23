import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ruum/shared", "@ruum/ui"],
  outputFileTracingIncludes: {
    "/api/plantillas/traslados-masivos": ["../app-usuario/public/data/codigos-postales/**/*.json"],
    "/api/codigos-postales/[prefijo]": ["../app-usuario/public/data/codigos-postales/**/*.json"]
  },
  // Nunca configuramos ESLint en este proyecto (la validación real se apoya
  // en tsc, no en linting — ver README, "Por qué este repo no repite los
  // errores de la sesión anterior"). Sin esto, `next build` intenta abrir un
  // asistente interactivo para configurar ESLint cuando corre en una
  // terminal con TTY (como PowerShell) en vez de un pipeline no interactivo
  // — ese asistente se queda esperando una respuesta que nunca llega.
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    const cspProd = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://*.sentry.io",
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
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: isProd ? cspProd : cspDev },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
        ]
      }
    ];
  }
};

export default nextConfig;
