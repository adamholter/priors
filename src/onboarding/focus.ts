import type { Benchmark, FocusId } from "../data/types";
import { FOCUS_IDS } from "../data/types";

export type { FocusId };
export { FOCUS_IDS };

export interface Focus {
  id: FocusId;
  name: string;
  blurb: string;
  /** Per-category weight multiplier steering the search; unlisted categories fall back to 0.15. */
  categories: Partial<Record<Benchmark["category"], number>>;
  /** Hand-curated starting mix for the search. */
  starter: Record<string, number>;
}

export const FOCUSES: Focus[] = [
  {
    id: "capabilities",
    name: "Capabilities",
    blurb: "Coding and agentic work — what the model can actually do.",
    categories: { coding: 1, agentic: 1, reasoning: 0.5, math: 0.3, knowledge: 0.25, "long-context": 0.25 },
    starter: { "vals-programbench-v1": 25, "deepswe-1.1": 25, "aa-terminalbench-v4-0": 25, "arc-agi-3": 10, "aa-tau3-banking": 5, "aa-hle-diamond": 10 },
  },
  {
    id: "knowledge",
    name: "Knowledge",
    blurb: "Facts, recall, hallucination resistance, long documents.",
    categories: { knowledge: 1, "long-context": 0.6, reasoning: 0.4, coding: 0.2, agentic: 0.2, math: 0.2 },
    starter: { "aa-omniscience": 35, "aa-hle-diamond": 25, "aa-gpqa-diamond": 15, "aa-mlcr-aa": 15, simplebench: 10 },
  },
  {
    id: "problem-solving",
    name: "Problem solving",
    blurb: "Reasoning and math — hard, novel problems.",
    categories: { reasoning: 1, math: 1, coding: 0.4, agentic: 0.3, knowledge: 0.3, "long-context": 0.2 },
    starter: { "arc-agi-3": 30, "frontiermath-tier-4-v2": 25, "aa-hle-diamond": 20, simplebench: 15, "deepswe-1.1": 10 },
  },
  {
    id: "general",
    name: "General",
    blurb: "No bias — any benchmark that fits your order.",
    categories: { coding: 1, agentic: 1, reasoning: 1, knowledge: 1, math: 1, "long-context": 1, instruction: 1, creative: 1, safety: 1, economics: 1, composite: 1, speed: 1, cost: 1, reliability: 1, other: 1 },
    starter: { "deepswe-1.1": 20, "aa-terminalbench-v4-0": 20, "vals-programbench-v1": 15, "arc-agi-3": 10, "aa-hle-diamond": 15, "aa-omniscience": 10, "frontiermath-tier-4-v2": 10 },
  },
];

export const DEFAULT_FOCUS: FocusId = "capabilities";

export function focusMultiplier(f: Focus, category: Benchmark["category"]): number {
  return f.categories[category] ?? 0.15;
}
