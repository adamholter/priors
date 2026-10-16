import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  typedRoutes: true,
  serverExternalPackages: ["@resvg/resvg-js"],
  devIndicators: false,
  // PostHog posts to trailing-slash endpoints through /ingest (src/app/ingest); don't redirect them.
  skipTrailingSlashRedirect: true,
  outputFileTracingIncludes: {
    "/og": ["./src/lib/og-fonts/*"],
    "/api/history": ["./data/snapshots/????-??-??.json.gz"],
    "/\\[handle\\]/opengraph-image": ["./src/lib/og-fonts/*"],
  },
};

export default nextConfig;
