import { ROW_FLAGS, type Columns } from "../data/columns";
import { fitEci, type EciFit } from "./eci";
import { fitIrt, irtExpected, IRT_FLOORS, type IrtFit } from "./irt";

/**
 * Scoring methods other than the default. The default index score is the weighted average of the mix's scores and runs none
 * of this file. `IndexConfig.scoring` picks one of:
 *
 * - "irt": the model's ability under a two-parameter item response fit (./irt.ts), estimated from its scores on the mix with
 *   each benchmark counting by its weight, and shown as the index score a model of that ability is expected to average on
 *   the mix. So it stays on the 0 to 100 scale of the default score.
 * - "eci": an ECI-style capability (./eci.ts): one fit over the mix's benchmarks, squared errors weighted by the mix, then
 *   rescaled linearly onto Epoch's ECI scale (open-ended; frontier models sit around 150 to 175 in late 2026).
 *
 * Both use the scores the default uses (measured, effort-matched, calibrated) except peer estimates: a benchmark a model was
 * never run on is left to the fitted curve instead of being filled from similar models. Both give each score a 95% interval,
 * which widens as a model has fewer scores. Which models are ranked is decided before this, by the usual coverage floor and
 * Required gates, so every method ranks the same models.
 */
export type ScoringMethod = "irt" | "eci";
export const SCORING_METHODS: readonly ScoringMethod[] = ["irt", "eci"];
export const isScoringMethod = (v: unknown): v is ScoringMethod => v === "irt" || v === "eci";
/** The short label shown beside a score that is not the default average. */
export const SCORING_LABELS: Record<ScoringMethod, string> = { irt: "IRT ability", eci: "ECI-style" };
export const scoringLabel = (method: ScoringMethod | undefined) => (method ? SCORING_LABELS[method] : undefined);

/** Zero means nothing on the ECI scale and the models people compare sit within a few points of each other, so bars under it start here instead of at 0. */
const ECI_BAR_BASE = 100;
type Scored = { score: number; method?: { method: ScoringMethod; range: [number, number] } };
export const scoreBarBase = (r: Scored | undefined) => (r?.method?.method === "eci" ? ECI_BAR_BASE : 0);
/** A ranking bar's length as a share of the longest one's (`max` is the top score). */
export function barShare(r: Scored, max: number): number {
  const base = scoreBarBase(r);
  return max > base ? Math.min(1, Math.max(0, (r.score - base) / (max - base))) : r.score >= max ? 1 : 0;
}
/** "IRT ability 61.2, likely 58.0 to 64.1" for a score from a method other than the average; nothing for the average. */
export const scoringNote = (r: Scored) => (r.method ? `${SCORING_LABELS[r.method.method]} ${r.score.toFixed(1)}, likely ${r.method.range[0].toFixed(1)} to ${r.method.range[1].toFixed(1)}` : undefined);

export interface MethodScore {
  method: ScoringMethod;
  /** What the default method gives: the weighted average of the mix's scores, peer estimates included. */
  average: number;
  /** 95% interval, on the score's own scale. */
  range: [number, number];
  /** The fitted ability (IRT) or capability (ECI) on the fit's own scale, and its standard error. */
  theta: number; se: number;
  /** Mix benchmarks whose score counted. Peer estimates never do. */
  used: number;
}

/** What the engine hands over: the pool's resolved cells (pool position × share), after normalization. */
export interface ScoringInput {
  c: Columns; P: number; S: number;
  /** Pool position -> position in the dataset's variant list. */
  pooled: Int32Array;
  shareBench: Int32Array; shareOf: Float64Array;
  /** Per cell: non-zero when the cell has a score, its 0 to 100 value, and that value again only where it was measured at the variant's own effort (NaN otherwise). */
  cell: Uint8Array; norm: Float64Array; observed: Float64Array;
}
export type Scorer = (pp: number) => { score: number; range: [number, number]; theta: number; se: number; used: number };

