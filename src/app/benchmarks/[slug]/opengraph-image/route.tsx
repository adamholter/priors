import { loadSnapshot } from "@/data/load";
import { benchmarkPath, resolveBenchmark } from "@/lib/benchmark-slug";
import { renderBenchmarkCard, renderBenchmarkChart } from "@/lib/og-benchmark";

export const dynamic = "force-dynamic";

/** The benchmark page's share card: its leaders with published values, and score against subscription cost per task. */
/** With `c` (a copied chart link), that chart instead, in the link's settings and look: see `renderBenchmarkChart`. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const snapshot = await loadSnapshot();
  const hit = snapshot && resolveBenchmark(snapshot.benchmarks, decodeURIComponent(slug));
  const url = new URL(req.url), q = url.searchParams;
  // Never cache another benchmark's card here: this address may belong to a new benchmark by the next scrape.
  if (hit && !hit.canonical) return new Response(null, { status: 307, headers: { location: `${benchmarkPath(hit.benchmark.id)}/opengraph-image${url.search}`, "cache-control": "no-store" } });
  const png = snapshot && hit ? (q.has("c") ? await renderBenchmarkChart(snapshot, hit.benchmark.id, q) : null) ?? await renderBenchmarkCard(snapshot, hit.benchmark.id) : null;
  if (!png) return new Response("not found", { status: 404 });
  return new Response(png as unknown as BodyInit, { headers: { "content-type": "image/png", "cache-control": "public, max-age=600, s-maxage=86400, stale-while-revalidate=86400" } });
}
