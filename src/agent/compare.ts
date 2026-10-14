import type { Snapshot } from "../data/types";
import type { IndexConfig } from "../engine";
import { exactRanking, toShares } from "./solver";

/**
 * Two models head to head under the user's mix (each at its best-scoring effort): per benchmark, the
 * share, both normalized scores, and the index points it gives to the leader. Points sum to the gap,
 * so "why is A above B" is answered by the largest entries, with the sign already resolved.
 */
export function compareModels(snapshot: Snapshot, config: IndexConfig, a: string, b: string) {
  const { rows, result } = exactRanking(snapshot, config);
  const ra = rows.find((r) => r.modelId === a), rb = rows.find((r) => r.modelId === b);
  if (!ra || !rb) return null;
  const values = (variantId: string) => new Map((result.ranked.find((r) => r.variant.id === variantId)?.values ?? []).map((v) => [v.benchmarkId, v]));
  const va = values(ra.variantId), vb = values(rb.variantId), shares = toShares(config.weights);
  const names = new Map(snapshot.benchmarks.map((x) => [x.id, x.shortName ?? x.name]));
  const effort = (variantId: string) => variantId.split("@")[1]?.split("~")[0];
  const benchmarks = Object.entries(shares).map(([id, share]) => {
    const x = va.get(id), y = vb.get(id), pts = x && y ? share * (x.value - y.value) : null;
    return { benchmark: names.get(id) ?? id, share: +(share * 100).toFixed(1), [ra.name]: x ? +x.value.toFixed(1) : null, [rb.name]: y ? +y.value.toFixed(1) : null, estimated: [x?.estimated && ra.name, y?.estimated && rb.name].filter(Boolean), favours: pts == null ? null : pts > 0.005 ? ra.name : pts < -0.005 ? rb.name : "neither", points: pts == null ? null : +Math.abs(pts).toFixed(2) };
  }).sort((p, q) => (q.points ?? 0) - (p.points ?? 0));
  return {
    [ra.name]: { rank: rows.indexOf(ra) + 1, score: +ra.score.toFixed(1), effort: effort(ra.variantId) },
    [rb.name]: { rank: rows.indexOf(rb) + 1, score: +rb.score.toFixed(1), effort: effort(rb.variantId) },
    gap: +(ra.score - rb.score).toFixed(1), benchmarks,
    note: "Scores are normalized 0-100 per benchmark. points = share × score difference, credited to the model it favours; estimated values are filled from related data, not measured.",
  };
}