/** Fewest pool scores a benchmark outside the mix needs to join the IRT fit. */
const IRT_MIN_ITEM = 8;
/** IRT: a model's ability starts from its ability across every benchmark it has, held this tightly (in pool standard deviations) once that rests on `IRT_PRIOR_SCORES` scores. */
const IRT_PRIOR_SD = 0.35, IRT_PRIOR_SCORES = 4;
/** ECI: Epoch's own index, used only to set the scale, and how many models both must score for that. */
export const EPOCH_ECI = "epoch-eci";
const ECI_LINK_MIN = 5;
/** Epoch scores a model only with four benchmark scores; a variant helps set the scale on the same terms (or with every benchmark of a smaller mix). */
const ECI_LINK_SCORES = 4;
/** ECI with no Epoch scores to link to: the middle model reads 150 and one standard deviation of capability is 10 points. */
const ECI_FALLBACK_CENTER = 150, ECI_FALLBACK_SD = 10;
const Z95 = 1.96;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const { ROW_CROSS_EFFORT, ROW_INFERRED, ROW_PERFORMANCE } = ROW_FLAGS;

/** A fit depends only on its cells, so the last few are kept: dragging a weight refits nothing under IRT, and a page that ranks one index several ways fits once. */
const FITS = new Map<string, unknown>(), KEEP = 8;
function cached<T>(kind: string, arrays: (Int32Array | Float64Array)[], make: () => T): T {
  let h1 = 0x811c9dc5, h2 = 0x9e3779b9, len = 0;
  for (const a of arrays) {
    const u = new Uint32Array(a.buffer, a.byteOffset, a.byteLength >> 2);
    for (let i = 0; i < u.length; i++) { h1 = Math.imul(h1 ^ u[i], 0x01000193); h2 = (Math.imul(h2 ^ (h2 >>> 15), 0x85ebca6b) + u[i]) | 0; }
    h1 = Math.imul(h1 ^ u.length, 0x01000193); len += u.length;
  }
  const key = `${kind}.${len}.${h1 >>> 0}.${h2 >>> 0}`, hit = FITS.get(key) as T | undefined;
  if (hit !== undefined) { FITS.delete(key); FITS.set(key, hit); return hit; }
  const fit = make();
  FITS.set(key, fit);
  if (FITS.size > KEEP) FITS.delete(FITS.keys().next().value!);
  return fit;
}

export function methodScorer(method: ScoringMethod, input: ScoringInput): Scorer {
  return method === "irt" ? irtScorer(input) : eciScorer(input);
}

/**
 * IRT. The curves come from one fit over the pool: the mix's benchmarks (scores measured at the variant's own effort) plus
 * every percent benchmark outside the mix that at least `IRT_MIN_ITEM` pool variants were measured on, so a benchmark's
 * difficulty and slope rest on everything known about the models that took it. A model's score is then its ability from its
 * mix scores alone, each benchmark's weight being its share of the pull on ability, starting from its ability in that fit.
 */
