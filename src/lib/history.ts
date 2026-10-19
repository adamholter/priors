import { readdir } from "node:fs/promises";
import path from "node:path";
import { loadSnapshot, readSnapshot } from "@/data/load";
import { applyOpenWeights } from "@/data/open-weights";
import { computeIndex, rankingRows, type IndexConfig } from "@/engine";
import { TOP, type HistoryData, type HistoryFrame } from "./history-frames";

/** A benchmark counts for "adapting" once this many models have a published score for it. */
export const MIN_MODELS = 8;
const KEEP = TOP + 5;

export async function snapshotDates(): Promise<string[]> {
  const files = await readdir(path.resolve(process.cwd(), "data/snapshots")).catch(() => [] as string[]);
  return files.map((f) => f.match(/^(\d{4}-\d{2}-\d{2})\.json\.gz$/)?.[1]).filter((d): d is string => !!d).sort();
}

const cache = new Map<string, Promise<HistoryData>>();
/**
 * The ranking on every snapshot date. "fixed" scores each day with today's index exactly as written (a
 * benchmark not yet published that day simply has no scores). "adapting" also drops, per day, the
 * benchmarks fewer than MIN_MODELS models had scores for, so a half-filled benchmark doesn't steer the
 * ranking and the shares go to the benchmarks that were established then.
 */
export function computeHistory(config: IndexConfig, mode: "fixed" | "adapting", key: string): Promise<HistoryData> {
  const k = `${key}|${mode}`;
  let p = cache.get(k);
  if (!p) {
    p = build(config, mode);
    cache.set(k, p);
    if (cache.size > 24) cache.delete(cache.keys().next().value!);
    p.catch(() => cache.delete(k));
  }
  return p;
}

async function build(config: IndexConfig, mode: "fixed" | "adapting"): Promise<HistoryData> {
  const frames: HistoryFrame[] = [];
  const labs = new Map<string, { id: string; name: string; color: string }>();
  const ids = Object.keys(config.weights).filter((id) => config.weights[id] > 0);
  // Older snapshots predate the open-weights flag: take it from today's models (a model's weights don't change).
  const flags = new Map<string, boolean>();
  for (const m of (await loadSnapshot())?.models ?? []) if (m.openWeights !== undefined) flags.set(m.id, m.openWeights);
  // The build's dated files stop at its deploy; today's live copy supplies the newest frame.
  const live = await loadSnapshot();
  const dates = await snapshotDates();
  if (live && !dates.includes(live.date)) dates.push(live.date);
  for (const date of dates) {
    const snap = live && date === live.date ? { ...live } : await readSnapshot(date);
    if (!snap) continue;
    snap.models = applyOpenWeights(snap, flags).models;
    const counts = new Map<string, Set<string>>();
    for (const o of snap.observations) if (config.weights[o.benchmarkId] > 0 && !o.details?.priorsEstimate) (counts.get(o.benchmarkId) ?? counts.set(o.benchmarkId, new Set()).get(o.benchmarkId)!).add(o.variantId);
    const established = ids.filter((id) => (counts.get(id)?.size ?? 0) >= MIN_MODELS);
    const weights = mode === "adapting" && established.length ? Object.fromEntries(established.map((id) => [id, config.weights[id]])) : config.weights;
    const required = (config.required ?? []).filter((id) => weights[id] !== undefined);
    const result = computeIndex(snap, { ...config, weights, required, variants: "all" });
    const ranked = rankingRows(result.ranked, config).filter((r) => Number.isFinite(r.score));
    const best: { open?: number; closed?: number } = {};
    for (const r of ranked) {
      const k = r.model.openWeights === true ? "open" : r.model.openWeights === false ? "closed" : undefined;
      if (k && (best[k] === undefined || r.score > best[k]!)) best[k] = +r.score.toFixed(2);
    }
    const rows = ranked.slice(0, KEEP)
      .map((r) => ({ id: r.variant.id, modelId: r.model.id, name: r.model.name, effort: r.variant.effort, labId: r.model.labId, score: +r.score.toFixed(2), ...(r.model.openWeights !== undefined ? { open: r.model.openWeights } : {}) }));
    for (const l of snap.labs) if (rows.some((r) => r.labId === l.id)) labs.set(l.id, { id: l.id, name: l.name, color: l.color });
    frames.push({ date, rows, best, used: Object.keys(weights).filter((id) => (counts.get(id)?.size ?? 0) >= MIN_MODELS).length, of: ids.length, models: result.ranked.length });
  }
  const shown = frames.flatMap((f) => f.rows.slice(0, TOP).map((r) => r.score));
  const lo = shown.length ? Math.min(...shown) : 0, hi = shown.length ? Math.max(...shown) : 100;
  return { name: config.name, mode, frames, labs: [...labs.values()], domain: [Math.max(0, Math.floor((lo - 4) / 5) * 5), Math.min(100, Math.ceil((hi + 1) / 5) * 5)] };
}
