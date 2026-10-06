import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  typedRoutes: true,
  serverExternalPackages: ["@resvg/resvg-js"],
  devIndicators: false,
  // PostHog reverse proxy (src/instrumentation-client.ts posts to /ingest).
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: "https://us-assets.i.posthog.com/static/:path*" },
      { source: "/ingest/:path*", destination: "https://us.i.posthog.com/:path*" },
    ];
  },
  outputFileTracingIncludes: {
    "/og": ["./src/lib/og-fonts/*"],
    "/\\[handle\\]/opengraph-image": ["./src/lib/og-fonts/*"],
  },
};

export default nextConfig;
