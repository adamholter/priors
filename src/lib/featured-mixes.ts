import { aaComponentWeights } from "@/data/aa-index";
import type { Snapshot } from "@/data/types";
import type { IndexConfig } from "@/engine";
import { AA_INDEX_SETTINGS } from "@/onboarding/defaults";

/** Starting points chosen by hand: well-covered benchmarks from different publishers, with no benchmark repeated under another source. */
const MIXES: { id: string; name: string; weights: Record<string, number> }[] = [
  { id: "coding", name: "Coding", weights: { "aa-frontiercode-2-0": 25, "aa-terminalbench-v4-0": 15, "vals-programbench-v1": 15, bughunt: 15, "vals-vibe-code-v1-1": 10, "vals-code-migration-v1.1": 10, "deepswe-1.1": 5, "bg-ale-bench": 5 } },
  { id: "knowledge-work", name: "Knowledge work", weights: { "aa-briefcase": 20, "aa-automationbench-aa": 15, "aa-gdpval-aa": 15, "aa-gdp-pdf": 10, "bg-mercor-apex": 10, "vals-finance-agent-v2.1": 10, "vals-tax-agent": 10, "vals-legal-research": 10 } },
  { id: "science-reasoning", name: "Science & reasoning", weights: { "aa-terminalbench-science": 20, "aa-critpt-v2": 15, "aa-hle-diamond": 15, "frontiermath-tier-4-v2": 15, "vals-mysterymechanism": 10, "epoch-mystery-game-puzzles": 10, "arc-agi-3": 10, simplebench: 5 } },
];
/** A mix that lost more than this share of its weight to renamed or retired benchmarks is no longer the mix it was. */
const MIN_PRESENT = 80;

/** The starting points on Explore: Artificial Analysis' index as its own evaluations at its weights, then the hand-built mixes. */
export function featuredMixes(snapshot: Pick<Snapshot, "benchmarks">): IndexConfig[] {
  const have = new Set(snapshot.benchmarks.map((b) => b.id)), index = aaComponentWeights(snapshot);
  const built = MIXES.flatMap(({ id, name, weights }): IndexConfig[] => {
    const present = Object.fromEntries(Object.entries(weights).filter(([b]) => have.has(b)));
    return Object.values(present).reduce((n, w) => n + w, 0) >= MIN_PRESENT ? [{ ...AA_INDEX_SETTINGS, id: `featured-${id}`, name, weights: present, strictness: 70 }] : [];
  });
  return [...(index ? [{ ...AA_INDEX_SETTINGS, id: "featured-intelligence-index", name: "Intelligence Index", weights: index, strictness: 100 }] : []), ...built];
}
