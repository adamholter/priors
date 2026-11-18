import { TASK_METRIC_SOURCES, taskMetricData, taskMetricDescription, type TaskMetric, type TaskMetricSource } from "@/data/task-metrics";
import type { Snapshot } from "@/data/types";

export interface AATaskMetric { description: string; /** What one measurement is: a turn, a trial, a task run. */ per: string; /** Value by Artificial Analysis slug: US dollars, or seconds. */ models: Record<string, number> }
export interface AATaskSource { id: TaskMetricSource; name: string; cost?: AATaskMetric; time?: AATaskMetric }
export interface AATaskMetrics { date: string; generatedAt: string; sources: AATaskSource[] }

const AA_MODEL = /^https:\/\/artificialanalysis\.ai\/models\/([a-z0-9][a-z0-9._-]*)\/?$/i;
const PER: Partial<Record<TaskMetricSource, string>> = { "t3-code": "turn", "terminalbench-4": "trial", "deepswe-1.1": "task run", "frontierswe-v2": "trial" };
const MIN_MODELS = 5;
const round = (n: number) => +n.toPrecision(5);

/**
 * Priors' other measurements of cost and time, keyed by the configuration's slug on artificialanalysis.ai, so the AA Plus
 * extension can draw AA's cost and time charts from them. Read at `/api/aa-task-metrics`. AA's own figures are on its page already.
 */
export function aaTaskMetrics(snapshot: Snapshot): AATaskMetrics {
  const slugs = new Map<string, Set<string>>();
  const add = (variantId: string, url?: string) => { const slug = url?.match(AA_MODEL)?.[1]; if (slug) (slugs.get(variantId) ?? slugs.set(variantId, new Set()).get(variantId)!).add(slug); };
  for (const o of snapshot.observations) add(o.variantId, o.sourceUrl);
  for (const v of snapshot.variants) for (const m of [v.sourceModel, ...(v.sourceModels ?? [])]) add(v.id, m?.url);
  const metric = (source: TaskMetricSource, kind: TaskMetric): AATaskMetric | undefined => {
    const data = taskMetricData(snapshot, source, kind), models: Record<string, number> = {};
    for (const [variantId, found] of slugs) {
      const value = data.get(variantId)?.value;
      if (value != null) for (const slug of found) models[slug] = round(value);
    }
    return Object.keys(models).length >= MIN_MODELS ? { description: taskMetricDescription(source, kind, snapshot.date), per: PER[source] ?? "task", models } : undefined;
  };
  const sources = TASK_METRIC_SOURCES.filter((s) => s.id !== "aa").flatMap((s): AATaskSource[] => {
    const cost = metric(s.id, "cost"), time = metric(s.id, "time");
    return cost || time ? [{ id: s.id, name: s.name, ...(cost ? { cost } : {}), ...(time ? { time } : {}) }] : [];
  });
  return { date: snapshot.date, generatedAt: snapshot.generatedAt, sources };
}
