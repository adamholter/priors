/**
 * An ECI-style fit, after Epoch AI's Epoch Capabilities Index (epoch.ai/benchmarks/eci):
 *
 *   expected score of model m on benchmark b = sigmoid(slope_b * (capability_m - difficulty_b))
 *
 * One capability per model, a difficulty and a slope per benchmark. Fitted the way Epoch fitted the index until
 * November 4, 2026 (epoch.ai/publications/eci-bayesian-methodology describes both methods): least squares on the scores with
 * a ridge penalty of 0.1 / (M + 2B - 2) on every parameter, slopes held to 0.1..10. Epoch's live index now samples a Bayesian
 * version of the same curve; that takes minutes, and this has to run as a slider moves.
 *
 * What Priors adds: each benchmark's squared errors are multiplied by `w`, its weight in the mix (mean 1), so a benchmark
 * with twice the weight pulls twice as hard on the capabilities. With equal weights this is Epoch's loss.
 *
 * Alternating damped Gauss-Newton: each sweep refits every benchmark's two parameters with the capabilities held still, then
 * every capability with the benchmarks held still, and a sweep that raises the loss is undone and retried with more damping.
 * Deterministic: the start is computed from the data and nothing is random.
 */

export interface EciCells {
  /** Model count and benchmark count. */
  n: number; k: number;
  /** One entry per score: model index, benchmark index, score as a proportion (0 to 1, chance already taken out). */
  I: Int32Array; J: Int32Array; Y: Float64Array;
  /** Per benchmark: how much its errors count. Default 1. */
  w?: Float64Array;
}

export interface EciFit {
  capability: Float64Array; difficulty: Float64Array; slope: Float64Array;
  /** Per model: how many scores it was fitted on, and its capability's standard error (weighted least squares, sandwich form). */
  count: Int32Array; se: Float64Array;
  /** Residual variance of a score under the fit, and the loss it ended on. */
  sigma2: number; loss: number; sweeps: number;
}

