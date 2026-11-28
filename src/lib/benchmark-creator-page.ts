import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { CreatorPage } from "@/components/benchmark/CreatorBlocks";

/**
 * A benchmark's verified creators and their visible blocks, for its page's first render. Null without Convex, when the benchmark has
 * neither, or when the lookup fails or is slow: the page never waits more than a moment on it.
 */
export async function creatorPage(benchmarkId: string, timeoutMs = 1500): Promise<CreatorPage | null> {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  const lookup = new ConvexHttpClient(url).query(api.benchmarkPages.byBenchmark, { benchmarkId }).catch(() => null);
  const late = new Promise<null>((done) => setTimeout(() => done(null), timeoutMs));
  return Promise.race([lookup, late]);
}
