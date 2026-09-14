import type { NextConfig } from "next";
import {
  buildCspEstatico,
  HSTS_HEADER,
  PERMISSIONS_POLICY,
  IMAGES_REMOTE_PATTERNS,
  IMAGE_FORMATS,
} from "./src/lib/csp";

const nextConfig: NextConfig = {
  transpilePackages: ["@ruum/shared", "@ruum/ui", "@ruum/api"],
  typescript: { ignoreBuildErrors: false },
  images: {
    remotePatterns: [...IMAGES_REMOTE_PATTERNS],
    formats: [...IMAGE_FORMATS],
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
