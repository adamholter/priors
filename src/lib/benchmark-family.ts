import type { Benchmark } from "@/data/types";
import { FAMILIES } from "@/data/benchmark-families";

export interface FamilyOption { id: string; label: string; main: boolean }
export interface Family { main: string; options: FamilyOption[] }

/** For each benchmark that belongs to a family (as its main or one of its variants): the family's id and every way to look at it. */
export function benchmarkFamilies(benchmarks: Benchmark[]): Map<string, Family> {
  const byId = new Map(benchmarks.map((b) => [b.id, b]));
  const variants = new Map<string, Benchmark[]>();
  for (const b of benchmarks) if (b.variantOf && byId.has(b.variantOf)) (variants.get(b.variantOf) ?? variants.set(b.variantOf, []).get(b.variantOf)!).push(b);
  const out = new Map<string, Family>();
  for (const [main, list] of variants) {
    const options: FamilyOption[] = [{ id: main, label: FAMILIES[main]?.mainLabel ?? "Overall", main: true }, ...list.map((b) => ({ id: b.id, label: b.variantLabel ?? b.name, main: false }))];
    const family = { main, options };
    for (const o of options) out.set(o.id, family);
  }
  return out;
}
