import type { Benchmark } from "@/data/types";
import { PREFERRED, SUPERSEDED, type BenchmarkQuality } from "@/onboarding/quality";

/** Published before this, a benchmark is of an earlier generation (HellaSwag, GSM8K, MMLU): frontier models all but max it out. */
const OLD_BEFORE = "2024-07-01";
const POPULAR = 12;

/** Old, superseded or niche: no top model has been measured on it, it scores poorly on quality, or it predates the current generation. */
export function isOldOrNiche(b: Benchmark, q: BenchmarkQuality | undefined): boolean {
  if (SUPERSEDED.has(b.id) || b.sourceId.includes("archived")) return true;
  if (!q) return false;
  return q.frontierMeasured === 0 || q.score < 40 || (q.dateConfidence === "verified" && !!q.releaseDate && q.releaseDate < OLD_BEFORE);
}

export interface BenchTiers { popular: Benchmark[]; main: Benchmark[]; old: Benchmark[] }

/** The current benchmarks with the most-used ones lifted out, and the old and niche ones set apart. Order within each follows quality. */
export function tierBenchmarks(list: Benchmark[], quality: Map<string, BenchmarkQuality>): BenchTiers {
  const score = (b: Benchmark) => (PREFERRED as readonly string[]).includes(b.id) ? 100 + (quality.get(b.id)?.score ?? 0) : quality.get(b.id)?.score ?? 50;
  const byQuality = (a: Benchmark, b: Benchmark) => score(b) - score(a) || a.name.localeCompare(b.name);
  const old = list.filter((b) => isOldOrNiche(b, quality.get(b.id))).sort((a, b) => a.name.localeCompare(b.name));
  const current = list.filter((b) => !old.includes(b)).sort(byQuality);
  return { popular: current.slice(0, POPULAR), main: current.slice(POPULAR), old };
}

/** The publisher a benchmark comes from, as people know it. */
export function sourceFamily(sourceId: string): string {
  if (sourceId === "aa" || sourceId.startsWith("aa-")) return "Artificial Analysis";
  if (sourceId.startsWith("vals")) return "Vals AI";
  if (sourceId.startsWith("epoch")) return "Epoch AI";
  if (sourceId.startsWith("arena")) return "Arena";
  if (sourceId === "openrouter") return "OpenRouter";
  if (sourceId === "benchmarkheaven") return "BenchmarkHeaven";
  if (sourceId === "boggs") return "Boggs";
  if (sourceId === "arcagi") return "ARC Prize";
  return sourceId;
}

/** Benchmarks grouped by publisher, the biggest groups first; publishers with a couple of benchmarks share "Independent". */
export function groupBySource(list: Benchmark[]): [string, Benchmark[]][] {
  const by = new Map<string, Benchmark[]>();
  for (const b of list) { const f = sourceFamily(b.sourceId); (by.get(f) ?? by.set(f, []).get(f)!).push(b); }
  const big = [...by].filter(([, l]) => l.length >= 3).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const solo = [...by].filter(([, l]) => l.length < 3).flatMap(([, l]) => l).sort((a, b) => a.name.localeCompare(b.name));
  return solo.length ? [...big, ["Independent", solo]] : big;
}
