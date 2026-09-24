import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  typedRoutes: true,
  devIndicators: false,
  outputFileTracingIncludes: {
    "/og": ["./src/lib/og-fonts/*"],
    "/\\[handle\\]/opengraph-image": ["./src/lib/og-fonts/*"],
  },
};

export default nextConfig;
