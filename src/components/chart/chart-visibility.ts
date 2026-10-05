import type { ScatterPoint } from "./scatter-option";

export type ChartHidden = { efforts: string[]; models: string[] };
export const EMPTY_HIDDEN: ChartHidden = { efforts: [], models: [] };
// Source-qualified variants of the same effort are one model/effort combination.
export const effortKey = (p: ScatterPoint) => `${p.r.model.id}@${p.r.variant.effort}`;
export function visiblePoints(points: ScatterPoint[], hidden: ChartHidden) {
  const efforts = new Set(hidden.efforts), models = new Set(hidden.models);
  return points.filter(p => !models.has(p.r.model.id) && !efforts.has(effortKey(p)));
}
export function hideChartPoint(hidden: ChartHidden, p: ScatterPoint, wholeModel = false): ChartHidden {
  return wholeModel
    ? { ...hidden, models: [...new Set([...hidden.models, p.r.model.id])] }
    : { ...hidden, efforts: [...new Set([...hidden.efforts, effortKey(p)])] };
}
