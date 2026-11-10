import { aaComponentWeights, aaIndexName } from "@/data/aa-index";
import type { Snapshot } from "@/data/types";

export interface AAStrengthAxis {
  id: string; name: string; label: string; description: string; unit: string; higherIsBetter: boolean;
  /** This evaluation's share of the index, in percent. */
  share: number;
  /** The field: the lowest, highest and median score among the model configurations Artificial Analysis has scored on it. */
  min: number; max: number; median: number;
}
export interface AAStrengths {
  date: string; generatedAt: string;
  /** "Artificial Analysis Index v5.0.1": whatever version the snapshot's newest index is. */
  index: string;
  axes: AAStrengthAxis[];
  /** Each configuration's score per axis (same order as `axes`, null where unscored), keyed by its slug on artificialanalysis.ai. */
  models: Record<string, (number | null)[]>;
}

const AA_MODEL = /^https:\/\/artificialanalysis\.ai\/models\/([a-z0-9][a-z0-9._-]*)\/?$/i;
const round = (n: number) => +n.toPrecision(6);

/**
 * The evaluations inside Artificial Analysis's Intelligence Index, with every configuration's score on each:
 * what a strengths radar of that index needs. The evaluation list and its weights come from the snapshot
 * (they follow AA's index version), so nothing here names a benchmark. Read at `/api/aa-strengths`.
 */
export function aaStrengths(snapshot: Snapshot): AAStrengths {
  const head = { date: snapshot.date, generatedAt: snapshot.generatedAt, index: aaIndexName(snapshot) };
  const weights = aaComponentWeights(snapshot);
  const ids = weights ? Object.keys(weights).filter((id) => weights[id] > 0) : [];
  if (!weights || ids.length < 3) return { ...head, axes: [], models: {} };
  const column = new Map(ids.map((id, i) => [id, i])), total = ids.reduce((sum, id) => sum + weights[id], 0);
  // A configuration's slug is on the rows that link to its model page (the index itself, cost, speed); the evaluations link to their own pages.
  const slugs = new Map<string, Set<string>>();
  for (const o of snapshot.observations) {
    const slug = o.sourceUrl?.match(AA_MODEL)?.[1];
    if (slug) (slugs.get(o.variantId) ?? slugs.set(o.variantId, new Set()).get(o.variantId)!).add(slug);
  }
  const models: Record<string, (number | null)[]> = {};
  for (const o of snapshot.observations) {
    const i = column.get(o.benchmarkId);
    if (i === undefined || typeof o.value !== "number" || !Number.isFinite(o.value)) continue;
    for (const slug of slugs.get(o.variantId) ?? []) (models[slug] ??= ids.map(() => null))[i] = round(o.value);
  }
  const byId = new Map(snapshot.benchmarks.map((b) => [b.id, b]));
  const axes = ids.map((id, i): AAStrengthAxis => {
    const b = byId.get(id)!, values = Object.values(models).map((row) => row[i]).filter((v): v is number => v != null).sort((x, y) => x - y);
    const mid = values.length >> 1;
    return {
      id, name: b.name, label: b.shortName ?? b.name, description: b.description, unit: b.unit, higherIsBetter: b.higherIsBetter, share: round((weights[id] / total) * 100),
      min: values[0] ?? 0, max: values.at(-1) ?? 0, median: values.length ? (values.length % 2 ? values[mid] : round((values[mid - 1] + values[mid]) / 2)) : 0,
    };
  });
  return { ...head, axes, models };
}
