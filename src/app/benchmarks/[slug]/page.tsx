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

export const dynamic = "force-dynamic";

async function resolve(slug: string) {
  const snapshot = await loadSnapshot();
  const hit = snapshot && resolveBenchmark(snapshot.benchmarks, decodeURIComponent(slug));
  return snapshot && hit ? { snapshot, ...hit } : null;
}

const describe = (name: string, description: string) => `${name}: ${description} Scores by model and reasoning effort, with cost per task adjusted for subscription plans.`;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const found = await resolve((await params).slug);
  if (!found) return { title: "Page not found" };
  const { benchmark: b } = found;
  return pageMeta({ title: `${b.name} · leaderboard`, description: describe(b.name, b.description), path: benchmarkPath(b.id) });
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await resolve(slug);
  if (!found) notFound();
  const { snapshot, benchmark: b, canonical } = found;
  if (!canonical) permanentRedirect(benchmarkPath(b.id) as "/");
  if (await isPreviewBot()) return <PreviewPage title={`${b.name} · leaderboard`} description={describe(b.name, b.description)} href={benchmarkPath(b.id)} />;
  const small = benchmarkSnapshot(snapshot, b.id);
  const count = new Set(computeIndex(small, benchmarkIndex(small, b.id), benchmarkView(small, b.id)).ranked.map((r) => r.model.id)).size;
  return <BenchmarkPage snapshot={small} benchmarkId={b.id} models={count} relatives={benchmarkRelatives(snapshot, b)} />;
}
