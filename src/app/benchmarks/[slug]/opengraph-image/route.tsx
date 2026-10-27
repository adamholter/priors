import { loadSnapshot } from "@/data/load";
import { resolveBenchmark } from "@/lib/benchmark-slug";
import { renderBenchmarkCard } from "@/lib/og-benchmark";

export const dynamic = "force-dynamic";

/** The benchmark page's share card: its leaders with published values, and score against subscription cost per task. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const snapshot = await loadSnapshot();
  const hit = snapshot && resolveBenchmark(snapshot.benchmarks, decodeURIComponent(slug));
  const png = snapshot && hit ? renderBenchmarkCard(snapshot, hit.benchmark.id) : null;
  if (!png) return new Response("not found", { status: 404 });
  return new Response(png as unknown as BodyInit, { headers: { "content-type": "image/png", "cache-control": "public, max-age=600, s-maxage=86400, stale-while-revalidate=86400" } });
}
