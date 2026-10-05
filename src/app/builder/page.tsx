import type { Metadata } from "next";
import { BuilderLoader } from "@/components/BuilderLoader";
import { Builder } from "@/components/Builder";
import { clientSnapshot } from "@/data/client-snapshot";
import { PageTransition } from "@/components/PageTransition";
import { listSnapshotDates, loadSnapshot } from "@/data/load";
import { decodeIndices } from "@/lib/url";
import { chartTitle } from "@/lib/metrics";
import { RADAR_PARAM_KEYS } from "@/components/chart/radar-view";
import { chartVariantMode, computeIndex, selectVariants } from "@/engine";
import { isPreviewBot, isSearchBot, PreviewPage } from "@/lib/link-preview";

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

type SP = Record<string, string | string[] | undefined>;

async function cardFor(sp: SP) {
  const query = new URLSearchParams();
  for (const key of ["i", "date", "design", "handle", "c", "cv", "cm", "cs", "ls", "ch", "scheme", ...RADAR_PARAM_KEYS]) {
    const value = sp[key];
    for (const item of Array.isArray(value) ? value : value ? [value] : []) query.append(key, item);
  }
  const index = decodeIndices(query)[0];
  const ct = chartTitle(typeof sp.c === "string" ? sp.c : undefined);
  const base = index?.name ?? "priors";
  const title = ct ? `${base} · ${ct}` : base;
  const description = index ? await describe(index, typeof sp.date === "string" ? sp.date : undefined) : undefined;
  const desc = description ? (ct ? `${ct}: ${description}` : description) : undefined;
  return { query, title, desc };
}

export async function generateMetadata({ searchParams }: PageProps<"/builder">): Promise<Metadata> {
  const { query, title, desc } = await cardFor(await searchParams);
  const image = { url: `/og?${query}`, width: 1200, height: 630, alt: `${title} model rankings` };
  return { title, description: desc, openGraph: { title, description: desc, images: [image] }, twitter: { card: "summary_large_image", title, description: desc, images: [image] } };
}

export default async function Home({ searchParams }: PageProps<"/builder">) {
  const sp = await searchParams;
  if (await isPreviewBot()) {
    // Link-preview crawlers cap response size — give them the tags plus a tiny body, not the app.
    const { query, title, desc } = await cardFor(sp);
    return <PreviewPage title={title} description={desc} href={`/builder?${query}`} />;
  }
  const date = typeof sp.date === "string" ? sp.date : undefined;
  const dates = await listSnapshotDates();
  if (!dates.length || (date && !dates.includes(date))) return <main className="p-10"><h1 className="text-3xl">priors</h1><p className="mt-3 text-ink-2">No snapshot yet. Run <code className="mono">npm run scrape</code>.</p></main>;
  const i = sp.i == null ? [] : Array.isArray(sp.i) ? sp.i : [sp.i];
  if (await isSearchBot()) {
    const snapshot = await loadSnapshot(date);
    if (!snapshot) return <main className="p-10">No benchmark snapshot available.</main>;
    return <PageTransition><Builder snapshot={clientSnapshot(snapshot)} dates={dates} initialIndices={decodeIndices(i)} /></PageTransition>;
  }
  return <PageTransition><BuilderLoader key={date ?? "latest"} date={date} dates={dates} initialIndices={decodeIndices(i)} /></PageTransition>;
}