function irtScorer({ c, P, S, pooled, shareBench, shareOf, cell, norm, observed }: ScoringInput): Scorer {
  const I: number[] = [], J: number[] = [], Y: number[] = [], floors: number[] = [];
  for (let s = 0; s < S; s++) floors.push(IRT_FLOORS[c.benchIds[shareBench[s]]] ?? 0);
  for (let pp = 0; pp < P; pp++) for (let s = 0; s < S; s++) { const x = observed[pp * S + s]; if (x === x) { I.push(pp); J.push(s); Y.push(x / 100); } }
  const inMix = new Set(shareBench);
  for (const b of c.panel) {
    if (inMix.has(b)) continue;
    const start = I.length;
    for (let pp = 0; pp < P; pp++) {
      const r = c.at[c.vIndex[pooled[pp]] * c.nb + b];
      if (r < 0 || c.flags[r] & (ROW_INFERRED | ROW_CROSS_EFFORT | ROW_PERFORMANCE) || !Number.isFinite(c.value[r])) continue;
      I.push(pp); J.push(floors.length); Y.push(clamp(c.value[r], 0, 100) / 100);
    }
    if (I.length - start < IRT_MIN_ITEM) { I.length = J.length = Y.length = start; continue; }
    floors.push(IRT_FLOORS[c.benchIds[b]] ?? 0);
  }
  const cells = { n: P, k: floors.length, I: Int32Array.from(I), J: Int32Array.from(J), Y: Float64Array.from(Y), floor: Float64Array.from(floors) };
  const fit = cached<IrtFit & { dispersion: number }>("irt", [cells.I, cells.J, cells.Y, cells.floor, Int32Array.of(P, S)], () => {
    const f = fitIrt(cells);
    // Quasi-likelihood dispersion: the mean squared Pearson residual. A benchmark score averages many tasks, so it carries far
    // more than one trial's information; dividing the data's information by this makes intervals match how closely real scores sit on their curves.
    let chi = 0;
    for (let q = 0; q < cells.I.length; q++) { const p = clamp(irtExpected(f, cells.J[q], f.theta[cells.I[q]]), 1e-6, 1 - 1e-6), y = clamp(cells.Y[q], 1e-3, 1 - 1e-3); chi += (y - p) ** 2 / (p * (1 - p)); }
    return { ...f, dispersion: Math.max(1e-6, chi / Math.max(1, cells.I.length - cells.n - 2 * cells.k)) };
  });
  // A weight is a share of the pull on ability: each benchmark's weight is divided by how much a score on it reveals (its
  // Fisher information averaged over the pool), so a steep benchmark does not pull harder than its weight says. Mean 1 over the mix.
  const wt = new Float64Array(S);
  let total = 0, shareSum = 0;
  for (let s = 0; s < S; s++) {
    const a = fit.a[s], f = fit.floor[s];
    let info = 0;
    for (let pp = 0; pp < P; pp++) { const q = 1 / (1 + Math.exp(-a * (fit.theta[pp] - fit.b[s]))), p = clamp(f + (1 - f) * q, 1e-6, 1 - 1e-6); info += ((1 - f) * q * (1 - q) * a) ** 2 / (p * (1 - p)) / P; }
    wt[s] = shareOf[s] / Math.max(1e-9, info); total += wt[s]; shareSum += shareOf[s];
  }
  for (let s = 0; s < S; s++) wt[s] *= S / Math.max(1e-12, total);
  /** The index score a model of ability `th` is expected to average on the mix. */
  const expected = (th: number) => { let t = 0; for (let s = 0; s < S; s++) t += shareOf[s] * irtExpected(fit, s, th); return t / shareSum * 100; };
  return (pp) => {
    // Newton steps on the weighted quasi-log-likelihood plus the prior. Fewer than `IRT_PRIOR_SCORES` scores behind the
    // starting ability: the prior is the pool's (sd 1), so thin data cannot look sure of itself.
    const mu = fit.theta[pp], prec = 1 / (fit.count[pp] >= IRT_PRIOR_SCORES ? IRT_PRIOR_SD : 1) ** 2, t0 = pp * S;
    let th = mu, h = prec, h2 = 0, used = 0;
    for (let it = 0; it < 40; it++) {
      let gd = 0, hd = 0; h2 = 0; used = 0;
      for (let s = 0; s < S; s++) {
        if (!cell[t0 + s] || !(wt[s] > 0)) continue;
        used++;
        const a = fit.a[s], f = fit.floor[s], y = clamp(norm[t0 + s] / 100, 1e-3, 1 - 1e-3);
        const q = 1 / (1 + Math.exp(-a * (th - fit.b[s]))), p = clamp(f + (1 - f) * q, 1e-6, 1 - 1e-6), dp = (1 - f) * q * (1 - q), v = p * (1 - p);
        gd += wt[s] * (p - y) * dp / v * a; hd += wt[s] * dp * dp / v * a * a; h2 += wt[s] * wt[s] * dp * dp / v * a * a;
      }
      h = hd / fit.dispersion + prec;
      const step = clamp((gd / fit.dispersion + (th - mu) * prec) / h, -1, 1);
      th -= step;
      if (Math.abs(step) < 1e-7) break;
    }
    // Sandwich variance of a weighted estimate: (sum w^2 I / phi + prior) / (sum w I / phi + prior)^2.
    const se = Math.sqrt((h2 / fit.dispersion + prec) / (h * h));
    return { score: expected(th), range: [expected(th - Z95 * se), expected(th + Z95 * se)], theta: th, se, used };
  };
}

