import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ruum/shared", "@ruum/ui", "@ruum/api"],
  // Nunca configuramos ESLint en este proyecto (la validación real se apoya
  // en tsc, no en linting — ver README, "Por qué este repo no repite los
  // errores de la sesión anterior"). Sin esto, `next build` intenta abrir un
  // asistente interactivo para configurar ESLint cuando corre en una
  // terminal con TTY (como PowerShell) en vez de un pipeline no interactivo
  // — ese asistente se queda esperando una respuesta que nunca llega.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.supabase.in" },
      { protocol: "https", hostname: "**.mapbox.com" },
      { protocol: "https", hostname: "**.didit.me" },
      { protocol: "https", hostname: "**.stripe.com" },
    ],
  },
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    const cspProd = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://*.sentry.io https://js.stripe.com https://*.stripe.com",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https://*.supabase.co https://*.supabase.in https://*.mapbox.com https://api.mapbox.com https://events.mapbox.com https://*.sentry.io https://*.didit.me https://verify.didit.me https://apx.didit.me https://api.stripe.com https://*.stripe.com https://*.stripe.network https://r.stripe.com https://m.stripe.com https://q.stripe.com",
      "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://*.mapbox.com https://*.didit.me https://verify.didit.me https://*.stripe.com https://*.stripe.network",
      "font-src 'self' data:",
      "frame-src 'self' https://verify.didit.me https://*.didit.me https://js.stripe.com https://*.stripe.com https://*.stripe.network https://hooks.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "worker-src 'self' blob:",
      "child-src 'self' blob:"
    ].join("; ");
    const cspDev = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.sentry.io https://js.stripe.com https://*.stripe.com",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https://*.supabase.co https://*.supabase.in https://*.mapbox.com https://api.mapbox.com https://events.mapbox.com https://*.sentry.io https://*.didit.me https://verify.didit.me https://apx.didit.me https://api.stripe.com https://*.stripe.com https://*.stripe.network https://r.stripe.com https://m.stripe.com https://q.stripe.com ws: wss: http://localhost:* http://127.0.0.1:* capacitor://localhost",
      "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://*.mapbox.com https://*.didit.me https://verify.didit.me https://*.stripe.com https://*.stripe.network",
      "font-src 'self' data:",
      "frame-src 'self' https://verify.didit.me https://*.didit.me https://js.stripe.com https://*.stripe.com https://*.stripe.network https://hooks.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "worker-src 'self' blob:",
      "child-src 'self' blob:"
    ].join("; ");

    const headersList: { key: string; value: string }[] = [
      { key: "Content-Security-Policy", value: isProd ? cspProd : cspDev },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(self \"https://verify.didit.me\" \"https://*.didit.me\"), geolocation=(self \"https://verify.didit.me\" \"https://*.didit.me\"), microphone=(self \"https://verify.didit.me\" \"https://*.didit.me\")" }
    ];

    if (isProd) {
      headersList.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload"
      });
    }

    return [
      {
        source: "/(.*)",
        headers: headersList
      }
    ];
  }
};

export default nextConfig;
