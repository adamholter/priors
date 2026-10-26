/**
 * Margin-maximizing linear program for lineup fits.
 *
 * A mix's surrogate score is a weighted mean of single-benchmark scores, so "every model
 * above the next one" is a set of linear constraints on the weights. Renormalizing over a
 * model's measured benchmarks equals filling its gaps with its own mean, so missing cells
 * are imputed with the model's current score and the LP is re-solved a few times.
 */

/** Dense simplex for: maximize c·x subject to A x ≤ b, x ≥ 0, with b ≥ 0 (origin feasible). Bland's rule. */
export function simplex(A: number[][], b: number[], c: number[], maxIter = 5000): { x: number[]; value: number } | null {
  const m = A.length, n = c.length, width = n + m + 1;
  const T = A.map((row, i) => { const r = new Float64Array(width); r.set(row); r[n + i] = 1; r[width - 1] = b[i]; return r; });
  const z = new Float64Array(width); for (let j = 0; j < n; j++) z[j] = -c[j];
  const basis = Array.from({ length: m }, (_, i) => n + i);
  for (let iter = 0; iter < maxIter; iter++) {
    let col = -1;
    for (let j = 0; j < width - 1; j++) if (z[j] < -1e-10) { col = j; break; }
    if (col < 0) break;
    let row = -1, best = Infinity;
    for (let i = 0; i < m; i++) {
      const a = T[i][col];
      if (a > 1e-10) { const ratio = T[i][width - 1] / a; if (ratio < best - 1e-12 || (Math.abs(ratio - best) <= 1e-12 && basis[i] < basis[row])) { best = ratio; row = i; } }
    }
    if (row < 0) return null;
    const pivot = T[row][col];
    for (let j = 0; j < width; j++) T[row][j] /= pivot;
    for (let i = 0; i < m; i++) if (i !== row && T[i][col] !== 0) { const f = T[i][col]; for (let j = 0; j < width; j++) T[i][j] -= f * T[row][j]; }
    if (z[col] !== 0) { const f = z[col]; for (let j = 0; j < width; j++) z[j] -= f * T[row][j]; }
    basis[row] = col;
  }
  const x = new Array(n).fill(0);
  for (let i = 0; i < m; i++) if (basis[i] < n) x[basis[i]] = T[i][width - 1];
  return { x, value: z[width - 1] };
}

const SHIFT = 200;

/** `present`: the cell has a value (measured or estimated). `measured`: counts toward the coverage floor (defaults to present). */
export type LpColumn = { id: string; score: number[]; present: boolean[]; measured?: boolean[] };

/** Scores of each lineup model under normalized weights (renormalized over present cells). */
export function lpScores(columns: LpColumn[], w: number[], models: number) {
  const out: number[] = [];
  for (let m = 0; m < models; m++) {
    let num = 0, den = 0;
    for (let k = 0; k < columns.length; k++) if (w[k] > 0 && columns[k].present[m]) { num += w[k] * columns[k].score[m]; den += w[k]; }
    out.push(den ? num / den : NaN);
  }
  return out;
}

/**
 * Finds weights maximizing the smallest gap between consecutive lineup models.
 * `floor` is the measured-share floor each model must meet; `bonus` gently prefers benchmarks.
 * Returns the margin (index points) and weights by column id; margin ≤ 0 means no strict order.
 */
export function maxMarginMix(columns: LpColumn[], models: number, floor: number, bonus: number[] = []): { margin: number; weights: Record<string, number> } | null {
  const n = columns.length; if (!n || models < 2) return null;
  const mean = (m: number) => { let s = 0, k = 0; for (const c of columns) if (c.present[m]) { s += c.score[m]; k++; } return k ? s / k : 0; };
  let fill = Array.from({ length: models }, (_, m) => mean(m));
  let best: { margin: number; weights: Record<string, number> } | null = null;
  // Fully measured columns are exactly linear; solve them alone as well as with imputation.
  const full = columns.filter((c) => c.present.every(Boolean));
  if (full.length && full.length < columns.length) best = maxMarginMix(full, models, 0, full.map((c) => bonus[columns.indexOf(c)] ?? 0));
  for (let round = 0; round < 4; round++) {
    const cell = (k: number, m: number) => columns[k].present[m] ? columns[k].score[m] : fill[m];
    const A: number[][] = [], b: number[] = [];
    // u − Σ w_k (s_i,k − s_i+1,k + M) ≤ 0 for each neighbouring pair (variable n is u).
    // With Σw = 1 this is gap ≥ u − M, so the origin stays feasible and an infeasible order
    // still yields the least-bad smallest gap instead of the trivial w = 0.
    for (let i = 0; i + 1 < models; i++) { const row = columns.map((_, k) => cell(k, i + 1) - cell(k, i) - SHIFT); row.push(1); A.push(row); b.push(0); }
    // Measured share ≥ floor: Σ w_k (floor − present) ≤ 0.
    if (floor > 0) for (let m = 0; m < models; m++) { const row = columns.map((c) => floor - ((c.measured ?? c.present)[m] ? 1 : 0)); if (row.some((v) => v > 0)) { row.push(0); A.push(row); b.push(0); } }
    A.push([...columns.map(() => 1), 0]); b.push(1);
    const res = simplex(A, b, [...columns.map((_, k) => (bonus[k] ?? 0) * 1e-3), 1]);
    if (!res) return best;
    const w = res.x.slice(0, n), sum = w.reduce((a, v) => a + v, 0);
    if (sum <= 1e-9) return best;
    const norm = w.map((v) => v / sum);
    const scores = lpScores(columns, norm, models);
    let margin = Infinity; for (let i = 0; i + 1 < models; i++) margin = Math.min(margin, (scores[i] - scores[i + 1]) || -Infinity);
    const weights: Record<string, number> = {}; norm.forEach((v, k) => { if (v > 1e-4) weights[columns[k].id] = v; });
    if (!best || margin > best.margin) best = { margin, weights };
    if (columns.every((c) => c.present.every(Boolean))) break;
    fill = scores.map((s, m) => Number.isFinite(s) ? s : fill[m]);
  }
  return best;
}

/**
 * A ladder of progressively sparser max-margin mixes: drops the lightest benchmark and
 * re-solves on the remaining support while a positive margin survives.
 */
export function sparseMixes(columns: LpColumn[], models: number, floor: number, bonus: number[] = [], maxBench = 12): { margin: number; weights: Record<string, number> }[] {
  const out: { margin: number; weights: Record<string, number> }[] = [];
  let pool = columns, bon = bonus;
  for (let guard = 0; guard < columns.length; guard++) {
    const r = maxMarginMix(pool, models, floor, bon);
    if (!r || r.margin <= 0) break;
    const ids = Object.entries(r.weights).sort((a, b) => b[1] - a[1]).map(([id]) => id);
    if (ids.length <= maxBench) out.push(r);
    if (ids.length <= 1) break;
    const keep = new Set(ids.slice(0, ids.length - 1));
    const idx = pool.map((c, k) => keep.has(c.id) ? k : -1).filter((k) => k >= 0);
    pool = idx.map((k) => pool[k]); bon = idx.map((k) => bon[k] ?? 0);
  }
  return out;
}
