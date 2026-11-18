import { computeIndex, selectVariants, type IndexConfig } from "@/engine";
import type { Snapshot } from "@/data/types";

export interface RankBand { id: string; name: string; rank: number; p10: number; median: number; p90: number; runs: number }
export interface RankStability { date: string; ranking: string; runs: number; jitter: number; models: RankBand[] }

/** A small deterministic generator, so the same snapshot always gives the same bands. */
function seeded(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const quantile = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

/** How far each model's rank moves when every benchmark weight is multiplied by a random log-normal factor. An API figure: no page draws it. */
export function rankStability(snapshot: Snapshot, config: IndexConfig, { runs = 120, jitter = 0.36, seed = 42 } = {}): RankStability {
  const random = seeded(seed), normal = () => Math.sqrt(-2 * Math.log(random() || 1e-9)) * Math.cos(2 * Math.PI * random());
  const order = (weights: IndexConfig["weights"]) => selectVariants(computeIndex(snapshot, { ...config, weights, variants: "all" }).ranked, "best");
  const base = order(config.weights), places = new Map<string, number[]>();
  for (let i = 0; i < runs; i++) {
    const weights = Object.fromEntries(Object.entries(config.weights).map(([id, w]) => [id, w * Math.exp(jitter * normal())]));
    order(weights).forEach((r, at) => { (places.get(r.model.id) ?? places.set(r.model.id, []).get(r.model.id)!).push(at + 1); });
  }
  return { date: snapshot.date, ranking: config.name, runs, jitter, models: base.map((r, i) => {
    const seen = (places.get(r.model.id) ?? [i + 1]).sort((a, b) => a - b);
    return { id: r.model.id, name: r.model.name, rank: i + 1, p10: quantile(seen, 0.1), median: quantile(seen, 0.5), p90: quantile(seen, 0.9), runs: seen.length };
  }) };
}
