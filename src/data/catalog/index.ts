import type { Benchmark, BenchmarkCategory } from "../types";
import { normalizeCategory } from "../categories";
import type { Entry, Rule } from "./types";
import { AA, AA_RULES } from "./aa";
import { ARENA, ARENA_RULES } from "./arena";
import { BOGGS, BOGGS_RULES } from "./boggs";
import { DIRECT, DIRECT_RULES } from "./direct";
import { HEAVEN, HEAVEN_RULES } from "./heaven";
import { VALS, VALS_RULES } from "./vals";

/**
 * The editorial layer over every source: what each benchmark tests, in plain words, and which
 * categories it sits in. A scraper says where the numbers come from; this says what they mean to a
 * reader. Descriptions open with what the model is asked to do, then how the number is scored, then
 * any caveat. A benchmark without an entry keeps its source's description and category, and the build
 * log names it so it can be written up.
 */
export const CATALOG: Record<string, Entry> = { ...AA, ...ARENA, ...BOGGS, ...DIRECT, ...HEAVEN, ...VALS };
export const RULES: Rule[] = [...AA_RULES, ...ARENA_RULES, ...BOGGS_RULES, ...DIRECT_RULES, ...HEAVEN_RULES, ...VALS_RULES];

const BOGGS_CREDIT = " Collected by Jake Boggs' benchmark dashboard.";
const unique = (list: BenchmarkCategory[]) => list.filter((c, i) => list.indexOf(c) === i);

export function catalogEntry(b: Benchmark): { c: BenchmarkCategory[]; d?: string } | undefined {
  const exact = CATALOG[b.id];
  if (exact) return exact;
  const rule = RULES.find((r) => r.match.test(b.id));
  return rule && { c: typeof rule.c === "function" ? rule.c(b) : rule.c, d: rule.d?.(b) };
}

/** A benchmark as the site shows it: catalog description and categories over the source's own. */
export function withCatalog(b: Benchmark): Benchmark {
  const entry = catalogEntry(b);
  const categories = unique((entry?.c ?? [b.category, ...(b.categories ?? [])]).map(normalizeCategory));
  let description = entry?.d ?? b.description;
  if (entry?.d && b.sourceId === "boggs") description += BOGGS_CREDIT;
  return { ...b, description, category: categories[0], categories };
}

export function applyCatalog(benchmarks: Benchmark[]): { benchmarks: Benchmark[]; missing: string[] } {
  return { benchmarks: benchmarks.map(withCatalog), missing: benchmarks.filter((b) => !catalogEntry(b)).map((b) => b.id) };
}
