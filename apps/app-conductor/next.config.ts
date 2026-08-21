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
  // Nunca configuramos ESLint en este proyecto (la validación real se apoya
  // en tsc, no en linting — ver README, "Por qué este repo no repite los
  // errores de la sesión anterior"). Sin esto, `next build` intenta abrir un
  // asistente interactivo para configurar ESLint cuando corre en una
  // terminal con TTY (como PowerShell) en vez de un pipeline no interactivo
  // — ese asistente se queda esperando una respuesta que nunca llega.
  eslint: { ignoreDuringBuilds: true }
};

export default nextConfig;
