import type { Benchmark } from "@/data/types";

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** A benchmark's address is its id: `/benchmarks/frontiercode-2.0-main`. */
export const benchmarkPath = (id: string) => `/benchmarks/${id}`;

/**
 * Finds the benchmark an address means. The id is canonical, but people type what they'd say aloud
 * ("frontier-code-2"), so punctuation is ignored and a prefix of the id or name matches. When several
 * fit, the current non-variant version wins, then the shorter id.
 */
export function resolveBenchmark(benchmarks: Benchmark[], slug: string): { benchmark: Benchmark; canonical: boolean } | undefined {
  const exact = benchmarks.find((b) => b.id === slug);
  if (exact) return { benchmark: exact, canonical: true };
  const key = squash(slug);
  if (!key) return undefined;
  const superseded = new Set(benchmarks.map((b) => b.versionPolicy?.kind === "fresh" ? b.versionPolicy.supersedes : undefined).filter(Boolean));
  const rank = (b: Benchmark) => [superseded.has(b.id) ? 1 : 0, b.variantOf ? 1 : 0, b.id.length] as const;
  const best = (list: Benchmark[]) => [...list].sort((a, b) => { const x = rank(a), y = rank(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2] || b.id.localeCompare(a.id, undefined, { numeric: true }); })[0];
  for (const pick of [
    (b: Benchmark) => squash(b.id) === key,
    (b: Benchmark) => squash(b.name) === key || squash(b.shortName ?? "") === key,
    (b: Benchmark) => squash(b.id).startsWith(key) || squash(b.name).startsWith(key),
  ]) {
    const hit = best(benchmarks.filter(pick));
    if (hit) return { benchmark: hit, canonical: false };
  }
  return undefined;
}
