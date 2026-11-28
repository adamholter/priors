/* The model page header's words and shapes for where a model stands. No engine here: the page loads this up front, and the work behind it (model-ranks.ts) with the dataset. */

/** A model's place in one ranking (each model at its best effort). `loose`: placed on estimates, below the ranking's measured-share floor. */
export interface Standing { rank: number; of: number; loose: boolean }
/** One ranking as the picker lists it: how many benchmarks it weighs, whether it needs all of them, and where the model stands (null: not placed). */
export interface RankSummary { benchmarks: number; allRequired: boolean; standing: Standing | null }

export interface Unranked { reason: "release" | "coverage"; /** Share of the ranking's weight this model has results on (0 to 1), and the least a ranking needs. */ share: number; floor: number; /** The release date a ranking starts at. */ cutoff: string }

/** What the picker's row says about a ranking: its size, and what it requires. */
export function describeRanking(summary: RankSummary | undefined, own: boolean): string {
  if (!summary?.benchmarks) return "";
  return `${summary.benchmarks} benchmarks${own ? ", equal weights" : summary.allRequired ? ", all required" : ""}`;
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;

/** The one line under "Not ranked": what keeps the model out. */
export function unrankedLine(u: Unranked): string {
  if (u.reason === "release") return `Released before ${u.cutoff}`;
  return u.share > 0 ? `${pct(u.share)} of the mix measured, ${pct(u.floor)} needed` : `Needs ${pct(u.floor)} of the mix measured`;
}

