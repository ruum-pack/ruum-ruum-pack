import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ruum/shared", "@ruum/ui"]
};

export default nextConfig;
