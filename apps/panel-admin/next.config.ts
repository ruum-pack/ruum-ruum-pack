import type { NextConfig } from "next";
import {
  buildCspEstaticoPanel,
  HSTS_HEADER,
  PERMISSIONS_POLICY,
  IMAGES_REMOTE_PATTERNS,
  IMAGE_FORMATS,
} from "./src/lib/csp";

const nextConfig: NextConfig = {
  transpilePackages: ["@ruum/shared", "@ruum/ui", "@ruum/api"],
  outputFileTracingIncludes: {
    "/api/plantillas/traslados-masivos": ["./public/data/codigos-postales/**/*.json"],
    "/api/codigos-postales/[prefijo]": ["./public/data/codigos-postales/**/*.json"]
  },
  typescript: { ignoreBuildErrors: false },
  images: {
    remotePatterns: [...IMAGES_REMOTE_PATTERNS],
    formats: [...IMAGE_FORMATS],
  },
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    // Fuente única @ruum/shared/seguridad vía ./src/lib/csp.
    // next.config es fallback estático; src/middleware.ts es autoritativo (nonce).
    // SEC-002: prod sin 'unsafe-inline'/'unsafe-eval' en script-src.
    const csp = buildCspEstaticoPanel(isProd);
    const headersList: { key: string; value: string }[] = [
      { key: "Content-Security-Policy", value: csp },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: PERMISSIONS_POLICY }
    ];
    if (isProd) {
      headersList.push({ key: "Strict-Transport-Security", value: HSTS_HEADER });
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
