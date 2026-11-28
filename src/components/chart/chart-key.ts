import type { Lab } from "@/data/types";
import { focusModelIds } from "@/lib/chart-focus";
import { chartLabel, modelLabel } from "@/lib/metrics";
import { effortKey, type ChartHidden } from "./chart-visibility";
import { LIGHT_PALETTE, markColor, type ChartPalette } from "./palette";
import type { ScatterPoint } from "./scatter-option";

/** One model as the chart sees it: its best effort stands for it. */
export type KeyModelRow = { id: string; name: string; labId: string; best: ScatterPoint; points: ScatterPoint[]; frontier: boolean };
/** A lab as the key names it. Labs that share the one neutral grey cannot be told apart, so they are one row. */
export type LabRow = { id: string; name: string; color: string; neutral: boolean; labIds: string[] };
/** Something taken off the chart: a whole model or one effort of it. `model` is undefined when the data no longer holds it. */
export type RemovedItem = { key: string; label: string; modelId: string; labId?: string; model?: KeyModelRow };

/** Labs with no colour of their own all carry the one grey markColor falls back to; compared with that fallback, never a literal. */
const NEUTRAL = markColor(undefined, LIGHT_PALETTE).toLowerCase();
export const isNeutralLab = (lab?: { color: string }) => !lab || lab.color.toLowerCase() === NEUTRAL;

/** Points grouped by model, best score first. */
export function groupModels(list: ScatterPoint[], onFrontier: Set<string>): KeyModelRow[] {
  const by = new Map<string, ScatterPoint[]>();
  for (const p of list) { const id = p.r.model.id, at = by.get(id); if (at) at.push(p); else by.set(id, [p]); }
  return [...by.values()].map((points) => {
    const best = points.reduce((a, b) => (b.r.score > a.r.score ? b : a));
    return { id: best.r.model.id, name: modelLabel(best.r), labId: best.r.model.labId, best, points, frontier: points.some((p) => onFrontier.has(p.r.variant.id)) };
  }).sort((a, b) => b.best.r.score - a.best.r.score);
}

/** At most eight rows in the key; the labs past that share one neutral row, like the grey ones already do. */
export function capRows<T extends { id: string; name: string; color: string; neutral?: boolean }>(rows: T[]): { id: string; name: string; color: string }[] {
  if (rows.length <= 8) return rows;
  const rest = rows.slice(7), other = rows.find((r) => r.neutral) ?? rest[0];
  return [...rows.slice(0, 7).filter((r) => !r.neutral), { id: "other", name: "Other", color: other.color }];
}

export type KeyDataInput = {
  /** Marks drawn after removals and "only Pareto". */ pts: ScatterPoint[];
  /** After the default trim, before removals. */ allPoints: ScatterPoint[];
  /** Every candidate before the default trim. */ chartPoints: ScatterPoint[];
  /** The default trim applies to this chart at all (not time charts, not hand-picked indices). */ canTrim: boolean;
  /** The default trim is on right now. */ trimmed: boolean;
  /** "All models" is on. */ allModels: boolean;
  hidden: ChartHidden; frontier: ScatterPoint[]; showFrontier: boolean;
  labs: Lab[]; pal: ChartPalette; better: "lower" | "higher";
  /** Models the person starred: the default trim keeps them. */ keep: string[];
  /** A name for a removed model the data no longer holds. */ nameOf?: (id: string) => string | undefined;
};

/** Everything the key says about a chart: the labs it draws, the models it leaves out, and how many the default trim holds back. */
export function keyData(i: KeyDataInput) {
  const onFrontier = new Set(i.showFrontier ? i.frontier.map((p) => p.r.variant.id) : []);
  const on = groupModels(i.pts, onFrontier);
  const visibleIds = new Set(i.allPoints.map((p) => p.r.model.id));
  // What the default trim holds back, known even while "all models" is on (so the way back can be named).
  const outside = i.chartPoints.filter((p) => !visibleIds.has(p.r.model.id));
  const trimmedModels = i.trimmed ? groupModels(outside, onFrontier) : [];
  let defaultOut = trimmedModels.length;
  if (!i.trimmed && i.allModels && i.canTrim) { const focus = focusModelIds(i.chartPoints, i.better, i.keep); defaultOut = [...new Set(i.chartPoints.map((p) => p.r.model.id))].filter((id) => !focus.has(id)).length; }
  // What the person removed: a model dropped whole, or one effort of a model that stays.
  const pool = [...i.allPoints, ...outside], nameOfId = (id: string) => i.nameOf?.(id) ?? id;
  const removed: RemovedItem[] = [];
  for (const id of i.hidden.models) {
    const mine = pool.filter((p) => p.r.model.id === id), m = mine.length ? groupModels(mine, onFrontier)[0] : undefined;
    removed.push({ key: `m:${id}`, label: m?.name ?? nameOfId(id), modelId: id, labId: m?.labId, model: m });
  }
  for (const k of i.hidden.efforts) {
    const id = k.split("@")[0];
    if (i.hidden.models.includes(id)) continue;
    const p = pool.find((x) => effortKey(x) === k);
    removed.push({ key: `e:${k}`, label: p ? chartLabel(p.r) : nameOfId(id), modelId: id, labId: p?.r.model.labId, model: p ? groupModels([p], onFrontier)[0] : undefined });
  }
  // Labs on the chart, best first (the order of the ranking beside it). The neutral grey ones merge into one row.
  const byLab = new Map<string, LabRow & { best: number }>();
  for (const m of on) {
    const lab = i.labs.find((l) => l.id === m.labId), neutral = isNeutralLab(lab), id = neutral ? "other" : m.labId;
    const row = byLab.get(id) ?? { id, name: neutral ? "Other" : lab!.name, color: markColor(neutral ? undefined : lab!.color, i.pal, id), neutral, best: -Infinity, labIds: [] };
    row.best = Math.max(row.best, m.best.r.score);
    if (!row.labIds.includes(m.labId)) row.labIds.push(m.labId);
    byLab.set(id, row);
  }
  const labRows: LabRow[] = [...byLab.values()].sort((a, b) => (a.neutral ? 1 : 0) - (b.neutral ? 1 : 0) || b.best - a.best).map((r) => ({ id: r.id, name: r.name, color: r.color, neutral: r.neutral, labIds: r.labIds }));
  return { on, trimmedModels, removed, labRows, defaultOut };
}
export type KeyData = ReturnType<typeof keyData>;
