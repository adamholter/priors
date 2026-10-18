import { selectVariants, rankingRows, type IndexConfig, type IndexResult, type RankedVariant } from "../engine";

/** One model's place in one ranking: its best variant, as the ranking list shows it. */
export interface Placed { modelId: string; name: string; labId: string; rank: number; score: number; effort: string }

/** A ranking as a list of models (best variant each), in rank order. */
export function placeModels(ranked: RankedVariant[], config: IndexConfig): Placed[] {
  return selectVariants(rankingRows(ranked, config), "best").map((r, i) => ({ modelId: r.model.id, name: r.model.name, labId: r.model.labId, rank: i + 1, score: r.score, effort: r.variant.effort }));
}

/** A model seen from both sides. `shift` is A's rank minus B's: positive means B ranks it higher. */
export interface Pair { modelId: string; name: string; labId: string; a?: Placed; b?: Placed; shift?: number }

/**
 * Two rankings over the same models. By default each ranking is as published, so a model one side hides is simply
 * missing there. `sameModels` keeps only the models both rank and ranks them again among themselves, which takes
 * the effect of hidden models out of every gap.
 */
export function pairUp(a: Placed[], b: Placed[], sameModels = false): { a: Placed[]; b: Placed[]; pairs: Pair[] } {
  if (sameModels) {
    const inB = new Set(b.map((p) => p.modelId)), inA = new Set(a.map((p) => p.modelId));
    a = a.filter((p) => inB.has(p.modelId)).map((p, i) => ({ ...p, rank: i + 1 }));
    b = b.filter((p) => inA.has(p.modelId)).map((p, i) => ({ ...p, rank: i + 1 }));
  }
  const bm = new Map(b.map((p) => [p.modelId, p])), seen = new Set<string>();
  const pairs: Pair[] = [];
  for (const p of a) { seen.add(p.modelId); const q = bm.get(p.modelId); pairs.push({ modelId: p.modelId, name: p.name, labId: p.labId, a: p, b: q, shift: q ? p.rank - q.rank : undefined }); }
  for (const q of b) if (!seen.has(q.modelId)) pairs.push({ modelId: q.modelId, name: q.name, labId: q.labId, b: q });
  return { a, b, pairs };
}

/** How many of each side's top `n` are in the other's top `n`. */
export function topOverlap(a: Placed[], b: Placed[], n: number): { shared: string[]; n: number } {
  const top = new Set(b.slice(0, n).map((p) => p.modelId));
  const m = Math.min(n, a.length, b.length);
  return { shared: a.slice(0, n).filter((p) => top.has(p.modelId)).map((p) => p.modelId), n: m };
}

/** Spearman rank correlation over the models both rank, ranked again among themselves. Null under three shared models. */
export function rankCorrelation(a: Placed[], b: Placed[]): { rho: number | null; common: number } {
  const inB = new Set(b.map((p) => p.modelId));
  const ca = a.filter((p) => inB.has(p.modelId));
  const ra = new Map(ca.map((p, i) => [p.modelId, i + 1]));
  const cb = b.filter((p) => ra.has(p.modelId));
  const m = cb.length;
  if (m < 3) return { rho: null, common: m };
  let d2 = 0;
  cb.forEach((p, i) => { d2 += (ra.get(p.modelId)! - (i + 1)) ** 2; });
  return { rho: 1 - (6 * d2) / (m * (m * m - 1)), common: m };
}

/** The models the two sides disagree on most, largest rank gap first. Only models both rank, and (with `within`) that one side puts in its top `within`: a gap between #40 and #60 is not a disagreement worth naming. */
export function biggestGaps(pairs: Pair[], k = 3, minGap = 3, within = Infinity): Pair[] {
  return pairs.filter((p) => p.shift != null && Math.abs(p.shift) >= minGap && Math.min(p.a!.rank, p.b!.rank) <= within).sort((x, y) => Math.abs(y.shift!) - Math.abs(x.shift!) || x.a!.rank - y.a!.rank).slice(0, k);
}

/** A benchmark's share of each side's mix (0 when a side does not use it). */
export interface MixRow { id: string; name: string; a: number; b: number }

export function mixRows(a: IndexResult["benchmarks"], b: IndexResult["benchmarks"]): MixRow[] {
  const rows = new Map<string, MixRow>();
  for (const x of a) rows.set(x.benchmark.id, { id: x.benchmark.id, name: x.benchmark.shortName ?? x.benchmark.name, a: x.share, b: 0 });
  for (const x of b) { const r = rows.get(x.benchmark.id); if (r) r.b = x.share; else rows.set(x.benchmark.id, { id: x.benchmark.id, name: x.benchmark.shortName ?? x.benchmark.name, a: 0, b: x.share }); }
  return [...rows.values()].sort((x, y) => Math.abs(y.a - y.b) - Math.abs(x.a - x.b) || Math.max(y.a, y.b) - Math.max(x.a, x.b) || x.name.localeCompare(y.name));
}

/** The weight the two mixes put on the same benchmarks: 100 when identical, 0 when nothing is shared. */
export function mixOverlap(rows: MixRow[]): number {
  return Math.round(rows.reduce((s, r) => s + Math.min(r.a, r.b), 0));
}

/** The two things worth saying first: how much the top lists agree, and where they split. Names are what the page calls each side. */
export function verdict(a: Placed[], b: Placed[], pairs: Pair[], names: { a: string; b: string }, n = 10): { headline: string; gaps: string[] } {
  const { shared, n: m } = topOverlap(a, b, n);
  const { rho } = rankCorrelation(a, b);
  const headline = m === 0 ? "Nothing to compare yet." : shared.length === m ? `Same top ${m}, in ${rho != null && rho > 0.95 ? "nearly the same order" : "a different order"}.` : shared.length === 0 ? `No model in both top ${m} lists.` : `${shared.length} of the top ${m} are the same on both lists.`;
  const gaps = biggestGaps(pairs, 2, 3, n).map((p) => `${p.name} is #${p.a!.rank} for ${names.a} and #${p.b!.rank} for ${names.b}`);
  return { headline, gaps };
}
