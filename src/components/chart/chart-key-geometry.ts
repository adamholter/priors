import type { CSSProperties } from "react";
import type { ECharts } from "echarts";
import type { ScatterPoint } from "./scatter-option";

export type Rect = { x: number; y: number; width: number; height: number };
export type Pt = { x: number; y: number };
export type Box = { x: number; y: number; w: number; h: number };
export type Corner = "tl" | "tr" | "bl" | "br";

/** The plot's rectangle in the chart's own pixels (the same read the chart's guide layer makes). */
export function gridRect(c: ECharts | null): Rect | undefined {
  if (!c || c.isDisposed()) return undefined;
  try { return (c as unknown as { getModel(): { getComponent(n: string, i: number): { coordinateSystem?: { getRect(): Rect } } | undefined } }).getModel().getComponent("grid", 0)?.coordinateSystem?.getRect(); } catch { return undefined; }
}
/** Where a mark is (or would be) in the chart's pixels. Undefined until the chart has laid out. */
export function pxOf(c: ECharts | null, p: Pick<ScatterPoint, "x" | "r">): Pt | undefined {
  if (!c || c.isDisposed()) return undefined;
  try { const [x, y] = c.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [p.x, p.r.score]) as number[]; return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : undefined; } catch { return undefined; }
}

const INSET = 12;
/** The corner of the plot with the fewest marks under a w by h box, so a key can sit there without covering data. */
export function emptiestCorner(marks: Pt[], g: Rect | undefined, w: number, h: number, skip: Corner[] = []): Corner {
  if (!g) return "tl";
  const boxes: Record<Corner, Rect> = {
    tl: { x: g.x + INSET, y: g.y + INSET, width: w, height: h }, br: { x: g.x + g.width - INSET - w, y: g.y + g.height - INSET - h, width: w, height: h },
    tr: { x: g.x + g.width - INSET - w, y: g.y + INSET, width: w, height: h }, bl: { x: g.x + INSET, y: g.y + g.height - INSET - h, width: w, height: h },
  };
  // Names stick out to the right of a mark, so count a mark's label as the strip right of it.
  const count = (b: Rect) => marks.filter((m) => m.x > b.x - 6 && m.x < b.x + b.width + 70 && m.y > b.y - 8 && m.y < b.y + b.height + 8).length;
  const order: Corner[] = ["tl", "br", "tr", "bl"];
  return order.filter((c) => !skip.includes(c)).map((c) => ({ c, n: count(boxes[c]) })).sort((a, b) => a.n - b.n)[0]?.c ?? "tl";
}
/** CSS for a box sitting in a corner of the plot's own rectangle (so it clears the axes), within the overlay layer. */
export function cornerStyle(g: Rect | undefined, width: number, height: number, corner: Corner): CSSProperties {
  if (!g) return { left: INSET, top: INSET };
  return {
    ...(corner[1] === "l" ? { left: g.x + INSET } : { right: width - (g.x + g.width) + INSET }),
    ...(corner[0] === "t" ? { top: g.y + INSET } : { bottom: height - (g.y + g.height) + INSET }),
  };
}

const hits = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** A name's width, estimated from its length: close enough to keep two names apart. */
export const textWidth = (s: string, size: number) => s.length * size * 0.56 + 4;

export type GhostAt = { id: string; name: string; score: number; x: number; y: number };
export type NamePlace = { x: number; y: number; flip: boolean };
/**
 * Where each left-out model's name goes. A ghost is named when it is the only one previewed, or when its name clears the marks,
 * the chart's own labels, the other rings and the names already placed; the rest stay as plain rings. `solid` is everything a
 * name must stay clear of besides other ghosts. Best score first, so the strongest model gets the free space.
 */
export function placeGhostNames(ghosts: GhostAt[], solid: Box[], grid: Rect, width: number, size: number, single: boolean): Map<string, NamePlace> {
  const out = new Map<string, NamePlace>(), placed: Box[] = [];
  const rings = ghosts.map((g) => ({ id: g.id, box: { x: g.x - 6, y: g.y - 6, w: 12, h: 12 } as Box }));
  const inside = (b: Box) => b.x >= grid.x - 4 && b.x + b.w <= width - 2 && b.y >= grid.y - 2 && b.y + b.h <= grid.y + grid.height + 2;
  for (const g of [...ghosts].sort((a, b) => b.score - a.score)) {
    const w = textWidth(g.name, size);
    const cost = (b: Box) => (inside(b) ? 0 : 50) + [...solid, ...rings.filter((r) => r.id !== g.id).map((r) => r.box), ...placed].filter((o) => hits(b, o)).length * 10;
    const best = [false, true].map((flip) => { const box: Box = { x: flip ? g.x - 9 - w : g.x + 9, y: g.y - 8, w, h: 16 }; return { flip, box, cost: cost(box) }; }).sort((a, b) => a.cost - b.cost)[0];
    if (single || best.cost === 0) { out.set(g.id, { x: g.x + (best.flip ? -9 : 9), y: g.y, flip: best.flip }); placed.push(best.box); }
  }
  return out;
}
