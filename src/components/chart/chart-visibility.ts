import type { ScatterPoint } from "./scatter-option";

export type ChartHidden = { efforts: string[]; models: string[] };
export const EMPTY_HIDDEN: ChartHidden = { efforts: [], models: [] };

/** One `ch` entry per chart: [anchor, model ids, model@effort keys]. Other charts stay independent. */
function hiddenEntry(value: string): [string, ChartHidden] | undefined {
  try {
    const entry: unknown = JSON.parse(value);
    if (!Array.isArray(entry) || entry.length !== 3 || typeof entry[0] !== "string" || !Array.isArray(entry[1]) || !Array.isArray(entry[2])) return;
    const ids = (values: unknown[]) => [...new Set(values.filter((id): id is string => typeof id === "string" && !!id))];
    return [entry[0], { models: ids(entry[1]), efforts: ids(entry[2]) }];
  } catch { return; }
}
export function readChartHidden(params: URLSearchParams, anchor: string | undefined): ChartHidden {
  if (!anchor) return EMPTY_HIDDEN;
  const entry = params.getAll("ch").map(hiddenEntry).findLast(entry => entry?.[0] === anchor);
  return entry?.[1] ?? EMPTY_HIDDEN;
}
export function setChartHidden(url: URL, anchor: string, hidden: ChartHidden) {
  const others = url.searchParams.getAll("ch").filter(value => hiddenEntry(value)?.[0] !== anchor);
  url.searchParams.delete("ch");
  for (const value of others) url.searchParams.append("ch", value);
  if (hidden.models.length || hidden.efforts.length) url.searchParams.append("ch", JSON.stringify([anchor, hidden.models, hidden.efforts]));
  return url;
}
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
