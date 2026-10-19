import type { Benchmark } from "./types";

/**
 * Benchmarks that are really one benchmark seen two ways, for sources that publish them as separate boards. The
 * main one is what a plain add uses; the others are reached from its settings. Arena's categories come from the
 * scraper (`variantOf` on the benchmark); these are the ones that already existed as separate benchmarks.
 */
export const FAMILIES: Record<string, { mainLabel: string; variants: Record<string, string> }> = {
  "clutterbench-raw": { mainLabel: "Raw prompt", variants: { "clutterbench-simple": "Simple prompt" } },
  "vals-programbench-v1": { mainLabel: "Fully resolved", variants: { "vals-programbench-v1-almost-resolved": "Almost resolved", "vals-programbench-v1-raw-pass-rate": "Raw pass rate" } },
  "frontiercode-1.1-main": { mainLabel: "Main", variants: { "frontiercode-1.1-extended": "Extended" } },
  "frontiermath-tier-4-v2": { mainLabel: "Tier 4", variants: { "frontiermath-tiers-1-3-v2": "Tiers 1 to 3" } },
  "matharena-apex": { mainLabel: "Full set", variants: { "matharena-apex-shortlist": "Shortlist" } },
  "aa-omniscience": { mainLabel: "Index", variants: { "aa-omniscience-accuracy": "Accuracy", "aa-omniscience-non-hallucination": "Non-hallucination" } },
  "bh-scale-swe-bench-pro-v2-full": { mainLabel: "Full set", variants: { "bh-scale-swe-bench-pro-v2-hard": "Hard subset" } },
  "arena-agent": { mainLabel: "Net improvement", variants: {} },
};
const BY_VARIANT = new Map(Object.entries(FAMILIES).flatMap(([main, f]) => Object.entries(f.variants).map(([id, label]) => [id, { main, label }] as const)));

/** Marks the benchmarks above as variants, unless the source already said so. */
export function withFamilies(benchmarks: Benchmark[]): Benchmark[] {
  return benchmarks.map((b) => { const v = BY_VARIANT.get(b.id); return v && !b.variantOf ? { ...b, variantOf: v.main, variantLabel: v.label } : b; });
}
