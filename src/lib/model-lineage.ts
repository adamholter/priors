import { computeIndex, type IndexConfig, type RankedVariant, type ViewOptions } from "@/engine";
import type { Snapshot } from "@/data/types";
import { defaultPriorsMix } from "@/onboarding/defaults";

type Located = { x: number; r: RankedVariant };
type LineageModel = Pick<RankedVariant["model"], "id" | "name" | "labId" | "releaseDate">;

/** Successors a name cannot show: a new name for the same slot. Model id to the id of the model it follows. */
const FOLLOWS: Record<string, string> = {
  "gemini-4": "gemini-3.1-pro",            // Argon took over from the Pro line
  "gemini-4-carbon": "gemini-4",           // Carbon follows Argon
  "gemini-4-hydrogen": "gemini-3.8-flash", // Hydrogen is the next Flash
  "gpt-5.6-sol": "gpt-5.5",                // GPT-5.5 split into tiers, Sol is the flagship
  "gpt-5.6-luna": "gpt-5.4-mini",          // Luna took the low-cost slot
};

/** Below this share of the index measured directly, most of a score is estimated from similar models. */
const THIN_COVERAGE = 0.5;
export const isThinScore = (r: RankedVariant) => r.measuredShare < THIN_COVERAGE;
export const isPlaced = (p: Located) => Number.isFinite(p.x);

/** A version is a number on its own or after a short prefix: "GPT-5.6", "Opus 4.7", "Kimi K3.1", "DeepSeek V4", "Hy4". */
const VERSION = /(^|[\s-])([a-z]{0,3})(\d{1,2}(?:\.\d{1,2})?)(?=$|[\s-])/;
const BUILD_DATE = /\s+(?:0\d|1[0-2])\d{2}$/;

/** The name without its version, build date or setting: "GPT-6.1 Sol" and "GPT-5.6 Sol" share one, "Muse Spark" and "Muse Spark 1.3" too. */
export function lineKey(model: Pick<LineageModel, "name" | "labId">): { key: string; version: number } {
  const name = model.name.toLowerCase().replace(/\s*\(.*?\)/g, "").replace(BUILD_DATE, "").trim(), m = VERSION.exec(name);
  const base = m ? `${name.slice(0, m.index)}${m[1]}${m[2]}${name.slice(m.index + m[0].length)}` : name;
  return { key: `${model.labId}|${base.replace(/[\s-]+/g, " ").trim()}`, version: m ? Number(m[3]) : 0 };
}

/** Each model's direct predecessor: a named successor if that model is present, otherwise the release before it in its line. */
export function predecessors(models: LineageModel[]): Map<string, string> {
  const dated = models.filter((m) => m.releaseDate), ids = new Set(models.map((m) => m.id)), lines = new Map<string, { m: LineageModel; version: number }[]>();
  for (const m of dated) { const { key, version } = lineKey(m); (lines.get(key) ?? lines.set(key, []).get(key)!).push({ m, version }); }
  const out = new Map<string, string>();
  for (const line of lines.values()) {
    line.sort((a, b) => a.m.releaseDate!.localeCompare(b.m.releaseDate!) || a.version - b.version || Number(BUILD_DATE.test(b.m.name)) - Number(BUILD_DATE.test(a.m.name)) || a.m.name.localeCompare(b.m.name));
    line.forEach(({ m }, i) => { if (i) out.set(m.id, line[i - 1].m.id); });
  }
  for (const [id, previous] of Object.entries(FOLLOWS)) if (ids.has(id) && ids.has(previous)) out.set(id, previous);
  return out;
}

/**
 * Finds a point's earlier versions, oldest first. Each is taken at the same effort when it can be, preferring one the chart
 * can place. A version with no value on this chart's axis still comes back, with `x` NaN, so its score stays in the history.
 */
export function lineageFinder<P extends Located>(rows: RankedVariant[], place: (rows: RankedVariant[]) => P[]) {
  const placed = new Map(place(rows).filter(isPlaced).map((p) => [p.r.variant.id, p])), byModel = new Map<string, RankedVariant[]>(), models = new Map<string, LineageModel>();
  for (const r of rows) { if (r.speedTier) continue; (byModel.get(r.model.id) ?? byModel.set(r.model.id, []).get(r.model.id)!).push(r); models.set(r.model.id, r.model); }
  const previous = predecessors([...models.values()]);
  const pick = (list: RankedVariant[], effort: string) => list.find((r) => r.variant.effort === effort) ?? list.reduce((best, r) => (r.score > best.score ? r : best));
  return (focus: P): P[] => {
    const steps: P[] = [], seen = new Set([focus.r.model.id]);
    for (let id = previous.get(focus.r.model.id); id && !seen.has(id); id = previous.get(id)) {
      seen.add(id);
      const list = byModel.get(id)!, onChart = list.filter((r) => placed.has(r.variant.id));
      const r = pick(onChart.length ? onChart : list, focus.r.variant.effort);
      steps.unshift(placed.get(r.variant.id) ?? ({ x: NaN, r } as P));
    }
    return steps;
  };
}

/**
 * Every version a history can use, worked out once on first use. Rows the page already ranks keep their exact scores; the rest
 * ignore its age and coverage limits. An index of one published composite has no score for models that composite never covered,
 * so those are scored from the evaluations behind it and count as estimates.
 */
export function everyVersion(snapshot: Snapshot, config: IndexConfig, view: ViewOptions = {}) {
  let rows: RankedVariant[] | undefined;
  return () => {
    if (rows) return rows;
    const open = { ...config, releasedAfter: "", strictness: 0, required: [], excludeModels: undefined, onlyModels: undefined };
    const out = [...computeIndex(snapshot, config, view).ranked], have = new Set(out.map((r) => r.variant.id));
    const add = (list: RankedVariant[]) => { for (const r of list) if (!have.has(r.variant.id)) { have.add(r.variant.id); out.push(r); } };
    add(computeIndex(snapshot, open, view).ranked);
    if (Object.keys(config.weights).length === 1) add(computeIndex(snapshot, { ...open, weights: defaultPriorsMix(snapshot).weights, estimateMissing: true }, view).ranked.map((r) => ({ ...r, measuredShare: 0 })));
    return (rows = out);
  };
}

/** What changed since the version before: score points, and the metric as a ratio (0.7 is 30% lower) when both are on the chart. */
export function generationChange(previous: Located, focus: Located) {
  return { score: focus.r.score - previous.r.score, ratio: previous.x > 0 && focus.x > 0 ? focus.x / previous.x : undefined };
}
