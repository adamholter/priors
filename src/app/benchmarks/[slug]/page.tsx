import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { loadSnapshot } from "@/data/load";
import { BenchmarkPage } from "@/components/benchmark/BenchmarkPage";
import { benchmarkIndex, benchmarkSnapshot, benchmarkView } from "@/lib/benchmark-page";
import { benchmarkPath, resolveBenchmark } from "@/lib/benchmark-slug";
import { benchmarkRelatives } from "@/lib/benchmark-metrics";
import { isPreviewBot, PreviewPage } from "@/lib/link-preview";
import { pageMeta } from "@/lib/site-meta";
import { computeIndex } from "@/engine";
import { decodeIndices } from "@/lib/url";
import { framedSize, linkFrame } from "@/lib/og-chart";
import type { Benchmark, Snapshot } from "@/data/types";
import { benchmarkDescription, benchmarkStanding } from "@/lib/og-benchmark";

export const dynamic = "force-dynamic";

async function resolve(slug: string) {
  const snapshot = await loadSnapshot();
  const hit = snapshot && resolveBenchmark(snapshot.benchmarks, decodeURIComponent(slug));
  return snapshot && hit ? { snapshot, ...hit } : null;
}

/** Preview text: who leads and what the leader costs on a plan, else what the benchmark measures. */
function describe(snapshot: Snapshot, b: Benchmark) {
  const s = benchmarkStanding(snapshot, b.id);
  return s ? benchmarkDescription(s) : `${b.name}: ${b.description}`;
}

type Search = Promise<Record<string, string | string[] | undefined>>;
/** A chart link's settings, as the card route reads them: which chart, the page's index, view and hidden models, and the look it was copied in. */
const CHART_KEYS = ["c", "i", "cv", "cm", "cs", "ls", "ch", "cf", "xe", "xs", "bm", "scheme", "theme"];
function chartQuery(sp: Record<string, string | string[] | undefined>): URLSearchParams {
  const q = new URLSearchParams();
  for (const key of CHART_KEYS) for (const v of [sp[key]].flat()) if (typeof v === "string" && v) q.append(key, v);
  return q;
}
const CHART_NAMES: Record<string, string> = { rankings: "leaderboard", cost: "score vs cost per task" };

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Search }): Promise<Metadata> {
  const found = await resolve((await params).slug);
  if (!found) return { title: "Page not found" };
  const { benchmark: b } = found;
  // A copied chart link previews that chart, with the settings and look it was copied with.
  const q = chartQuery(await searchParams), c = q.get("c");
  q.set("d", found.snapshot.date);
  const chart = c ? CHART_NAMES[c] ?? (c.startsWith("metric-") ? "chart" : "leaderboard") : null;
  return pageMeta({
    title: `${b.name} · ${chart ?? "leaderboard"}`, description: describe(found.snapshot, b), path: benchmarkPath(b.id),
    ...(c ? { share: `${benchmarkPath(b.id)}?${q.toString()}` } : {}),
    // `d` gives each day's data its own image address, so a cached preview never outlives the numbers.
    image: { url: `${benchmarkPath(b.id)}/opengraph-image?${c ? q.toString() : `d=${found.snapshot.date}`}`, ...(c && c !== "rankings" ? framedSize(linkFrame(q)) : framedSize()), alt: c ? `${b.name} ${chart} on Priors` : `${b.name} on Priors: the top models and what they cost per task on a subscription` },
  });
}

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Search }) {
  const { slug } = await params;
  const found = await resolve(slug);
  if (!found) notFound();
  const { snapshot, benchmark: b, canonical } = found;
  const sp = await searchParams, query = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => [v].flat().filter((x): x is string => typeof x === "string").map((x) => [k, x])));
  const qs = query.size ? `?${query.toString()}` : "";
  if (!canonical) permanentRedirect(`${benchmarkPath(b.id)}${qs}` as "/");
  if (await isPreviewBot()) return <PreviewPage title={`${b.name} · leaderboard`} description={describe(snapshot, b)} href={`${benchmarkPath(b.id)}${qs}`} />;
  const small = benchmarkSnapshot(snapshot, b.id);
  const count = new Set(computeIndex(small, benchmarkIndex(small, b.id), benchmarkView(small, b.id)).ranked.map((r) => r.model.id)).size;
  // A copied link opens in the settings it was copied with.
  const linked = decodeIndices(query)[0];
  const base = benchmarkIndex(small, b.id);
  const initial = linked ? { ...linked, id: base.id, name: base.name, weights: base.weights, required: base.required, strictness: base.strictness, estimateMissing: false } : undefined;
  return <BenchmarkPage snapshot={small} benchmarkId={b.id} models={count} relatives={benchmarkRelatives(snapshot, b)} initial={initial} />;
}
