import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  typedRoutes: true,
  serverExternalPackages: ["@resvg/resvg-js"],
  devIndicators: false,
  // PostHog posts to trailing-slash endpoints through /ingest (src/app/ingest); don't redirect them.
  skipTrailingSlashRedirect: true,
  // Data-only pushes do not redeploy (vercel.json ignoreCommand), so production serves the intro cards the scrape
  // renders from the repo's newest copy rather than from the build.
  async rewrites() {
    if (!process.env.VERCEL) return [];
    return { beforeFiles: [{ source: "/intro/:path*", destination: "https://raw.githubusercontent.com/adamholter/priors/main/public/intro/:path*" }], afterFiles: [], fallback: [] };
  },
  outputFileTracingIncludes: {
    "/og": ["./src/lib/og-fonts/*"],
    "/api/history": ["./data/snapshots/????-??-??.json.gz"],
    "/\\[handle\\]/opengraph-image": ["./src/lib/og-fonts/*"],
  },
};

export default nextConfig;
