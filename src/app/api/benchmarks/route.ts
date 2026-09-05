import { NextResponse } from "next/server";
import { loadSnapshot } from "@/data/load";

/** Benchmark catalog for agents: ids, names, units, coverage. */
export async function GET() {
  const s = await loadSnapshot();
  if (!s) return NextResponse.json({ error: "no snapshot" }, { status: 503 });
  const count = new Map<string, number>();
  for (const o of s.observations) count.set(o.benchmarkId, (count.get(o.benchmarkId) ?? 0) + 1);
  return NextResponse.json({
    date: s.date,
    benchmarks: s.benchmarks.map((b) => ({ id: b.id, name: b.name, unit: b.unit, higherIsBetter: b.higherIsBetter, category: b.category, url: b.url, description: b.description, rows: count.get(b.id) ?? 0, versionPolicy: b.versionPolicy, proxy: b.proxy })),
    models: s.models.filter((m) => m.kind === "llm").map((m) => ({ id: m.id, name: m.name, lab: m.labId, releaseDate: m.releaseDate, efforts: s.variants.filter((v) => v.modelId === m.id).map((v) => v.effort) })),
  });
}
