import { NextResponse } from "next/server";
import { loadSnapshot } from "@/data/load";
import { modelDirectory } from "@/lib/model-directory";

/**
 * What the header's search box searches: every model (with its Priors rank and score on the default index) and every benchmark, compact.
 * Loaded once when the search first opens; the CDN keeps it for the scrape interval.
 */
export async function GET() {
  const s = await loadSnapshot();
  if (!s) return NextResponse.json({ error: "no snapshot" }, { status: 503 });
  const { items } = modelDirectory(s);
  const models = items.filter((m) => !m.superseded || m.score != null).map((m) => ({ id: m.id, name: m.name, lab: m.labName, ...(m.rank ? { rank: m.rank } : {}), ...(m.score != null ? { score: m.score } : {}), ...(m.superseded ? { old: true } : {}), aka: m.aliases.slice(0, 6) }));
  const benchmarks = s.benchmarks.filter((b) => !b.proxy).map((b) => ({ id: b.id, name: b.name, ...(b.shortName && b.shortName !== b.name ? { short: b.shortName } : {}), category: b.category }));
  return NextResponse.json({ date: s.date, models, benchmarks }, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } });
}
