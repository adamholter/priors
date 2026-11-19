/** Test data for the fits (./irt.test.ts, ./eci.test.ts): scores drawn from a known two-parameter model with noise, 70% of cells observed. */
function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
export const corr = (x: ArrayLike<number>, y: ArrayLike<number>) => {
  const n = x.length, mx = Array.from(x).reduce((a, b) => a + b) / n, my = Array.from(y).reduce((a, b) => a + b) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxy / Math.sqrt(sxx * syy);
};

export function synthetic(n = 120, k = 12, seed = 7) {
  const r = rng(seed), gauss = () => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
  const theta = Array.from({ length: n }, gauss), a = Array.from({ length: k }, () => 1 + r()), b = Array.from({ length: k }, () => gauss() * 1.5);
  const I: number[] = [], J: number[] = [], Y: number[] = [], hidden: [number, number, number][] = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) {
    const y = Math.min(1, Math.max(0, 1 / (1 + Math.exp(-a[j] * (theta[i] - b[j]))) + gauss() * 0.03));
    if (r() < 0.7) { I.push(i); J.push(j); Y.push(y); } else hidden.push([i, j, y]);
  }
  return { cells: { n, k, I: Int32Array.from(I), J: Int32Array.from(J), Y: Float64Array.from(Y) }, theta, a, b, hidden };
}
