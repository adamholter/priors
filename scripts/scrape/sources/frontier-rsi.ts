/**
 * FrontierRSI (Abundant, frontier-rsi.org): can an agent do the research and engineering that improves AI? 27 open-ended tasks on real GPUs
 * across pre-training, agentic post-training, inference and GPU kernels, two trials each. A trial's reward is relative to the best valid trial
 * from any model on that task: the best scores 1 and 10% or more worse scores 0. The site's `data.js` holds every task's results, and the score
 * here is computed as its page does: the mean over tasks of each model's avg@2. Each task area is a variant. Published costs cover all trials,
 * so `costUsd` is the cost per trial, given only when none of that model's cost is imputed or estimated. A model missing a task is left out.
 */
import type { Benchmark, RawRow, ScrapeResult, Source } from "../../../src/data/types";

export const FRONTIER_RSI_ID = "frontier-rsi";
const SITE = "https://frontier-rsi.org/";
type Row = { model: string; harness?: string; effort?: string; avg: number | null; trials?: unknown[] };
type Task = { id: string; category: string; models: Row[] };
type Cost = { total_usd?: number; tasks_with_cost?: number; tasks_imputed?: number; trials_without_cost?: number; estimated?: number; rebuilt?: number };
export type RsiData = { categories: { id: string; name: string; blurb?: string }[]; tasks: Task[]; models: Record<string, { lab?: string; cost?: Cost }>; stats?: { tasks?: number } };

/** `window.FRSI = {...};` holds plain JSON. */
export function readRsiData(js: string): RsiData {
  const start = js.indexOf("{"), end = js.lastIndexOf("}");
  if (!/window\.FRSI\s*=/.test(js) || start < 0 || end < start) throw new Error("FrontierRSI: data file changed");
  const data = JSON.parse(js.slice(start, end + 1)) as RsiData;
  if (!data.tasks?.length || !data.categories?.length) throw new Error("FrontierRSI: no tasks");
  if (data.stats?.tasks != null && data.stats.tasks !== data.tasks.length) throw new Error(`FrontierRSI: ${data.tasks.length} tasks, the site says ${data.stats.tasks}`);
  return data;
}

const scoreOf = (tasks: Task[], model: string) => {
  const found = tasks.map((t) => t.models.find((r) => r.model === model));
  return found.every((r) => typeof r?.avg === "number") ? +(found.reduce((sum, r) => sum + r!.avg!, 0) / tasks.length * 100).toFixed(2) : null;
};

export function parseFrontierRsi(data: RsiData): { rows: RawRow[]; benchmarks: Benchmark[]; skipped: string[] } {
  const models = [...new Set(data.tasks.flatMap((t) => t.models.map((r) => r.model)))], rows: RawRow[] = [], skipped: string[] = [];
  const base = { sourceId: "frontier-rsi", url: SITE, unit: "percent", higherIsBetter: true, category: "science", categories: ["science", "coding", "agentic"], normalization: { kind: "linear", min: 0, max: 100 }, eligibleForDefault: false, defaultWeight: 0 } satisfies Partial<Benchmark>;
  const benchmarks: Benchmark[] = [{ ...base, id: FRONTIER_RSI_ID, name: "FrontierRSI", shortName: "FrontierRSI", description: `${data.tasks.length} open-ended AI research and engineering tasks on real GPUs, two trials each. Each trial is scored against the best result any model reached on that task.` }];
  const areas = data.categories.map((c) => ({ ...c, id: `${FRONTIER_RSI_ID}-${c.id}`, source: c.id, tasks: data.tasks.filter((t) => t.category === c.id) })).filter((c) => c.tasks.length);
  for (const a of areas) benchmarks.push({ ...base, id: a.id, name: `FrontierRSI: ${a.name}`, shortName: `RSI ${a.name}`, description: a.blurb ?? a.name, variantOf: FRONTIER_RSI_ID, variantLabel: a.name });
  for (const model of models) {
    const value = scoreOf(data.tasks, model), first = data.tasks.flatMap((t) => t.models).find((r) => r.model === model)!;
    if (value == null) { skipped.push(model); continue; }
    const meta = data.models[model], cost = meta?.cost, trials = data.tasks.reduce((n, t) => n + (t.models.find((r) => r.model === model)?.trials?.length ?? 0), 0);
    const clean = cost && cost.total_usd! > 0 && cost.tasks_with_cost === data.tasks.length && !cost.tasks_imputed && !cost.trials_without_cost && !cost.estimated && !cost.rebuilt && trials > 0;
    const common = { modelLabel: model, effort: first.effort, labHint: meta?.lab, harness: first.harness, sourceUrl: SITE };
    const byArea = Object.fromEntries(areas.map((a) => [a.source, scoreOf(a.tasks, model)]));
    rows.push({ ...common, benchmarkId: FRONTIER_RSI_ID, value, ...(clean ? { costUsd: +(cost.total_usd! / trials).toFixed(4) } : {}), note: `avg@2 over ${data.tasks.length} tasks in ${first.harness ?? "its harness"}`, details: { trials, totalCostUsd: cost?.total_usd, costMeasured: !!clean, areas: byArea } });
    for (const a of areas) { const v = byArea[a.source]; if (v != null) rows.push({ ...common, benchmarkId: a.id, value: v, note: `avg@2 over ${a.tasks.length} ${a.name} tasks` }); }
  }
  return { rows, benchmarks, skipped };
}

const source: Source = {
  id: "frontier-rsi", name: "FrontierRSI", url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const js = await ctx.fetchText(`${SITE}data.js`), data = readRsiData(js), { rows, benchmarks, skipped } = parseFrontierRsi(data);
    if (rows.filter((r) => r.benchmarkId === FRONTIER_RSI_ID).length < 5) throw new Error("FrontierRSI: fewer than 5 complete models");
    return { benchmarks, rows, raw: { "data.js": js }, notes: [`${rows.filter((r) => r.benchmarkId === FRONTIER_RSI_ID).length} models over ${data.tasks.length} tasks${skipped.length ? `; incomplete: ${skipped.join(", ")}` : ""}`] };
  },
};
export default source;
