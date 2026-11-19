/**
 * Two-parameter item response model for continuous scores (0 to 1), fitted by alternating Fisher scoring.
 *
 *   expected score of model i on benchmark j = floor_j + (1 - floor_j) * sigmoid(a_j * (theta_i - b_j))
 *
 * theta_i is the model's ability, b_j the benchmark's difficulty (the ability that scores halfway between the
 * floor and 100), a_j its slope. The loss is fractional binary cross-entropy (a quasi-binomial likelihood) with
 * weak priors that pin the scale: theta ~ N(0, 1), log a ~ N(0, 1), b ~ N(0, 3). Each sweep refits every
 * benchmark's two parameters with the abilities held still, then every ability with the benchmarks held still;
 * each block is a small convex problem, so a few dozen sweeps converge. Deterministic: the start is computed from
 * the data and nothing is random. The engine's "irt" scoring method fits it (`fitScoring` in ./scoring.ts).
 */

export interface IrtCells {
  /** Model count and benchmark count. */
  n: number; k: number;
  /** One entry per observed cell: model index, benchmark index, score as a proportion (0 to 1). */
  I: Int32Array; J: Int32Array; Y: Float64Array;
  /** Per benchmark: the score a model with no ability gets (chance on multiple choice). Default 0. */
  floor?: Float64Array;
}

export interface IrtFit {
  theta: Float64Array; a: Float64Array; b: Float64Array; floor: Float64Array;
  /** Per model: how many cells it was fitted on, and its ability's standard error from the Fisher information. */
  count: Int32Array; se: Float64Array;
  sweeps: number;
}

export interface IrtOptions { sweeps?: number; tol?: number; thetaSd?: number; slopeSd?: number; difficultySd?: number }

const EPS = 1e-6, Y_CLAMP = 1e-3;
const sig = (z: number) => 1 / (1 + Math.exp(-z));