/** Epoch clips scores to this range before fitting. */
const Y_MIN = 0.001, Y_MAX = 0.999, SLOPE_MIN = 0.1, SLOPE_MAX = 10, RIDGE = 0.1;
const sig = (z: number) => 1 / (1 + Math.exp(-z));
const clip = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function fitEci(cells: EciCells, opts: { sweeps?: number; tol?: number } = {}): EciFit {
  const { n, k, I, J } = cells, m = I.length, sweeps = opts.sweeps ?? 400, tol = opts.tol ?? 1e-12;
  const w = cells.w ?? new Float64Array(k).fill(1);
  const Y = new Float64Array(m), count = new Int32Array(n);
  for (let c = 0; c < m; c++) { Y[c] = clip(cells.Y[c], Y_MIN, Y_MAX); count[I[c]]++; }
  let models = 0;
  for (let i = 0; i < n; i++) if (count[i]) models++;
  const lambda = RIDGE / Math.max(1, models + 2 * k - 2);

  // Start: each benchmark's difficulty from its mean score, each capability from its scores' mean log-odds against those means.
  let C = new Float64Array(n), D = new Float64Array(k), A = new Float64Array(k).fill(1);
  const colSum = new Float64Array(k), colN = new Float64Array(k), rowSum = new Float64Array(n);
  for (let c = 0; c < m; c++) { colSum[J[c]] += Y[c]; colN[J[c]]++; }
  for (let j = 0; j < k; j++) { const mean = colN[j] ? colSum[j] / colN[j] : 0.5; D[j] = -Math.log(mean / (1 - mean)); }
  for (let c = 0; c < m; c++) rowSum[I[c]] += Math.log(Y[c] / (1 - Y[c])) + D[J[c]];
  for (let i = 0; i < n; i++) C[i] = count[i] ? clip(rowSum[i] / (count[i] + 1), -4, 4) : 0;

  const lossOf = (C: Float64Array, D: Float64Array, A: Float64Array) => {
    let data = 0, ridge = 0;
    for (let c = 0; c < m; c++) { const j = J[c], r = sig(A[j] * (C[I[c]] - D[j])) - Y[c]; data += w[j] * r * r; }
    for (let j = 0; j < k; j++) ridge += A[j] * A[j] + D[j] * D[j];
    for (let i = 0; i < n; i++) ridge += C[i] * C[i];
    return data + lambda * ridge;
  };
  const g1 = new Float64Array(Math.max(n, k)), g2 = new Float64Array(k), h11 = new Float64Array(Math.max(n, k)), h12 = new Float64Array(k), h22 = new Float64Array(k);
  let loss = lossOf(C, D, A), mu = 1e-3, sweep = 0, still = 0;
  for (; sweep < sweeps && still < 3 && mu < 1e9; sweep++) {
    const C2 = Float64Array.from(C), D2 = Float64Array.from(D), A2 = Float64Array.from(A);
    // Benchmarks: (slope, difficulty) with the capabilities fixed. p = sig(a (C - D)); dp/da = p(1-p)(C - D), dp/dD = -p(1-p) a.
    g1.fill(0, 0, k); g2.fill(0); h11.fill(0, 0, k); h12.fill(0); h22.fill(0);
    for (let c = 0; c < m; c++) {
      const j = J[c], d = C2[I[c]] - D2[j], p = sig(A2[j] * d), q = p * (1 - p), r = p - Y[c], da = q * d, dd = -q * A2[j];
      g1[j] += r * da; g2[j] += r * dd; h11[j] += da * da; h12[j] += da * dd; h22[j] += dd * dd;
    }
    for (let j = 0; j < k; j++) {
      const G1 = w[j] * g1[j] + lambda * A2[j], G2 = w[j] * g2[j] + lambda * D2[j];
      const H11 = (w[j] * h11[j] + lambda) * (1 + mu) + 1e-12, H12 = w[j] * h12[j], H22 = (w[j] * h22[j] + lambda) * (1 + mu) + 1e-12, det = H11 * H22 - H12 * H12;
      if (!(det > 0)) continue;
      A2[j] = clip(A2[j] - clip((H22 * G1 - H12 * G2) / det, -1, 1), SLOPE_MIN, SLOPE_MAX);
      D2[j] -= clip((H11 * G2 - H12 * G1) / det, -2, 2);
    }
    // Capabilities with the benchmarks fixed. dp/dC = p(1-p) a.
    g1.fill(0, 0, n); h11.fill(0, 0, n);
    for (let c = 0; c < m; c++) {
      const j = J[c], i = I[c], p = sig(A2[j] * (C2[i] - D2[j])), dc = p * (1 - p) * A2[j];
      g1[i] += w[j] * (p - Y[c]) * dc; h11[i] += w[j] * dc * dc;
    }
    for (let i = 0; i < n; i++) if (count[i]) C2[i] -= clip((g1[i] + lambda * C2[i]) / ((h11[i] + lambda) * (1 + mu) + 1e-12), -2, 2);
    regauge(C2, D2, A2, count);
    const next = lossOf(C2, D2, A2);
    if (next <= loss) {
      still = loss - next <= tol * (1 + loss) ? still + 1 : 0;
      C = C2; D = D2; A = A2; loss = next; mu = Math.max(mu / 3, 1e-9);
    } else mu *= 4;
  }

  // Standard errors: sigma^2 * sum(w^2 dp^2) / (sum(w dp^2) + ridge)^2, sigma^2 the residual variance of a score.
  let rss = 0;
  const hw = new Float64Array(n), hww = new Float64Array(n);
  for (let c = 0; c < m; c++) {
    const j = J[c], i = I[c], p = sig(A[j] * (C[i] - D[j])), dc = p * (1 - p) * A[j], r = p - Y[c];
    rss += r * r; hw[i] += w[j] * dc * dc; hww[i] += w[j] * w[j] * dc * dc;
  }
  const sigma2 = rss / Math.max(1, m - models - 2 * k);
  const se = new Float64Array(n);
  for (let i = 0; i < n; i++) se[i] = count[i] ? Math.sqrt(sigma2 * hww[i]) / (hw[i] + lambda) : Infinity;
  return { capability: C, difficulty: D, slope: A, count, se, sigma2, loss, sweeps: sweep };
}

/**
 * Shifting every capability and difficulty together, or stretching them while dividing the slopes, changes no prediction;
 * only the ridge penalty tells such fits apart, and block updates crawl toward its choice. This jumps there: the shift and
 * stretch with the smallest penalty, the stretch limited so slopes stay in bounds. Models with no scores stay at 0.
 */
function regauge(C: Float64Array, D: Float64Array, A: Float64Array, count: Int32Array) {
  let sum = 0, terms = D.length, slopes = 0, lo = 0, hi = Infinity;
  for (let j = 0; j < D.length; j++) { sum += D[j]; slopes += A[j] * A[j]; lo = Math.max(lo, A[j] / SLOPE_MAX); hi = Math.min(hi, A[j] / SLOPE_MIN); }
  for (let i = 0; i < C.length; i++) if (count[i]) { sum += C[i]; terms++; }
  const t = terms ? sum / terms : 0;
  let spread = 0;
  for (let j = 0; j < D.length; j++) spread += (D[j] - t) ** 2;
  for (let i = 0; i < C.length; i++) if (count[i]) spread += (C[i] - t) ** 2;
  const k = spread > 1e-12 && slopes > 0 ? clip((slopes / spread) ** 0.25, lo, hi) : 1;
  for (let j = 0; j < D.length; j++) { D[j] = (D[j] - t) * k; A[j] = clip(A[j] / k, SLOPE_MIN, SLOPE_MAX); }
  for (let i = 0; i < C.length; i++) if (count[i]) C[i] = (C[i] - t) * k;
}

/** Expected score (0 to 1) of capability `x` on benchmark `j`. */
export const eciExpected = (fit: Pick<EciFit, "slope" | "difficulty">, j: number, x: number) => sig(fit.slope[j] * (x - fit.difficulty[j]));
