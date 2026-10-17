import type { Metadata } from "next";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { loadSnapshot } from "@/data/load";
import { computeIndex, defaultConfig, PAGE_VIEW, rankingRows, type IndexConfig } from "@/engine";
import { ExploreLab, type LabCard } from "@/components/lab/ExploreLab";
import { DEFAULT_PRIORS_MIX } from "@/onboarding/defaults";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Explore cards lab", robots: { index: false, follow: false } };

type Published = { handle: string; displayName: string; avatarUrl?: string; theme?: LabCard["theme"]; updatedAt: number; indices: IndexConfig[]; others: string[]; more: number };
const ago = (t: number) => { const d = Math.floor((Date.now() - t) / 86_400_000); return d <= 0 ? "today" : d === 1 ? "yesterday" : d < 30 ? `${d} days ago` : new Date(t).toISOString().slice(0, 10); };

/** The real published pages (when the data is reachable), padded with sample cards so every design has enough to show. */
export default async function Page() {
  const snapshot = await loadSnapshot();
  if (!snapshot) return <main role="alert" className="p-10">Benchmark data is unavailable.</main>;
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const pages = url ? await new ConvexHttpClient(url).query(api.profiles.explore, {}).catch(() => [] as Published[]) : [];
  const colors = new Map(snapshot.labs.map((l) => [l.id, l.color]));
  const sample = (name: string, weights: Record<string, number>, theme?: LabCard["theme"]): Published => ({ theme, handle: name.toLowerCase().replace(/\W+/g, ""), displayName: name, updatedAt: Date.parse(snapshot.date) - 86_400_000 * (name.length % 5), indices: [{ ...DEFAULT_PRIORS_MIX, id: "s", name: "My priors", weights, required: [], optional: [] }], others: [], more: 0 });
  const base = defaultConfig(snapshot);
  const padding = [sample("Sample Sam", base.weights, { preset: "forest" }), sample("Sample Ana", { minebench: 10, "voxelbench-text": 10, threejseval: 10 }, { preset: "aa" }), sample("Sample Lee", { simplebench: 20, "bsbench-v2": 10, "aa-humanitys-last-exam": 20 }, { preset: "slop", mode: "fixed" }), sample("Sample Kim", { "terminalbench-4": 40, "deepswe-1.1": 30, "arc-agi-3": 10 }, { preset: "sand" }), sample("Sample Raj", { "aa-omniscience": 30, "frontiermath-tier-4-v2": 30, "aa-humanitys-last-exam": 20, "simplebench": 10 }, { preset: "midnight" }), sample("Sample Mia", { "agents-last-exam": 40, chartography: 20, "zerobench-main": 20 }, { preset: "bone", mode: "fixed", accent: "#1F6F5C" }), sample("Sample Noa", base.weights, { preset: "aa", mode: "fixed" }), sample("Sample Ivy", { simplebench: 20, "bsbench-v2": 10 }, { preset: "paper" }), sample("Sample Zed", base.weights, { preset: "graphite" })];
  const list = [...pages, ...padding].slice(0, Math.max(9, pages.length));
  const cards: LabCard[] = list.map((p, i) => {
    const index = p.indices[0];
    let top: LabCard["top"] = [], mix: LabCard["mix"] = [], count = 0;
    try {
      const r = computeIndex(snapshot, { ...index, variants: "all" }, PAGE_VIEW);
      top = rankingRows(r.ranked, index).slice(0, 3).map((x) => ({ name: x.model.name, score: x.score, labId: x.model.labId, base: colors.get(x.model.labId) ?? "#A3A39B" }));
      const benches = [...r.benchmarks].sort((a, b) => b.share - a.share);
      count = benches.length;
      mix = benches.slice(0, 5).map((b) => ({ name: b.benchmark.shortName ?? b.benchmark.name, share: Math.round(b.share) }));
    } catch { /* leave empty */ }
    // The real page data has no X link yet; the lab gives most cards one so the design can be judged.
    return { theme: p.theme, handle: p.handle, name: p.displayName, avatarUrl: p.avatarUrl, when: ago(p.updatedAt), index: index?.name ?? "Rankings", others: p.others, more: p.more, top, mix, count, x: i % 4 === 3 ? undefined : p.handle };
  });
  return <ExploreLab cards={cards} />;
}
