/**
 * Gradient search for lineup fits.
 *
 * Weights are a softmax over benchmark logits; each model's surrogate score is its weighted
 * mean over measured benchmarks (plus a per-model correction learned from the exact engine).
 * The loss is a smoothed, rank-weighted hinge on every pair in the lineup. A high temperature
 * early gives large, coarse steps while the order is far off; it anneals toward a sharp hinge.
 * Adam with minibatched pairs and early gradient noise keeps it stochastic across restarts.
 */

export type SgdColumn = { id: string; score: number[]; present: boolean[] };
export type SgdOptions = { floor: number; bonus?: number[]; offsets?: number[]; inits?: Record<string, number>[]; seed?: number; steps?: number; restarts?: number; margin?: number };

const rng = (seed: number) => () => ((seed = Math.imul(seed ^ (seed >>> 15), 1 | seed)), ((seed + Math.imul(seed ^ (seed >>> 7), 61 | seed)) ^ seed) >>> 0) / 4294967296;
const softplus = (x: number) => (x > 30 ? x : Math.log1p(Math.exp(x)));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

function softmax(theta: Float64Array) {
  let max = -Infinity; for (const t of theta) max = Math.max(max, t);
  const w = new Float64Array(theta.length); let sum = 0;
  for (let i = 0; i < theta.length; i++) { w[i] = Math.exp(theta[i] - max); sum += w[i]; }
  for (let i = 0; i < w.length; i++) w[i] /= sum;
  return w;
}

/** One annealed Adam run from the given logits. Returns final normalized weights and the sharp loss. */
function descend(cols: SgdColumn[], n: number, theta: Float64Array, o: Required<Pick<SgdOptions, "floor" | "steps" | "margin">> & { bonus: number[]; offsets: number[] }, rand: () => number) {
  const B = cols.length, m1 = new Float64Array(B), m2 = new Float64Array(B);
  const pairs: [number, number, number][] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j, (j === i + 1 ? 2 : 1) / (i + 1)]);
  const pairTotal = pairs.reduce((s, p) => s + p[2], 0);
  const s = new Float64Array(n), D = new Float64Array(n), ds = new Float64Array(n), g = new Float64Array(B);
  for (let step = 0; step < o.steps; step++) {
    const t = step / o.steps, tau = 6 * Math.pow(0.05, t), lr = 0.35 * (1 - 0.8 * t);
    const w = softmax(theta);
    for (let m = 0; m < n; m++) {
      let num = 0, den = 0;
      for (let b = 0; b < B; b++) if (cols[b].present[m]) { num += w[b] * cols[b].score[m]; den += w[b]; }
      D[m] = den; s[m] = den > 1e-12 ? num / den : 0;
    }
    ds.fill(0); g.fill(0);
    for (const [i, j, c] of pairs) {
      if (t < 0.6 && rand() < 0.35) continue;
      const gap = s[i] + o.offsets[i] - s[j] - o.offsets[j];
      const d = c / pairTotal * sigmoid((o.margin - gap) / tau);
      ds[i] -= d; ds[j] += d;
    }
    for (let b = 0; b < B; b++) {
      let acc = 0;
      for (let m = 0; m < n; m++) if (cols[b].present[m] && D[m] > 1e-12) acc += ds[m] * (cols[b].score[m] - s[m]) / D[m];
      // Coverage floor: each model's measured share must reach the floor.
      for (let m = 0; m < n; m++) if (D[m] < o.floor && cols[b].present[m]) acc -= 0.5;
      g[b] = acc + 0.004 / Math.sqrt(w[b] + 1e-4) - (o.bonus[b] ?? 0) * 1e-4;
    }
    let mean = 0; for (let b = 0; b < B; b++) mean += w[b] * g[b];
    for (let b = 0; b < B; b++) {
      let grad = w[b] * (g[b] - mean) * B;
      if (t < 0.4) grad += (rand() - 0.5) * 0.02 * (1 - t / 0.4);
      m1[b] = 0.9 * m1[b] + 0.1 * grad; m2[b] = 0.999 * m2[b] + 0.001 * grad * grad;
      const mh = m1[b] / (1 - Math.pow(0.9, step + 1)), vh = m2[b] / (1 - Math.pow(0.999, step + 1));
      theta[b] -= lr * mh / (Math.sqrt(vh) + 1e-8);
    }
  }
  const w = softmax(theta);
  let loss = 0;
  for (let m = 0; m < n; m++) { let num = 0, den = 0; for (let b = 0; b < B; b++) if (cols[b].present[m]) { num += w[b] * cols[b].score[m]; den += w[b]; } s[m] = den ? num / den + o.offsets[m] : -1e9; }
  for (const [i, j, c] of pairs) loss += c * softplus((o.margin - (s[i] - s[j])) / 0.3);
  return { w, loss };
}

/** Candidate mixes (full and sparsified) from several annealed restarts, best first. */
export function sgdCandidates(cols: SgdColumn[], n: number, opts: SgdOptions): Record<string, number>[] {
  const B = cols.length; if (!B || n < 2) return [];
  const o = { floor: opts.floor, steps: opts.steps ?? 260, margin: opts.margin ?? 1.5, bonus: opts.bonus ?? [], offsets: opts.offsets ?? new Array(n).fill(0) };
  const rand = rng((opts.seed ?? 1) * 2654435761 + 7);
  const starts: Float64Array[] = [];
  for (const init of opts.inits ?? []) { const th = new Float64Array(B); const max = Math.max(1e-9, ...Object.values(init)); cols.forEach((c, b) => { th[b] = Math.log((init[c.id] ?? 0) / max + 0.02); }); starts.push(th); }
  starts.push(new Float64Array(B));
  const restarts = Math.max(starts.length, opts.restarts ?? 6);
  while (starts.length < restarts) { const th = new Float64Array(B); for (let b = 0; b < B; b++) th[b] = rand() < 0.35 ? 1 + rand() * 2 : -2 * rand(); starts.push(th); }
  const runs = starts.map((th) => descend(cols, n, th, o, rand)).sort((a, b) => a.loss - b.loss);
  const out: Record<string, number>[] = [], seen = new Set<string>();
  const push = (w: Float64Array, keep: number) => {
    const order = [...w.keys()].sort((a, b) => w[b] - w[a]).filter((b) => w[b] > 0.01).slice(0, keep);
    if (!order.length) return;
    const top = w[order[0]], mix = Object.fromEntries(order.map((b) => [cols[b].id, Math.max(0.1, Math.round(w[b] / top * 1000) / 10)]));
    const key = JSON.stringify(mix); if (!seen.has(key)) { seen.add(key); out.push(mix); }
  };
  for (const r of runs.slice(0, 3)) for (const k of [12, 8, 5, 3]) push(r.w, k);
  return out;
}
