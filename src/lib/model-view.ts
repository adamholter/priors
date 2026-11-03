import { computeIndex, defaultConfig, type IndexConfig, type IndexResult, type RankedVariant } from "@/engine";
import { defaultPriorsMix } from "@/onboarding/defaults";
import { tokenPrice, type TokenPrice } from "@/data/subscription";
import type { Benchmark, Snapshot } from "@/data/types";
import { freeFloor, metricPanels } from "@/lib/metrics";
import { encodeIndices, prettyQuery } from "@/lib/url";
import { mergeImports } from "@/lib/import";
import { radarModelsFor, radarRows } from "@/components/chart/radar-view";
import type { RadarAxis, RadarModel, RadarPoint } from "@/components/chart/radar-data";
import type { RankingOption } from "@/lib/model-ranking-param";

/**
 * Everything a model page shows, as data. The server builds it for the standard rankings and sends it with the page,
 * so a model page draws without the calculation dataset; the browser builds the same thing from that dataset only
 * when a visitor's own ranking or pricing choice asks for something else (`ModelLoader`).
 */
export interface ModelView {
  model: { id: string; name: string; releaseDate?: string };
  lab?: { id: string; name: string; color?: string };
  labColors: Record<string, string | undefined>;
  builderHref: string;
  measured: number;
  /** This model's efforts, best first. Empty when this ranking does not rank it. */
  mine: { id: string; effort: string; score: number; rank: number; measuredShare: number }[];
  /** Variants and models in this ranking; `place` is among models. */
  total: number; models: number; place: number;
  /** Too little measured data at the ranking's strictness, so it ranks with estimates. */
  loose: boolean;
  weighted: number;
  /** This ranking's benchmarks. */
  field: ViewField;
  /** How many other benchmarks measured this model, and their cards' data when it came along. On a page from the server the (much longer) rest loads when the visitor opens that list. */
  others: number; otherField?: ViewField;
  strengths?: { name: string; axes: RadarAxis[]; me: RadarModel; leader?: RadarModel; median: RadarPoint[]; place: ({ n: number; rank: number } | null)[]; models: number; mixName: string };
  cost: { rows: CostRow[]; floor: number; hasFree: boolean; models: number; token?: TokenPrice };
}
export interface ViewField {
  benchmarks: ViewBenchmark[];
  /** Every variant the benchmark rows name. */
  variants: { id: string; modelId: string; effort: string; cost?: number }[];
  names: Record<string, string>;
}
export interface ViewBenchmark extends Pick<Benchmark, "id" | "name" | "category" | "unit" | "higherIsBetter"> {
  /** Results, best first: an index into `variants` and the score. */
  v: number[]; value: number[];
}
export interface CostRow { id: string; modelId: string; name: string; effort: string; score: number; costUsd?: number; speed?: number; tpt?: number; latency?: number; tokens?: number }

/** One result of a benchmark, as its card draws it. */
export interface BenchRow { variantId: string; modelId: string; effort: string; value: number; cost?: number; rank: number }
export function benchRows(view: Pick<ViewField, "variants">, b: Pick<ViewBenchmark, "v" | "value">): BenchRow[] {
  return b.v.map((v, i) => { const x = view.variants[v]; return { variantId: x.id, modelId: x.modelId, effort: x.effort, value: b.value[i], cost: x.cost, rank: i + 1 }; });
}

interface Shared { result: IndexResult; perBench: Map<string, BenchRow[]>; loose?: IndexResult; panels?: ReturnType<typeof panelValues>; radar?: ReturnType<typeof radarModelsFor> }
const shared = new WeakMap<Snapshot, Map<string, Shared>>();

/** What every model page on one ranking has in common. A snapshot is immutable, so it is worked out once per snapshot and goes away with it. */
function field(snapshot: Snapshot, mix: IndexConfig, costConfig: IndexConfig) {
  const key = JSON.stringify([mix, costConfig]);
  const forSnapshot = shared.get(snapshot) ?? shared.set(snapshot, new Map()).get(snapshot)!;
  let out = forSnapshot.get(key);
  if (out) return out;
  const result = computeIndex(snapshot, { ...mix, variants: "all" });
  // Cost per task is measured per variant; the full-pool "all time" index supplies it for every variant.
  const costs = new Map<string, number>();
  for (const x of computeIndex(snapshot, { ...costConfig, variants: "all", releasedAfter: "", strictness: 0 }).ranked) if (x.costUsd) { costs.set(x.variant.id, x.costUsd); const base = x.variant.id.split("~")[0]; if (!costs.has(base)) costs.set(base, x.costUsd); }
  const variants = new Map(snapshot.variants.map((v) => [v.id, v]));
  const perBench = new Map<string, BenchRow[]>(), byVariant = new Map<string, Map<string, BenchRow>>();
  for (const o of snapshot.observations) {
    const base = o.variantId.split("~")[0], v = variants.get(o.variantId) ?? variants.get(base);
    const list = perBench.get(o.benchmarkId) ?? perBench.set(o.benchmarkId, []).get(o.benchmarkId)!;
    const seen = byVariant.get(o.benchmarkId) ?? byVariant.set(o.benchmarkId, new Map()).get(o.benchmarkId)!;
    const prev = seen.get(base);
    if (prev) { if (o.value > prev.value) prev.value = o.value; continue; }
    const row: BenchRow = { variantId: base, modelId: v?.modelId ?? base.split("@")[0], effort: v?.effort ?? "default", value: o.value, cost: costs.get(base), rank: 0 };
    list.push(row); seen.set(base, row);
  }
  const benchmarks = new Map(snapshot.benchmarks.map((b) => [b.id, b]));
  for (const [id, list] of perBench) { const b = benchmarks.get(id); list.sort((a, c) => b?.higherIsBetter === false ? a.value - c.value : c.value - a.value).forEach((r, i) => { r.rank = i + 1; }); }
  out = { result, perBench };
  forSnapshot.set(key, out);
  return out;
}

