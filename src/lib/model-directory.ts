import { computeIndex, defaultConfig, PAGE_VIEW, selectVariants } from "@/engine";
import type { Snapshot } from "@/data/types";

/** One row of the model directory: who made it, when, how it ranks on the default index, how much it has been measured, what it costs. */
export interface ModelItem {
  id: string; name: string; labId: string; labName: string; labColor: string;
  releaseDate?: string; openWeights?: boolean; paramsB?: number; reasoning: boolean;
  /** Distinct benchmarks with a published result for any of its efforts (proxies such as prices and speeds left out). */
  benchmarks: number;
  /** Rank and score on the default index (`defaultConfig`), best effort, as the default ranking shows it. An older version keeps its score without a rank; both unset when too little is measured to rank. */
  rank?: number; score?: number;
  /** Artificial Analysis' blended API price, USD per 1M tokens (3 input : 1 output), its cheapest effort. */
  priceUsd?: number;
  /** An older version of a line that has a newer one: hidden until asked for, as rankings hide it. */
  superseded?: boolean;
  /** Lowercase names it is also known by, for search. */
  aliases: string[];
}

export interface ModelDirectory { items: ModelItem[]; indexName: string }

const PRICE = "aa-price-blended";
const cache = new WeakMap<Snapshot, ModelDirectory>();

export function modelDirectory(snapshot: Snapshot): ModelDirectory {
  const hit = cache.get(snapshot);
  if (hit) return hit;
  // Ranks as the default ranking shows them, which leaves out superseded versions; those keep their score from the full field, unranked.
  const config = defaultConfig(snapshot), page = computeIndex(snapshot, config, PAGE_VIEW), all = computeIndex(snapshot, config);
  const superseded = new Set(page.autoHidden);
  const best = new Map<string, { rank?: number; score: number }>(selectVariants(page.ranked, "best").map((r, i) => [r.model.id, { rank: i + 1, score: r.score }]));
  for (const r of selectVariants(all.ranked, "best")) if (superseded.has(r.model.id)) best.set(r.model.id, { score: r.score });
  const proxy = new Set(snapshot.benchmarks.filter((b) => b.proxy || b.id === PRICE).map((b) => b.id));
  const modelOf = new Map(snapshot.variants.map((v) => [v.id, v.modelId]));
  const measured = new Map<string, Set<string>>(), price = new Map<string, number>();
  for (const o of snapshot.observations) {
    const model = modelOf.get(o.variantId.split("~")[0]);
    if (!model) continue;
    if (o.benchmarkId === PRICE) { if (o.value > 0 && !(o.value >= (price.get(model) ?? Infinity))) price.set(model, o.value); continue; }
    if (proxy.has(o.benchmarkId)) continue;
    (measured.get(model) ?? measured.set(model, new Set()).get(model)!).add(o.benchmarkId);
  }
  const labs = new Map(snapshot.labs.map((l) => [l.id, l]));
  const items = snapshot.models.filter((m) => m.kind === "llm" && measured.has(m.id)).map((m): ModelItem => {
    const lab = labs.get(m.labId), at = best.get(m.id);
    return {
      id: m.id, name: m.name, labId: m.labId, labName: lab?.name ?? m.labId, labColor: lab?.color ?? "#888",
      ...(m.releaseDate ? { releaseDate: m.releaseDate } : {}), ...(m.openWeights != null ? { openWeights: m.openWeights } : {}), ...(m.paramsB ? { paramsB: m.paramsB } : {}),
      reasoning: m.reasoning, benchmarks: measured.get(m.id)!.size,
      ...(at?.rank ? { rank: at.rank } : {}), ...(at ? { score: +at.score.toFixed(1) } : {}), ...(price.has(m.id) ? { priceUsd: +price.get(m.id)!.toFixed(3) } : {}),
      ...(superseded.has(m.id) ? { superseded: true } : {}), aliases: m.aliases.slice(0, 12),
    };
  });
  const out = { items, indexName: config.name };
  cache.set(snapshot, out);
  return out;
}

export type ModelSort = "rank" | "name" | "released" | "benchmarks" | "price";
export type SortDir = "asc" | "desc";
export const MODEL_SORTS: { id: ModelSort; name: string; natural: SortDir; names: [string, string] }[] = [
  { id: "rank", name: "Priors rank", natural: "asc", names: ["Best first", "Worst first"] },
  { id: "released", name: "Release date", natural: "desc", names: ["Newest first", "Oldest first"] },
  { id: "benchmarks", name: "Benchmarks", natural: "desc", names: ["Most first", "Fewest first"] },
  { id: "price", name: "API price", natural: "asc", names: ["Cheapest first", "Priciest first"] },
  { id: "name", name: "Name", natural: "asc", names: ["A to Z", "Z to A"] },
];

/** Sorted rows. Missing values (unranked, no price, no date) go last in either direction, then by name. */
export function sortModels(items: ModelItem[], sort: ModelSort, dir: SortDir): ModelItem[] {
  // Older versions have a score but no rank: they follow the ranked models, best score first.
  const key = (x: ModelItem): number | string | undefined => sort === "rank" ? x.rank ?? (x.score != null ? 1e6 - x.score : undefined) : sort === "released" ? x.releaseDate : sort === "benchmarks" ? x.benchmarks : sort === "price" ? x.priceUsd : x.name.toLowerCase();
  const sign = dir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const ka = key(a), kb = key(b);
    if (ka == null || kb == null) return ka == null && kb == null ? a.name.localeCompare(b.name) : ka == null ? 1 : -1;
    const c = typeof ka === "number" && typeof kb === "number" ? ka - kb : String(ka).localeCompare(String(kb));
    return c * sign || a.name.localeCompare(b.name);
  });
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9.]+/g, " ").trim();

/** Every word typed must start a word of the name, lab or an alias ("opus 5", "gemini neon", "deepseek"); best matches first: name, then lab, then alias. */
export function searchModels(items: ModelItem[], q: string): ModelItem[] {
  const words = squash(q).split(" ").filter(Boolean);
  if (!words.length) return items;
  const fits = (text: string) => { const parts = squash(text).split(" "); return words.every((w) => parts.some((p) => p.startsWith(w))); };
  const score = (x: ModelItem) => fits(x.name) ? 3 : fits(`${x.labName} ${x.name}`) ? 2 : x.aliases.some(fits) || fits(`${x.labName} ${x.aliases.join(" ")}`) ? 1 : 0;
  return items.map((x) => [x, score(x)] as const).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).map(([x]) => x);
}