export function fitIrt(cells: IrtCells, opts: IrtOptions = {}): IrtFit {
  const { n, k, I, J } = cells, m = I.length;
  const sweeps = opts.sweeps ?? 200, tol = opts.tol ?? 1e-5;
  const tPrec = 1 / (opts.thetaSd ?? 1) ** 2, aPrec = 1 / (opts.slopeSd ?? 1) ** 2, bPrec = 1 / (opts.difficultySd ?? 3) ** 2;
  const floor = cells.floor ?? new Float64Array(k);
  const Y = new Float64Array(m);
  for (let c = 0; c < m; c++) Y[c] = Math.min(1 - Y_CLAMP, Math.max(Y_CLAMP, cells.Y[c]));
  const theta = new Float64Array(n), alpha = new Float64Array(k), b = new Float64Array(k);
  const count = new Int32Array(n);
  for (let c = 0; c < m; c++) count[I[c]]++;

  // Start each ability at its mean score in log-odds against the benchmarks' mean, so the first item fit is sensible.
  const colSum = new Float64Array(k), colN = new Float64Array(k), rowSum = new Float64Array(n);
  for (let c = 0; c < m; c++) { colSum[J[c]] += Y[c]; colN[J[c]]++; }
  for (let c = 0; c < m; c++) { const y = Y[c], mean = colSum[J[c]] / colN[J[c]]; rowSum[I[c]] += Math.log(y / (1 - y)) - Math.log(mean / (1 - mean)); }
  for (let i = 0; i < n; i++) theta[i] = count[i] ? Math.max(-3, Math.min(3, rowSum[i] / count[i] / (1 + 1 / Math.max(1, count[i])))) : 0;
  for (let j = 0; j < k; j++) { const mean = colN[j] ? colSum[j] / colN[j] : 0.5; b[j] = -Math.log(Math.max(EPS, mean - floor[j]) / Math.max(EPS, 1 - mean)); }

  // Gradient and Fisher information accumulators.
  const g1 = new Float64Array(Math.max(n, k)), g2 = new Float64Array(k), h11 = new Float64Array(Math.max(n, k)), h12 = new Float64Array(k), h22 = new Float64Array(k);
  // dL/dz and the Fisher weight (dp/dz)^2 / (p (1 - p)) of a cell.
  let gz = 0, wz = 0;
  const cell = (c: number, z: number) => {
    const j = J[c], s = sig(z), f = floor[j], p = Math.min(1 - EPS, Math.max(EPS, f + (1 - f) * s));
    const dp = (1 - f) * s * (1 - s), v = p * (1 - p);
    gz = (p - Y[c]) * dp / v; wz = dp * dp / v;
  };

  let sweep = 0;
  for (; sweep < sweeps; sweep++) {
    let moved = 0;
    // Benchmarks: (log a, b) with the abilities fixed. z = a (theta - b); dz/dlog a = z, dz/db = -a.
    g1.fill(0, 0, k); g2.fill(0); h11.fill(0, 0, k); h12.fill(0); h22.fill(0);
    for (let c = 0; c < m; c++) {
      const j = J[c], a = Math.exp(alpha[j]), z = a * (theta[I[c]] - b[j]);
      cell(c, z);
      g1[j] += gz * z; g2[j] += -gz * a;
      h11[j] += wz * z * z; h12[j] += -wz * a * z; h22[j] += wz * a * a;
    }
    for (let j = 0; j < k; j++) {
      const G1 = g1[j] + alpha[j] * aPrec, G2 = g2[j] + b[j] * bPrec;
      const A = h11[j] + aPrec, B = h12[j], D = h22[j] + bPrec, det = A * D - B * B;
      if (!(det > 0)) continue;
      const da = Math.max(-0.5, Math.min(0.5, (D * G1 - B * G2) / det)), db = Math.max(-1, Math.min(1, (A * G2 - B * G1) / det));
      alpha[j] -= da; b[j] -= db; moved = Math.max(moved, Math.abs(da), Math.abs(db));
    }
    // Abilities with the benchmarks fixed. dz/dtheta = a.
    g1.fill(0, 0, n); h11.fill(0, 0, n);
    for (let c = 0; c < m; c++) {
      const j = J[c], a = Math.exp(alpha[j]), i = I[c];
      cell(c, a * (theta[i] - b[j]));
      g1[i] += gz * a; h11[i] += wz * a * a;
    }
    for (let i = 0; i < n; i++) {
      const step = Math.max(-1, Math.min(1, (g1[i] + theta[i] * tPrec) / (h11[i] + tPrec)));
      theta[i] -= step; moved = Math.max(moved, Math.abs(step));
    }
    if (moved < tol) { sweep++; break; }
  }
  const se = new Float64Array(n);
  for (let i = 0; i < n; i++) se[i] = 1 / Math.sqrt(h11[i] + tPrec);
  const a = alpha.map(Math.exp);
  return { theta, a, b, floor, count, se, sweeps: sweep };
}

/** Expected score (0 to 1) of ability `theta` on benchmark `j`. */
export function irtExpected(fit: Pick<IrtFit, "a" | "b" | "floor">, j: number, theta: number): number {
  const f = fit.floor[j];
  return f + (1 - f) * sig(fit.a[j] * (theta - fit.b[j]));
}

/** How hard a benchmark pulls on ability: its slope squared times the score variance at the pool's middle, as a share of the total. */
export function irtPull(fit: Pick<IrtFit, "a" | "b" | "floor">, theta: ArrayLike<number>): Float64Array {
  const k = fit.a.length, out = new Float64Array(k);
  let total = 0;
  for (let j = 0; j < k; j++) {
    let info = 0;
    for (let i = 0; i < theta.length; i++) { const s = sig(fit.a[j] * (theta[i] - fit.b[j])), f = fit.floor[j], p = f + (1 - f) * s; info += ((1 - f) * s * (1 - s) * fit.a[j]) ** 2 / Math.max(EPS, p * (1 - p)); }
    out[j] = info; total += info;
  }
  for (let j = 0; j < k; j++) out[j] = total ? out[j] / total : 0;
  return out;
}

/** Chance floors for multiple-choice benchmarks, as proportions. A benchmark not listed has floor 0. */
export const IRT_FLOORS: Record<string, number> = {
  "aa-gpqa-diamond": 0.25, "epoch-gpqa-diamond": 0.25, "vals-gpqa": 0.25, "aa-mmlu-pro": 0.1, "vals-mmlu-pro": 0.1, "aa-mmmu-pro": 0.1,
};

