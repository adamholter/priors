import { axisOf, type Mark, type Summary } from "./metric-summary";

/** Geometry of the contact sheet's small charts: pure, so the hover can snap to the same positions the SVG draws. */

export const PAD = 4;
/** Room under a release-date thumbnail for its two end labels. */
export const AXIS_H = 13;
export type ThumbKind = "scatter" | "bars" | "radar" | "stream";
export const thumbKind = (id: string): ThumbKind => id === "tpt" || id === "date" ? "scatter" : id === "strengths" ? "radar" : id === "usage" ? "stream" : "bars";

export interface Placed { m: Mark; x: number; y: number; bw?: number; bh?: number }

/** Where every mark of a metric sits in a w by h thumbnail, on the metric's own axis. `mini` is a sparkline: no end labels, lower minimum bar. */
export function placeMarks(s: Summary, w: number, h: number, mini = false): Placed[] {
  const kind = thumbKind(s.id), ax = axisOf(s), iw = w - 2 * PAD, axis = s.id === "date" && !mini ? AXIS_H : 0, ih = h - 2 * PAD - axis;
  if (kind === "scatter") {
    let lo = Infinity, hi = -Infinity;
    for (const m of s.marks) { lo = Math.min(lo, m.score); hi = Math.max(hi, m.score); }
    const span = hi - lo || 1;
    return s.marks.map((m) => ({ m, x: PAD + ax(m.x) * iw, y: PAD + (1 - (m.score - lo) / span) * ih }));
  }
  if (kind === "bars") {
    // Every model with data, best first: the rest in grey, the top ten in their lab colors.
    const order = new Map(s.marks.map((m, i) => [m, i])), list = [...s.byModel.values()].sort((a, b) => order.get(a)! - order.get(b)!);
    const uptime = s.id === "uptime", n = list.length;
    // A sparkline that cannot fit n bars with gaps packs them edge to edge, so nothing runs past the thumbnail.
    const gap = uptime ? (mini ? 3 : 8) : mini ? (iw / n >= 3 ? 1 : 0) : n > 40 ? 1 : 2, bw = Math.max(0.3, uptime ? Math.min(mini ? 8 : 28, (iw - gap * (n - 1)) / n) : (iw - gap * (n - 1)) / n);
    const hOf = (m: Mark) => s.id === "speed" ? 0.06 + 0.94 * (m.x / s.hi) : 0.12 + 0.88 * ax(m.x);
    const floor = mini ? 2 : 4;
    return list.map((m, i) => { const bh = Math.max(floor, hOf(m) * ih); return { m, x: PAD + i * (bw + gap) + bw / 2, y: PAD + ih - bh, bw, bh }; });
  }
  return [];
}

/** The mark nearest a pointer at (x, y) within the thumbnail, or null when none is close enough. */
export function nearestMark(placed: Placed[], kind: ThumbKind, x: number, y: number, h: number): Mark | null {
  let best: Placed | null = null, bd = Infinity;
  for (const p of placed) {
    const d = kind === "bars" ? Math.abs(p.x - x) + (y < p.y - 14 || y > h ? 99 : 0) : Math.hypot(p.x - x, p.y - y);
    if (d < bd) { bd = d; best = p; }
  }
  return best && bd <= (kind === "bars" ? Math.max(8, (best.bw ?? 8) / 2 + 2) : 10) ? best.m : null;
}

/** Pareto frontier of a scatter (lower is better on x): the marks no other mark beats on both axes. */
export function frontier(placed: Placed[]) {
  const sorted = [...placed].sort((a, b) => a.x - b.x || b.m.score - a.m.score);
  let best = -Infinity;
  return sorted.filter((p) => (p.m.score > best ? ((best = p.m.score), true) : false));
}

/** Radar polygon: spokes at equal angles, each model's rank on a benchmark is its radius (a missing one sits near the centre). */
export function radarPath(points: { r: number | null }[], cx: number, cy: number, R: number) {
  const n = points.length;
  return points.map((p, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n, r = (p.r ?? 0.1) * R; return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`; }).join(" ");
}
