/** Drag-to-zoom math for scatter charts. Pure, so the pixel-to-data mapping is tested without a chart. */
export type ZoomScale = "linear" | "log" | "time";
export type Range = [number, number];
/** A zoom window in data space: x as plotted (cost, seconds, a timestamp), y as the score. Always lo < hi. */
export interface ZoomBox { x: Range; y: Range }
export interface Rect { x: number; y: number; width: number; height: number }
/** A drag shorter than this (px, along both axes) is a click, not a zoom. */
export const MIN_DRAG = 6;

const fwd = (v: number, s: ZoomScale) => (s === "log" ? Math.log10(v) : v);
const inv = (v: number, s: ZoomScale) => (s === "log" ? 10 ** v : v);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const sorted = (a: number, b: number): Range => (a <= b ? [a, b] : [b, a]);

/** The data value at pixel `px` on an axis that draws `domain` from pixel `p0` to `p1` (interpolated in log space on a log axis). */
export function pixelToValue(px: number, p0: number, p1: number, domain: Range, scale: ZoomScale = "linear") {
  const t = (px - p0) / (p1 - p0), a = fwd(domain[0], scale), b = fwd(domain[1], scale);
  return inv(a + t * (b - a), scale);
}

/**
 * Two drag corners in chart pixels to a data window. `grid` is the plot rectangle, `xDomain` and `yDomain` what the axes draw
 * now (y grows upward while pixels grow downward). The corners are clamped to the plot. Returns null for a click (the drag
 * moved less than MIN_DRAG on both axes). A box that is thin along one axis keeps that axis's range, so a flat sweep zooms x only.
 */
export function pixelBoxToDomain(a: { x: number; y: number }, b: { x: number; y: number }, grid: Rect, xDomain: Range, yDomain: Range, xScale: ZoomScale = "linear"): ZoomBox | null {
  const x0 = grid.x, x1 = grid.x + grid.width, y0 = grid.y + grid.height, y1 = grid.y;
  const [ax, bx] = sorted(clamp(a.x, x0, x1), clamp(b.x, x0, x1)), [top, bottom] = sorted(clamp(a.y, y1, y0), clamp(b.y, y1, y0));
  const wide = bx - ax >= MIN_DRAG, tall = bottom - top >= MIN_DRAG;
  if (!wide && !tall) return null;
  const x: Range = wide ? [pixelToValue(ax, x0, x1, xDomain, xScale), pixelToValue(bx, x0, x1, xDomain, xScale)] : [xDomain[0], xDomain[1]];
  const y: Range = tall ? [pixelToValue(bottom, y0, y1, yDomain), pixelToValue(top, y0, y1, yDomain)] : [yDomain[0], yDomain[1]];
  return { x, y };
}

/** The window widened by `frac` of its span on each side (in log space on a log axis), so marks on the edge are not cut in half. A score window that starts at or above 0 is not padded below 0. */
export function padBox(box: ZoomBox, xScale: ZoomScale = "linear", frac = 0.04): ZoomBox {
  const pad = (r: Range, s: ZoomScale): Range => { const a = fwd(r[0], s), b = fwd(r[1], s), d = (b - a) * frac; return [inv(a - d, s), inv(b + d, s)]; };
  const y = pad(box.y, "linear");
  return { x: pad(box.x, xScale), y: [box.y[0] >= 0 ? Math.max(0, y[0]) : y[0], y[1]] };
}

export const inBox = (x: number, y: number, box: ZoomBox) => x >= box.x[0] && x <= box.x[1] && y >= box.y[0] && y <= box.y[1];

/** The smallest window holding both (used while animating, so marks entering or leaving stay drawn until they are off the plot). */
export const unionBox = (a: ZoomBox, b: ZoomBox): ZoomBox => ({ x: [Math.min(a.x[0], b.x[0]), Math.max(a.x[1], b.x[1])], y: [Math.min(a.y[0], b.y[0]), Math.max(a.y[1], b.y[1])] });

/** A step of `t` (0 to 1) from one window to another, moving evenly in log space on a log axis. */
export function lerpBox(from: ZoomBox, to: ZoomBox, t: number, xScale: ZoomScale = "linear"): ZoomBox {
  const l = (a: number, b: number, s: ZoomScale) => inv(fwd(a, s) + (fwd(b, s) - fwd(a, s)) * t, s);
  return { x: [l(from.x[0], to.x[0], xScale), l(from.x[1], to.x[1], xScale)], y: [l(from.y[0], to.y[0], "linear"), l(from.y[1], to.y[1], "linear")] };
}

/** Round "nice" steps (1, 2, 5 x 10^k) for a linear range, about `count` of them. */
export function linearTicks(lo: number, hi: number, count = 5): number[] {
  if (!(hi > lo)) return [];
  const raw = (hi - lo) / count, mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toPrecision(12));
  return out;
}

/**
 * Ticks for a zoomed log axis. ECharts puts log ticks only on powers of ten, so a window inside one decade would show one
 * label or none. Tries 10^k, then 1-2-5, then 1-2-3-5, then every digit, and takes the first set with at least three ticks
 * (capped at `max`); a window too narrow for any of them falls back to linear steps.
 */
export function logTicks(lo: number, hi: number, max = 7): number[] {
  if (!(lo > 0) || !(hi > lo)) return [];
  const sets = [[1], [1, 2, 5], [1, 2, 3, 5], [1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9]];
  for (const set of sets) {
    const out: number[] = [];
    for (let k = Math.floor(Math.log10(lo)); k <= Math.ceil(Math.log10(hi)); k++) for (const m of set) { const v = +(m * 10 ** k).toPrecision(12); if (v >= lo * (1 - 1e-9) && v <= hi * (1 + 1e-9)) out.push(v); }
    if (out.length >= 3 && out.length <= max) return out;
    if (out.length > max) return out.filter((_, i) => i % Math.ceil(out.length / max) === 0);
  }
  return linearTicks(lo, hi, 4);
}
