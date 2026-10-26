import type { Snapshot } from "@/data/types";
import type { MixLibrary } from "./library";
import type { RankingEvidence } from "./adaptive";
import { benchmarkQuality } from "./quality";

/** Fresh snapshot rankings, not a table of assumed model strengths. Balance
 * each focus equally, and give well-covered single tests modest prior weight. */
export function rankingEvidence(snapshot: Snapshot, library: MixLibrary | null, lineup: string[]): RankingEvidence[] {
 if (!library || library.date !== snapshot.date) return [];
 const order = (scores: Record<string, number>) => lineup.filter(id => Number.isFinite(scores[id])).sort((a, b) => scores[b] - scores[a]);
 const evidence: RankingEvidence[] = [];
 for (const mixes of Object.values(library.mixes)) for (const mix of mixes) evidence.push({ order: order(mix.ranking), weight: 8 / Math.max(1, mixes.length) });
 const quality = new Map(benchmarkQuality(snapshot).map(q => [q.id, q.score]));
 for (const benchmark of snapshot.benchmarks) {
  if (benchmark.proxy || ["cost", "speed", "composite", "reliability"].includes(benchmark.category)) continue;
  const scores = library.columns[benchmark.id];
  if (!scores) continue;
  const ranked = order(scores);
  if (ranked.length < lineup.length * .8) continue;
  evidence.push({ order: ranked, weight: .1 * (quality.get(benchmark.id) ?? 50) / 100 });
 }
 return evidence;
}
