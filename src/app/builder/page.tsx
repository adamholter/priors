import type { Metadata } from "next";
import { Builder } from "@/components/Builder";
import { PageTransition } from "@/components/PageTransition";
import { listSnapshotDates, loadSnapshot } from "@/data/load";
import { decodeIndices } from "@/lib/url";
import { chartTitle } from "@/lib/metrics";
import { chartVariantMode, computeIndex, selectVariants } from "@/engine";

export const dynamic = "force-dynamic";

/** "GPT-6 Sol 60.3 · GPT-5.6 Sol 59.2 — 6 benchmarks: Humanity's Last Exam 29%, …" */
async function describe(index: Parameters<typeof computeIndex>[1], date?: string): Promise<string | undefined> {
  try {
    const snapshot = await loadSnapshot(date);
    if (!snapshot) return undefined;
    const r = computeIndex(snapshot, { ...index, variants: "all" });
    const rows = selectVariants(r.ranked, chartVariantMode(index, "ranking"));
    if (!rows.length) return undefined;
    const leaders = rows.slice(0, 3).map((x) => `${x.model.name} ${x.score.toFixed(1)}`).join(" · ");
    const benches = [...r.benchmarks].sort((a, b) => b.share - a.share).slice(0, 3).map((b) => `${b.benchmark.name} ${Math.round(b.share)}%`).join(", ");
    return `${leaders} — ${r.benchmarks.length} benchmarks: ${benches}`.slice(0, 200);
  } catch {
    return undefined;
  }
}

export async function generateMetadata({ searchParams }: PageProps<"/builder">): Promise<Metadata> {
  const sp = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["i", "date", "design", "handle", "c"]) {
    const value = sp[key];
    for (const item of Array.isArray(value) ? value : value ? [value] : []) query.append(key, item);
  }
  const index = decodeIndices(query)[0];
  const c = typeof sp.c === "string" ? sp.c : undefined;
  const ct = chartTitle(c);
  const base = index?.name ?? "priors";
  const title = ct ? `${base} · ${ct}` : base;
  const description = index ? await describe(index, typeof sp.date === "string" ? sp.date : undefined) : undefined;
  const desc = description ? (ct ? `${ct}: ${description}` : description) : undefined;
  const image = { url: `/og?${query}`, width: 1200, height: 630, alt: `${title} model rankings` };
  return { title, description: desc, openGraph: { title, description: desc, images: [image] }, twitter: { card: "summary_large_image", title, description: desc, images: [image] } };
}

export default async function Home({ searchParams }: PageProps<"/builder">) {
  const sp = await searchParams;
  const date = typeof sp.date === "string" ? sp.date : undefined;
  const [snapshot, dates] = await Promise.all([loadSnapshot(date), listSnapshotDates()]);
  if (!snapshot) return <main className="p-10"><h1 className="text-3xl">priors</h1><p className="mt-3 text-ink-2">No snapshot yet. Run <code className="mono">npm run scrape</code>.</p></main>;
  const i = sp.i == null ? [] : Array.isArray(sp.i) ? sp.i : [sp.i];
  return <PageTransition><Builder snapshot={snapshot} dates={dates} initialIndices={decodeIndices(i)} /></PageTransition>;
}
