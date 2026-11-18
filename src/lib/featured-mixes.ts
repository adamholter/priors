import { aaComponentWeights } from "@/data/aa-index";
import type { Snapshot } from "@/data/types";
import type { IndexConfig } from "@/engine";
import { aaIndexMix, AA_INDEX_SETTINGS } from "@/onboarding/defaults";

/** Parts of Artificial Analysis' Intelligence Index, each one of its 25% categories at AA's own weights. */
const PILLARS: { id: string; name: string; parts: RegExp }[] = [
  { id: "coding", name: "Coding", parts: /frontiercode|terminalbench-v/ },
  { id: "knowledge-work", name: "Knowledge work", parts: /briefcase|automationbench|gdp-pdf/ },
  { id: "science", name: "Science", parts: /terminalbench-science|critpt/ },
];

/** The starting points on Explore. A category whose evaluations are not all in the snapshot is left out. */
export function featuredMixes(snapshot: Pick<Snapshot, "benchmarks">): IndexConfig[] {
  const all = aaComponentWeights(snapshot) ?? {};
  const pillars = PILLARS.flatMap(({ id, name, parts }): IndexConfig[] => {
    const weights = Object.fromEntries(Object.entries(all).filter(([part]) => parts.test(part)));
    return Object.values(weights).reduce((n, w) => n + w, 0) === 25 ? [{ ...AA_INDEX_SETTINGS, id: `featured-${id}`, name, weights, strictness: 100 }] : [];
  });
  const index = aaIndexMix(snapshot);
  return [...(Object.keys(index.weights).length ? [{ ...index, id: "featured-aa-index", name: "Intelligence Index" }] : []), ...pillars];
}