/**
 * ECI-style. One fit over the pool's scores on the mix (./eci.ts), each benchmark's errors weighted by its share. Epoch fixes
 * its scale with two models, Claude 3.5 Sonnet at 130 and GPT-5 at 150; neither has scores on current benchmarks here, so the
 * scale is linked to Epoch's published index instead: over the fitted variants Epoch also scores, capabilities are mapped
 * linearly so their mean and spread equal those of Epoch's values. Ranks do not depend on it.
 */
function eciScorer({ c, P, S, pooled, shareBench, shareOf, cell, norm }: ScoringInput): Scorer {
  const I: number[] = [], J: number[] = [], Y: number[] = [], w = new Float64Array(S);
  let shareSum = 0;
  for (let s = 0; s < S; s++) shareSum += shareOf[s];
  for (let s = 0; s < S; s++) w[s] = shareOf[s] * S / shareSum;
  for (let pp = 0; pp < P; pp++) for (let s = 0; s < S; s++) {
    if (!cell[pp * S + s]) continue;
    // Epoch rescales each benchmark so random guessing reads 0.
    const f = IRT_FLOORS[c.benchIds[shareBench[s]]] ?? 0;
    I.push(pp); J.push(s); Y.push(clamp((norm[pp * S + s] / 100 - f) / (1 - f), 0, 1));
  }
  const cells = { n: P, k: S, I: Int32Array.from(I), J: Int32Array.from(J), Y: Float64Array.from(Y), w };
  const fit = cached<EciFit>("eci", [cells.I, cells.J, cells.Y, w, Int32Array.of(P, S)], () => fitEci(cells));
  const { scale, shift } = eciScale(c, P, pooled, fit);
  return (pp) => {
    const score = shift + scale * fit.capability[pp], half = Z95 * fit.se[pp] * scale;
    return { score, range: [score - half, score + half], theta: fit.capability[pp], se: fit.se[pp], used: fit.count[pp] };
  };
}

/** The linear map from fitted capability to the ECI scale, and whether Epoch's index set it. */
export function eciScale(c: Columns, P: number, pooled: Int32Array, fit: Pick<EciFit, "capability" | "count" | "slope">): { scale: number; shift: number; linked: number } {
  const b = c.benchIndex.get(EPOCH_ECI), xs: number[] = [], ys: number[] = [], need = Math.min(ECI_LINK_SCORES, fit.slope.length);
  if (b !== undefined) for (let pp = 0; pp < P; pp++) {
    const r = c.at[c.vIndex[pooled[pp]] * c.nb + b];
    if (r >= 0 && fit.count[pp] >= need && Number.isFinite(c.value[r])) { xs.push(fit.capability[pp]); ys.push(c.value[r]); }
  }
  const stats = (v: number[]) => { const mean = v.reduce((a, x) => a + x, 0) / v.length; return { mean, sd: Math.sqrt(v.reduce((a, x) => a + (x - mean) ** 2, 0) / v.length) }; };
  if (xs.length >= ECI_LINK_MIN) {
    const x = stats(xs), y = stats(ys);
    if (x.sd > 1e-9 && y.sd > 1e-9) return { scale: y.sd / x.sd, shift: y.mean - y.sd / x.sd * x.mean, linked: xs.length };
  }
  const all: number[] = [];
  for (let pp = 0; pp < P; pp++) if (fit.count[pp]) all.push(fit.capability[pp]);
  if (!all.length) return { scale: ECI_FALLBACK_SD, shift: ECI_FALLBACK_CENTER, linked: 0 };
  const sorted = [...all].sort((p, q) => p - q), median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const sd = stats(all).sd, scale = sd > 1e-9 ? ECI_FALLBACK_SD / sd : ECI_FALLBACK_SD;
  return { scale, shift: ECI_FALLBACK_CENTER - scale * median, linked: 0 };
}
