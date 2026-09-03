import type { NextConfig } from "next";
import { buildCspEstatico, HSTS_HEADER, PERMISSIONS_POLICY } from "./src/lib/csp";

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
    // R1: fuente única src/lib/csp.ts — next.config solo usa fallback estático sin nonce (middleware es autoridad con nonce)
    const csp = buildCspEstatico(isProd);

    const headersList: { key: string; value: string }[] = [
      { key: "Content-Security-Policy", value: csp },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: PERMISSIONS_POLICY }
    ];

    if (isProd) {
      headersList.push({
        key: "Strict-Transport-Security",
        value: HSTS_HEADER
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
