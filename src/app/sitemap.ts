import type { MetadataRoute } from "next";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { loadSnapshot } from "@/data/load";
import { SITE_URL } from "@/lib/site-meta";

// Rebuilt at most hourly: new pages and models show up without a deploy.
export const revalidate = 3600;

/** The fixed routes, every model page, and every published page. Labs and account pages stay out. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const convex = process.env.NEXT_PUBLIC_CONVEX_URL;
  const [snapshot, pages] = await Promise.all([
    loadSnapshot().catch(() => null),
    convex ? new ConvexHttpClient(convex).query(api.profiles.explore, {}).catch(() => []) : Promise.resolve([]),
  ]);
  const data = snapshot ? new Date(snapshot.generatedAt) : undefined;
  return [
    ...[["/", 1], ["/rank", 0.9], ["/builder", 0.9], ["/explore", 0.8], ["/compare", 0.6], ["/model-finder", 0.8], ["/skill", 0.4], ["/cli", 0.4], ["/import", 0.3], ["/support", 0.2], ["/privacy", 0.2]].map(([path, priority]) => ({ url: `${SITE_URL}${path}`, lastModified: data, changeFrequency: "daily" as const, priority: priority as number })),
    ...pages.map((p) => ({ url: `${SITE_URL}/${p.handle}`, lastModified: new Date(p.updatedAt), changeFrequency: "daily" as const, priority: 0.7 })),
    ...(snapshot?.models ?? []).map((m) => ({ url: `${SITE_URL}/models/${encodeURIComponent(m.id)}`, lastModified: data, changeFrequency: "daily" as const, priority: 0.5 })),
  ];
}
