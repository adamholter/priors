import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  typedRoutes: true,
  serverExternalPackages: ["@resvg/resvg-js"],
  devIndicators: false,
  // PostHog posts to trailing-slash endpoints through /ingest (src/app/ingest); don't redirect them.
  skipTrailingSlashRedirect: true,
  // The scrape publishes the intro cards it renders to the repo's data-live branch, so production serves them from
  // there rather than from the build.
  async rewrites() {
    if (!process.env.VERCEL) return [];
    return { beforeFiles: [{ source: "/intro/:file([a-z0-9-]+\\.png)", destination: "https://raw.githubusercontent.com/adamholter/priors/data-live/public/intro/:file" }], afterFiles: [], fallback: [] };
  },
  async headers() {
    return [{ source: "/intro/:file([a-z0-9-]+\\.png)", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }, { key: "Cache-Control", value: "public, max-age=300, s-maxage=300" }] }];
  },
  outputFileTracingIncludes: {
    "/og": ["./src/lib/og-fonts/*"],
    "/api/history": ["./data/snapshots/????-??-??.json.gz"],
    "/\\[handle\\]/opengraph-image": ["./src/lib/og-fonts/*"],
  },
};

export default nextConfig;