function panelValues(snapshot: Snapshot, ranked: RankedVariant[], mix: IndexConfig) {
  const panels = new Map(metricPanels(snapshot, ranked, mix.timeSource).map((p) => [p.id, p]));
  const from = (id: string) => { const pts = panels.get(id)?.chart?.points(ranked) ?? []; const m = new Map(pts.map((p) => [p.r.variant.id, p.raw ?? p.x])); return (r: RankedVariant) => m.get(r.variant.id); };
  return { tpt: from("tpt"), latency: from("latency"), tokens: from("tokens") };
}

function costSide(snapshot: Snapshot, modelId: string, ranked: RankedVariant[], mix: IndexConfig, { tpt, latency, tokens }: ReturnType<typeof panelValues>): ModelView["cost"] {
  const metrics: ((r: RankedVariant) => number | undefined)[] = [(r) => (r.costUsd != null && r.costUsd >= 0 ? r.costUsd : undefined), (r) => (r.speed && r.speed > 0 ? r.speed : undefined), tpt, latency, tokens];
  // Each chart draws one point per other model, its best-scoring effort with that metric, so only those rows travel.
  const taken = metrics.map(() => new Set<string>());
  const rows: CostRow[] = [];
  for (const r of ranked) {
    let keep = r.model.id === modelId;
    metrics.forEach((of, i) => { if (of(r) != null && !taken[i].has(r.model.id)) { taken[i].add(r.model.id); keep = true; } });
    if (keep) rows.push({ id: r.variant.id, modelId: r.model.id, name: r.model.name, effort: r.variant.effort, score: r.score, costUsd: r.costUsd, speed: r.speed, tpt: tpt(r), latency: latency(r), tokens: tokens(r) });
  }
  return { rows, floor: freeFloor(ranked.flatMap((r) => (r.costUsd ? [r.costUsd] : []))), hasFree: ranked.some((r) => r.costUsd === 0), models: new Set(ranked.map((r) => r.model.id)).size, token: tokenPrice(snapshot, modelId, mix.subscriptionPlans) };
}

function strengths(modelId: string, mixName: string, { axes, models, median }: ReturnType<typeof radarModelsFor>): ModelView["strengths"] {
  const me = models.find((m) => m.id === modelId), leader = models[0];
  if (!me || axes.length < 3) return undefined;
  // Place among ranked models on each benchmark (best first). r is normalized so that higher is better, whichever way the benchmark scores.
  const place = axes.map((_, i) => {
    const r = me.points[i].r;
    if (r == null) return null;
    const pool = models.map((m) => m.points[i].r).filter((x): x is number => x != null);
    return { n: pool.length, rank: 1 + pool.filter((x) => x > r).length };
  });
  return { name: me.name, axes, me, leader, median, place, models: models.length, mixName };
}

/** The benchmarks that measured this model, this ranking's first. */
function measuredIn(snapshot: Snapshot, modelId: string, mix: IndexConfig, perBench: Map<string, BenchRow[]>) {
  const measured = snapshot.benchmarks.filter((b) => !b.proxy && perBench.get(b.id)?.some((r) => r.modelId === modelId));
  const others = measured.filter((b) => !((mix.weights[b.id] ?? 0) > 0)).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  return { measured, inMix: measured.filter((b) => (mix.weights[b.id] ?? 0) > 0), others };
}

function fieldOf(snapshot: Snapshot, list: Benchmark[], perBench: Map<string, BenchRow[]>): ViewField {
  const variants: ViewField["variants"] = [], at = new Map<string, number>(), names: ViewField["names"] = {};
  const modelNames = new Map(snapshot.models.map((m) => [m.id, m.name]));
  const benchmarks = list.map(({ id, name, category, unit, higherIsBetter }): ViewBenchmark => {
    const rows = perBench.get(id)!;
    return { id, name, category, unit, higherIsBetter, value: rows.map((r) => r.value), v: rows.map((r) => {
      let i = at.get(r.variantId);
      if (i === undefined) { i = variants.length; at.set(r.variantId, i); variants.push({ id: r.variantId, modelId: r.modelId, effort: r.effort, cost: r.cost }); names[r.modelId] = modelNames.get(r.modelId) ?? r.modelId; }
      return i;
    }) };
  });
  return { benchmarks, variants, names };
}

