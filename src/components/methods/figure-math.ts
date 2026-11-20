/** Geometry for the figures on `/methods/scoring`, shared by the server-drawn ones and the one with a slider. No React, no DOM. */

/** A benchmark's fitted curve: expected score (0 to 100) = 100 * (floor + (1 - floor) * sigmoid(slope * (x - difficulty))). */
export type FigCurve = { id: string; name: string; slope: number; difficulty: number; floor: number; share: number };
/** One model somewhere on a figure. */
export type FigPoint = { name: string; x: number; y: number };

const sig = (z: number) => 1 / (1 + Math.exp(-z));
export const curveAt = (c: FigCurve, x: number) => 100 * (c.floor + (1 - c.floor) * sig(c.slope * (x - c.difficulty)));
/** The weighted average a model at `x` is expected to score across the mix. */
export const mixAt = (curves: FigCurve[], x: number) => curves.reduce((t, c) => t + c.share * curveAt(c, x), 0);

export interface Frame { w: number; h: number; l: number; r: number; t: number; b: number; x: [number, number]; y: [number, number]; sx: (v: number) => number; sy: (v: number) => number; line: (f: (x: number) => number, from?: number, to?: number) => string }

/** A plot area inside a `w` by `h` drawing: scales for both axes and a path builder for a function of x. */
export function frame(w: number, h: number, x: [number, number], y: [number, number], pad: { l?: number; r?: number; t?: number; b?: number } = {}): Frame {
  const l = pad.l ?? 34, r = pad.r ?? 10, t = pad.t ?? 22, b = pad.b ?? 40;
  const sx = (v: number) => l + (v - x[0]) / (x[1] - x[0]) * (w - l - r), sy = (v: number) => h - b - (v - y[0]) / (y[1] - y[0]) * (h - t - b);
  const line = (f: (x: number) => number, from = x[0], to = x[1]) => Array.from({ length: 97 }, (_, i) => { const v = from + (to - from) * i / 96; return `${i ? "L" : "M"}${sx(v).toFixed(1)} ${sy(f(v)).toFixed(1)}`; }).join("");
  return { w, h, l, r, t, b, x, y, sx, sy, line };
}

/** Round tick values covering [lo, hi] at about `count` steps. */
export function ticks(lo: number, hi: number, count: number): number[] {
  const raw = (hi - lo) / Math.max(1, count), mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
}

/**
 * Three curves worth pointing at: an easy one, the steepest, and the hardest. "Easy" skips curves flatter than the median, whose
 * halfway point says little. Fewer than three curves: all of them.
 */
export function pickThree(curves: FigCurve[]): FigCurve[] {
  if (curves.length <= 3) return [...curves].sort((a, b) => a.difficulty - b.difficulty);
  const byDifficulty = [...curves].sort((a, b) => a.difficulty - b.difficulty), slopes = curves.map((c) => c.slope).sort((a, b) => a - b), median = slopes[slopes.length >> 1];
  const hard = byDifficulty[byDifficulty.length - 1], easy = byDifficulty.find((c) => c !== hard && c.slope >= median) ?? byDifficulty[0];
  const steep = [...curves].sort((a, b) => b.slope - a.slope).find((c) => c !== easy && c !== hard)!;
  return [easy, steep, hard].sort((a, b) => a.difficulty - b.difficulty);
}

/** Of points along a line, the ones to name: the first, then each next one at least `gap` drawing units from every named one. */
export function spaced<T>(items: T[], at: (item: T) => [number, number], gap: number): T[] {
  const kept: T[] = [];
  for (const item of items) { const [x, y] = at(item); if (kept.every((k) => { const [kx, ky] = at(k); return Math.hypot(kx - x, ky - y) >= gap; })) kept.push(item); }
  return kept;
}
