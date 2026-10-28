/**
 * The Intelligence Index's weights, recovered from AA's own numbers: least squares of each model's published index
 * on its component scores (0-100), rounded to whole percents. AA publishes whole-percent weights that sum to 100;
 * the fit is accepted only when the rounded weights do and they reproduce AA's scores closely. Anything else returns
 * undefined, so a version Priors cannot reproduce is never presented as one it can.
 */
export interface WeightFit { weights: number[]; n: number; median: number; max: number }

export function fitIndexWeights(rows: { x: number[]; y: number }[], tolerance = { median: 0.15, max: 1.5 }): WeightFit | undefined {
  const k = rows[0]?.x.length ?? 0;
  if (!k || rows.length < k + 5) return undefined;
  // Normal equations (XᵀX) w = Xᵀy, solved by Gaussian elimination with partial pivoting.
  const a = Array.from({ length: k }, (_, i) => [...Array.from({ length: k }, (_, j) => rows.reduce((s, r) => s + r.x[i] * r.x[j], 0)), rows.reduce((s, r) => s + r.x[i] * r.y, 0)]);
  for (let c = 0; c < k; c++) {
    let p = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    if (Math.abs(a[p][c]) < 1e-9) return undefined; // components that move together cannot be told apart
    [a[c], a[p]] = [a[p], a[c]];
    for (let r = 0; r < k; r++) if (r !== c) { const f = a[r][c] / a[c][c]; for (let j = c; j <= k; j++) a[r][j] -= f * a[c][j]; }
  }
  const weights = a.map((row, i) => Math.round(row[k] / row[i] * 100));
  if (weights.some((w) => w < 0) || weights.reduce((s, w) => s + w, 0) !== 100) return undefined;
  const miss = rows.map((r) => Math.abs(r.x.reduce((s, x, i) => s + x * weights[i] / 100, 0) - r.y)).sort((p, q) => p - q);
  const fit = { weights, n: rows.length, median: miss[Math.floor(miss.length / 2)], max: miss[miss.length - 1] };
  return fit.median <= tolerance.median && fit.max <= tolerance.max ? fit : undefined;
}
