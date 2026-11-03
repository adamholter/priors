import { bundledSnapshotDates } from "./runtime-files";
import { loadHistoryArchive, loadSnapshot, readSnapshot } from "@/data/load";
import { columnsOf } from "@/data/columns";
import { applyOpenWeights } from "@/data/open-weights";
import { rankingRows, rankScores, type IndexConfig } from "@/engine";
import type { Lab } from "@/data/types";
import { TOP, type HistoryData, type HistoryFrame } from "./history-frames";

/** A benchmark counts for "adapting" once this many models have a published score for it. */
export const MIN_MODELS = 8;
const KEEP = TOP + 5;

export const snapshotDates = bundledSnapshotDates;

/**
 * The ranking on every snapshot date. "fixed" scores each day with today's index exactly as written (a
 * benchmark not yet published that day simply has no scores). "adapting" also drops, per day, the
 * benchmarks fewer than MIN_MODELS models had scores for, so a half-filled benchmark doesn't steer the
 * ranking and the shares go to the benchmarks that were established then.
 */
export async function computeHistory(config: IndexConfig, mode: "fixed" | "adapting"): Promise<HistoryData> {
  const frames: HistoryFrame[] = [];
  const labs = new Map<string, Lab>();
  const ids = Object.keys(config.weights).filter((id) => config.weights[id] > 0);
  // The build's dated files stop at its deploy; today's live copy supplies the newest frame.
  const live = await loadSnapshot();
  // Older snapshots predate the open-weights flag: take it from today's models (a model's weights don't change).
  const flags = new Map<string, boolean>();
  for (const m of live?.models ?? []) if (m.openWeights !== undefined) flags.set(m.id, m.openWeights);
  const archive = await loadHistoryArchive(), walker = archive?.walk(flags);
  const dates = [...new Set([...await snapshotDates(), ...archive?.dates ?? [], ...live ? [live.date] : []])].sort();
  for (const date of dates) {
    let day = live && date === live.date ? undefined : walker?.frame(date);
    if (!day) {
      // Today, or a date the archive lacks.
      const snap = live && date === live.date ? live : await readSnapshot(date);
      if (!snap) continue;
      day = { date, columns: { ...columnsOf(snap), models: applyOpenWeights(snap, flags).models }, labs: snap.labs };
    }
    const { columns: c, labs: dayLabs } = day;
    const count = (id: string) => { const b = c.benchIndex.get(id); return b === undefined ? 0 : c.counted[b]; };
    const established = ids.filter((id) => count(id) >= MIN_MODELS);
    const weights = mode === "adapting" && established.length ? Object.fromEntries(established.map((id) => [id, config.weights[id]])) : config.weights;
    const required = (config.required ?? []).filter((id) => weights[id] !== undefined);
    const result = rankScores(c, { ...config, weights, required, variants: "all" });
    const ranked = rankingRows(result, config).filter((r) => Number.isFinite(r.score));
    const best: { open?: number; closed?: number } = {};
    for (const r of ranked) {
      const k = r.model.openWeights === true ? "open" : r.model.openWeights === false ? "closed" : undefined;
      if (k && (best[k] === undefined || r.score > best[k]!)) best[k] = +r.score.toFixed(2);
    }
    const rows = ranked.slice(0, KEEP)
      .map((r) => ({ id: r.variant.id, modelId: r.model.id, name: r.model.name, effort: r.variant.effort, labId: r.model.labId, score: +r.score.toFixed(2), ...(r.model.openWeights !== undefined ? { open: r.model.openWeights } : {}) }));
    for (const l of dayLabs) if (rows.some((r) => r.labId === l.id)) labs.set(l.id, { id: l.id, name: l.name, color: l.color });
    frames.push({ date, rows, best, used: Object.keys(weights).filter((id) => count(id) >= MIN_MODELS).length, of: ids.length, models: result.length });
  }
  const shown = frames.flatMap((f) => f.rows.slice(0, TOP).map((r) => r.score));
  const lo = shown.length ? Math.min(...shown) : 0, hi = shown.length ? Math.max(...shown) : 100;
  return { name: config.name, mode, frames, labs: [...labs.values()], domain: [Math.max(0, Math.floor((lo - 4) / 5) * 5), Math.min(100, Math.ceil((hi + 1) / 5) * 5)] };
}