/** The rest of a model's benchmarks, for the list a server-drawn page loads when it opens (`/api/models/[id]/field`). */
export function otherField(snapshot: Snapshot, modelId: string, mix: IndexConfig, costConfig: IndexConfig): ViewField {
  const { perBench } = field(snapshot, mix, costConfig);
  return fieldOf(snapshot, measuredIn(snapshot, modelId, mix, perBench).others, perBench);
}

export function modelView(snapshot: Snapshot, modelId: string, mix: IndexConfig, costConfig: IndexConfig, { inlineOthers = false } = {}): ModelView {
  const shared = field(snapshot, mix, costConfig), { result, perBench } = shared;
  const model = snapshot.models.find((m) => m.id === modelId)!;
  const lab = snapshot.labs.find((l) => l.id === model.labId);
  // Not enough measured data at the mix's strictness: fall back to estimates rather than showing nothing.
  const strict = result.ranked.some((r) => r.model.id === modelId);
  const shown = strict ? result : shared.loose ??= computeIndex(snapshot, { ...mix, variants: "all", strictness: 0 });
  const mine = shown.ranked.filter((r) => r.model.id === modelId);
  const seen = new Set<string>();
  const best = shown.ranked.filter((r) => !seen.has(r.model.id) && !!seen.add(r.model.id));
  const { measured, inMix, others } = measuredIn(snapshot, modelId, mix, perBench);
  const radar = () => (strict ? shared.radar ??= radarModelsFor(radarRows(snapshot, mix, shown.ranked, shown.benchmarks), shown.benchmarks, "field") : radarModelsFor(radarRows(snapshot, mix, shown.ranked, shown.benchmarks), shown.benchmarks, "field"));
  const panels = () => (strict ? shared.panels ??= panelValues(snapshot, shown.ranked, mix) : panelValues(snapshot, shown.ranked, mix));
  return {
    model: { id: model.id, name: model.name, releaseDate: model.releaseDate },
    lab: lab && { id: lab.id, name: lab.name, color: lab.color },
    labColors: Object.fromEntries(snapshot.labs.map((l) => [l.id, l.color])),
    builderHref: `/builder?${prettyQuery(encodeIndices([mix]))}`,
    measured: measured.length,
    mine: mine.map((r) => ({ id: r.variant.id, effort: r.variant.effort, score: r.score, rank: shown.ranked.indexOf(r) + 1, measuredShare: r.measuredShare })),
    total: shown.ranked.length, models: best.length, place: best.findIndex((r) => r.model.id === modelId),
    loose: !strict,
    weighted: Object.values(mix.weights).filter((w) => w > 0).length,
    field: fieldOf(snapshot, inMix, perBench),
    others: others.length, otherField: inlineOthers ? fieldOf(snapshot, others, perBench) : undefined,
    strengths: mine.length ? strengths(modelId, mix.name, radar()) : undefined,
    cost: mine.length ? costSide(snapshot, modelId, shown.ranked, mix, panels()) : { rows: [], floor: 0, hasFree: false, models: 0 },
  };
}

export const presetConfig = (snapshot: Snapshot, key: string): IndexConfig => key === "preset:aa" ? defaultPriorsMix(snapshot) : defaultConfig(snapshot);

const rankedSets = new WeakMap<Snapshot, Map<string, Set<string>>>();
function ranksModel(snapshot: Snapshot, config: IndexConfig, modelId: string): boolean {
  const key = JSON.stringify(config), forSnapshot = rankedSets.get(snapshot) ?? rankedSets.set(snapshot, new Map()).get(snapshot)!;
  let ranked = forSnapshot.get(key);
  if (!ranked) { ranked = new Set(computeIndex(snapshot, { ...config, variants: "all" }).ranked.map((r) => r.model.id)); forSnapshot.set(key, ranked); }
  return ranked.has(modelId);
}

/** The standard ranking a visitor with no rankings of their own sees: the first that ranks this model. */
export function defaultPreset(snapshot: Snapshot, modelId: string): string {
  return ["preset:general", "preset:aa"].find((key) => ranksModel(snapshot, presetConfig(snapshot, key), modelId)) ?? "preset:general";
}

/** The page's view for a visitor's own situation: the picked ranking, else the first of their rankings that ranks this model. */
export function chosenView(base: Snapshot, modelId: string, options: RankingOption[], picked: RankingOption | undefined, ready: boolean, applyPrefs: (c: IndexConfig) => IndexConfig) {
  const configOf = (o: RankingOption) => o.config ?? presetConfig(base, o.key);
  const withImports = (o: RankingOption) => (o.imports?.length ? mergeImports(base, o.imports).snapshot : base);
  const general = options.find((o) => o.key === "preset:general")!;
  const auto = ready ? options.find((o) => ranksModel(withImports(o), configOf(o), modelId)) ?? general : general;
  const current = picked ?? auto;
  const snapshot = withImports(current);
  return { key: current.key, snapshot, view: modelView(snapshot, modelId, applyPrefs(configOf(current)), applyPrefs(defaultConfig(snapshot)), { inlineOthers: true }) };
}
