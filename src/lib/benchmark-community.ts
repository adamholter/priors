import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

/** What people make of each benchmark: stars, and how many published pages give it weight. Neither is part of the quality score. */
export interface Community { stars: Record<string, number>; uses: Map<string, number>; pages: { indices: { weights: Record<string, number> }[] }[] }

const TTL_MS = 60_000;
let cached: { at: number; value: Promise<Community> } | undefined;

/** Stars and page counts from Convex, kept for a minute per server instance so a benchmark's page does not ask on every view. Empty without Convex or on failure. */
export function benchmarkCommunity(): Promise<Community> {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return Promise.resolve({ stars: {}, uses: new Map(), pages: [] });
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const client = new ConvexHttpClient(url);
  const value = Promise.all([
    client.query(api.benchmarkStars.counts, {}).catch(() => ({} as Record<string, number>)),
    client.query(api.profiles.explore, {}).catch(() => [] as Community["pages"]),
  ]).then(([stars, pages]) => {
    const uses = new Map<string, number>();
    for (const p of pages) for (const id of new Set(p.indices.flatMap((i) => Object.entries(i.weights).filter(([, w]) => w > 0).map(([k]) => k)))) uses.set(id, (uses.get(id) ?? 0) + 1);
    return { stars, uses, pages };
  });
  cached = { at: Date.now(), value };
  // A failed lookup is not kept.
  value.catch(() => { cached = undefined; });
  return value;
}
