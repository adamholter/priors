import type { Benchmark, Model, Observation, Snapshot, Variant } from "./types";

/** What a row's observation says about itself, as bits, so the engine never opens `details` or `note`. */
export const ROW_ESTIMATE = 1, ROW_ASSUMED_TOP = 2, ROW_CROSS_EFFORT = 4, ROW_PERFORMANCE = 8, ROW_NOTE_ESTIMATED = 16, ROW_COUNTED = 32;
export const ROW_INFERRED = ROW_ESTIMATE | ROW_ASSUMED_TOP;
export const ROW_FLAGS = { ROW_ASSUMED_TOP, ROW_CROSS_EFFORT, ROW_INFERRED, ROW_NOTE_ESTIMATED, ROW_PERFORMANCE };

/** Efforts by strength: the nearest measured one stands in for a missing one. */
const EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh", "max", "default"];
export const effortRank = (effort: string | undefined) => EFFORTS.indexOf(effort as string);
/** `default` is no level of reasoning, so no ratio connects it to the efforts. */
export const DEFAULT_RANK = EFFORTS.indexOf("default");
/** The effort in a variant id, which can differ from its `effort` field in old snapshots. */
const idEffort = (id: string) => id.split("@")[1]?.split("~")[0];
const NO_CONFIG = "\0";
/** Siblings: variant ids with the same model prefix and configuration, whichever effort. */
export const siblingKey = (modelId: string, id: string) => `${modelId}@${id.split("~")[1] ?? NO_CONFIG}`;

export interface EstimationRoute { source: number; factor: number; variantFactors?: Record<string, number>; pairedCount?: number; evidenceId: string; sourceId: string }

/**
 * One dataset's benchmarks, variants and scores as flat arrays. Benchmark and variant ids are interned to integers once;
 * the engine then reads `at[v * nb + b]` instead of walking nested hash maps. A row is the first observation of a benchmark
 * and variant, its fields held by column; `-1` means no score. The history archive fills the same structure one date at a
 * time, so `rows` is empty there and only scores can be read.
 */
export interface Columns {
  date: string;
  nb: number; nv: number;
  benchIds: string[]; variantIds: string[];
  benchIndex: Map<string, number>; variantIndex: Map<string, number>;
  /** [variant * nb + benchmark] -> row, or -1. Variant-major, so one variant's scores sit together. */
  at: Int32Array;
  value: Float64Array; flags: Uint8Array;
  /** log(value) where a row can be panel evidence (measured, at least 5); NaN otherwise. Filled by `fillPanelLogs`. */
  panelLog: Float64Array;
  /** Interned harness name per row; 0 is none. */
  harness: Uint16Array;
  /** Row -> the observation behind it. Empty in the history archive. */
  rows: Observation[];
  /** Variants per benchmark with a score that is not a Priors estimate: "how many models published this". */
  counted: Int32Array;
  // Benchmarks, by interned index. Ids only referenced (a fallback, or an observation's benchmark that was dropped) have no `bench`.
  bench: (Benchmark | undefined)[];
  fallback: Int32Array;
  routes: (EstimationRoute[] | undefined)[];
  /** Version family: linked by `versionPolicy`, directly or through others. */
  family: Int32Array;
  /** Benchmarks an effort ratio may be measured on, in id order. */
  pairable: Int32Array;
  /** Benchmarks that show who resembles whom: measured percent scores, in snapshot order. */
  panel: Int32Array;
  /** Normalizers over a benchmark's whole column, made when first asked for. */
  measured: (((v: number) => number) | undefined)[];
  sortedBench: Int32Array;
  // Variants, by position in the dataset's list.
  variants: Variant[];
  vIndex: Int32Array; vModel: Int32Array; vRank: Int8Array; vSiblings: Int32Array;
  // Models, by position in the dataset's list.
  models: Model[];
  mLlm: Uint8Array; mReleaseMs: Float64Array; mTier: Uint8Array;
  /** By interned variant: the effort its id names. */
  idRank: Int8Array;
  siblings: Int32Array[];
  siblingIndex: Map<string, number>;
  aliases: Map<string, string>;
  /** Variant id -> model id. */
  modelOf: Map<string, string>;
}

const costly = (b: Benchmark) => b.category === "cost" || b.category === "speed";
export const effortLocked = (b: Benchmark) => b.proxy === true || costly(b);
const unpaired = (b: Benchmark) => !!b.proxy || costly(b) || b.category === "composite";

/** The interned ids and sibling lists, with empty score and variant columns. */
export function emptyColumns(benchIds: string[], variantIds: string[], rowCount: number, nModels: number, nVariants: number): Columns {
  const nb = benchIds.length, nv = variantIds.length;
  const groups = new Map<string, number[]>(), idRank = new Int8Array(nv);
  variantIds.forEach((id, v) => {
    idRank[v] = effortRank(idEffort(id));
    const at = id.indexOf("@");
    if (at < 0) return;
    const key = siblingKey(id.slice(0, at), id), g = groups.get(key);
    if (g) g.push(v); else groups.set(key, [v]);
  });
  const siblingIndex = new Map<string, number>(), siblings: Int32Array[] = [];
  for (const [key, members] of groups) { siblingIndex.set(key, siblings.length); siblings.push(Int32Array.from(members)); }
  return {
    date: "", nb, nv, benchIds, variantIds,
    benchIndex: new Map(benchIds.map((id, i) => [id, i])), variantIndex: new Map(variantIds.map((id, i) => [id, i])),
    at: new Int32Array(nb * nv).fill(-1),
    value: new Float64Array(rowCount), flags: new Uint8Array(rowCount), panelLog: new Float64Array(rowCount), harness: new Uint16Array(rowCount), rows: [],
    counted: new Int32Array(nb),
    bench: new Array(nb).fill(undefined), fallback: new Int32Array(nb).fill(-1), routes: new Array(nb).fill(undefined), family: new Int32Array(nb),
    pairable: new Int32Array(0), panel: new Int32Array(0), measured: new Array(nb).fill(undefined),
    sortedBench: Int32Array.from(benchIds.map((_, i) => i).sort((x, y) => benchIds[x].localeCompare(benchIds[y]))),
    variants: [], vIndex: new Int32Array(nVariants), vModel: new Int32Array(nVariants), vRank: new Int8Array(nVariants), vSiblings: new Int32Array(nVariants),
    models: [], mLlm: new Uint8Array(nModels), mReleaseMs: new Float64Array(nModels), mTier: new Uint8Array(nModels),
    idRank, siblings, siblingIndex, aliases: new Map(), modelOf: new Map(),
  };
}

/** The benchmarks in force: their links, version families, and the lists the engine walks. */
export function setBenchmarks(c: Columns, benchmarks: Benchmark[]) {
  const { bench, benchIndex, fallback, routes, family, measured } = c;
  for (let b = 0; b < c.nb; b++) { family[b] = b; fallback[b] = -1; routes[b] = undefined; }
  const was = bench.slice();
  bench.fill(undefined);
  const root = (x: number) => { while (family[x] !== x) x = family[x] = family[family[x]]; return x; };
  const seen: number[] = [];
  for (const x of benchmarks) { const b = benchIndex.get(x.id)!; if (!bench[b]) seen.push(b); bench[b] = x; }
  for (const b of seen) {
    const x = bench[b]!, policy = x.versionPolicy;
    if (x !== was[b]) measured[b] = undefined;
    if (policy?.kind === "fallback") fallback[b] = benchIndex.get(policy.fallbackTo)!;
    const link = policy?.kind === "fallback" ? policy.fallbackTo : policy?.supersedes;
    if (link) family[root(b)] = root(benchIndex.get(link)!);
    if (x.estimationRoutes?.length) routes[b] = x.estimationRoutes.map((r) => ({ source: benchIndex.get(r.sourceId)!, factor: r.factor, variantFactors: r.variantFactors, pairedCount: r.pairedCount, evidenceId: r.evidenceId, sourceId: r.sourceId }));
  }
  for (let b = 0; b < c.nb; b++) { if (was[b] && !bench[b]) measured[b] = undefined; family[b] = root(b); }
  const pairable: number[] = [], panel: number[] = [];
  for (const b of c.sortedBench) if (bench[b] && !unpaired(bench[b]!)) pairable.push(b);
  for (const b of seen) { const x = bench[b]!; if (x.unit === "percent" && x.higherIsBetter && !unpaired(x)) panel.push(b); }
  c.pairable = Int32Array.from(pairable); c.panel = Int32Array.from(panel);
}

/** Price tier as a number; 0 is unknown, which never excludes a peer. */
const TIERS = ["frontier", "mid", "small"];
export const tierOf = (m: Pick<Model, "priceTier">) => m.priceTier ? TIERS.indexOf(m.priceTier) + 1 : 0;
/** `releaseDate` as a time; NaN when absent, which never excludes a peer. */
export const releaseMs = (m: Pick<Model, "releaseDate">) => m.releaseDate ? new Date(m.releaseDate).getTime() : NaN;

export function fillPanelLogs(c: Columns, rowCount: number) {
  for (let r = 0; r < rowCount; r++) { const x = c.value[r]; c.panelLog[r] = c.flags[r] & ROW_INFERRED || !(x >= 5) || x === Infinity ? NaN : Math.log(x); }
}

function setVariants(c: Columns, variants: Variant[], models: Model[]) {
  const modelAt = new Map<string, number>();
  models.forEach((m, i) => {
    modelAt.set(m.id, i);
    c.mLlm[i] = m.kind === "llm" ? 1 : 0; c.mReleaseMs[i] = releaseMs(m); c.mTier[i] = tierOf(m);
  });
  variants.forEach((x, pos) => {
    c.vIndex[pos] = c.variantIndex.get(x.id)!;
    c.vModel[pos] = modelAt.get(x.modelId) ?? -1;
    c.vRank[pos] = effortRank(x.effort);
    c.vSiblings[pos] = c.siblingIndex.get(siblingKey(x.modelId, x.id)) ?? -1;
  });
  c.variants = variants; c.models = models;
}

function intern(index: Map<string, number>, ids: string[], id: string) {
  let i = index.get(id);
  if (i === undefined) { i = ids.length; ids.push(id); index.set(id, i); }
  return i;
}

function rowFlags(o: Observation) {
  const d = o.details;
  if (!d && !o.note) return ROW_COUNTED;
  const estimate = d?.priorsEstimate as { estimateKind?: string } | undefined;
  return (estimate ? ROW_ESTIMATE : ROW_COUNTED)
    | ((d?.realIndex as { effortAttribution?: string } | undefined)?.effortAttribution === "assumed-top" ? ROW_ASSUMED_TOP : 0)
    | (estimate?.estimateKind === "cross-effort" ? ROW_CROSS_EFFORT : estimate?.estimateKind === "performance" ? ROW_PERFORMANCE : 0)
    | (o.note && /estimated/i.test(o.note) ? ROW_NOTE_ESTIMATED : 0);
}

function build(snapshot: Snapshot): Columns {
  const benchmarks = snapshot.benchmarks ?? [], variants = snapshot.variants ?? [], models = snapshot.models ?? [], observations = snapshot.observations ?? [], estimates = snapshot.estimates ?? [];
  const benchIds: string[] = [], benchAt = new Map<string, number>(), variantIds: string[] = [], variantAt = new Map<string, number>();
  for (const b of benchmarks) intern(benchAt, benchIds, b.id);
  for (const b of benchmarks) {
    const policy = b.versionPolicy, link = policy?.kind === "fallback" ? policy.fallbackTo : policy?.supersedes;
    if (link) intern(benchAt, benchIds, link);
    for (const r of b.estimationRoutes ?? []) intern(benchAt, benchIds, r.sourceId);
  }
  for (const v of variants) intern(variantAt, variantIds, v.id);
  const obsBench = new Int32Array(observations.length), obsVariant = new Int32Array(observations.length);
  observations.forEach((o, i) => { obsBench[i] = intern(benchAt, benchIds, o.benchmarkId); obsVariant[i] = intern(variantAt, variantIds, o.variantId); });
  const estimateBench = estimates.map((e) => intern(benchAt, benchIds, e.benchmarkId)), estimateVariant = estimates.map((e) => intern(variantAt, variantIds, e.variantId));

  const c = emptyColumns(benchIds, variantIds, observations.length + estimates.length, models.length, variants.length);
  const { nb, at, value, flags, harness, rows, counted } = c;
  const harnesses = new Map<string, number>();
  const add = (slot: number, o: Observation, f: number, b: number) => {
    const r = rows.length;
    at[slot] = r; rows.push(o); value[r] = o.value; flags[r] = f;
    if (o.harness !== undefined) { let h = harnesses.get(o.harness); if (h === undefined) harnesses.set(o.harness, h = harnesses.size + 1); harness[r] = h; }
    if (f & ROW_COUNTED) counted[b]++;
  };
  for (let i = 0; i < observations.length; i++) {
    const b = obsBench[i], slot = obsVariant[i] * nb + b, r = at[slot], o = observations[i];
    if (r < 0) { add(slot, o, rowFlags(o), b); continue; }
    if (!(flags[r] & ROW_COUNTED) && !o.details?.priorsEstimate) { flags[r] |= ROW_COUNTED; counted[b]++; }
  }
  estimates.forEach((e, i) => {
    const b = estimateBench[i], slot = estimateVariant[i] * nb + b;
    if (at[slot] >= 0) return;
    const o: Observation = {
      benchmarkId: e.benchmarkId, variantId: e.variantId, value: e.value,
      observedAt: "", sourceUrl: e.sourceUrl ?? "", sourceModelId: e.sourceVariantId, details: { priorsEstimate: e },
    };
    add(slot, o, rowFlags(o), b);
  });
  fillPanelLogs(c, rows.length);
  setBenchmarks(c, benchmarks);
  setVariants(c, variants, models);
  c.date = snapshot.date;
  for (const v of variants) {
    c.modelOf.set(v.id, v.modelId);
    if (v.aliases) for (const a of v.aliases) c.aliases.set(a, v.id);
  }
  return c;
}

interface Built { columns: Columns; observations: Observation[]; nObservations: number; variants: Variant[]; nVariants: number; models: Model[]; nModels: number; benchmarks: Benchmark[]; nBenchmarks: number; estimates?: Snapshot["estimates"]; nEstimates: number }
const built = new WeakMap<Snapshot, Built>();

/**
 * A snapshot's columns, interned once. A dataset is immutable in use, so this is the data in another layout rather than a
 * saved answer; a list that was replaced or grew (`src/lib/import.ts`, tests) builds it again.
 */
export function columnsOf(snapshot: Snapshot): Columns {
  const b = built.get(snapshot);
  if (b && b.observations === snapshot.observations && b.nObservations === (snapshot.observations?.length ?? 0) && b.variants === snapshot.variants && b.nVariants === (snapshot.variants?.length ?? 0)
    && b.models === snapshot.models && b.nModels === (snapshot.models?.length ?? 0) && b.benchmarks === snapshot.benchmarks && b.nBenchmarks === (snapshot.benchmarks?.length ?? 0)
    && b.estimates === snapshot.estimates && b.nEstimates === (snapshot.estimates?.length ?? 0)) return b.columns;
  const columns = build(snapshot);
  built.set(snapshot, { columns, observations: snapshot.observations, nObservations: snapshot.observations?.length ?? 0, variants: snapshot.variants, nVariants: snapshot.variants?.length ?? 0, models: snapshot.models, nModels: snapshot.models?.length ?? 0, benchmarks: snapshot.benchmarks, nBenchmarks: snapshot.benchmarks?.length ?? 0, estimates: snapshot.estimates, nEstimates: snapshot.estimates?.length ?? 0 });
  return columns;
}

const byBenchmark = new WeakMap<Observation[], { n: number; lists: Map<string, Observation[]> }>();
const NONE: Observation[] = [];
/** One benchmark's observations, every one in scrape order (duplicates too): the readers of plan and task data look at a few hundred rows, not all of them. */
export function observationsOf(snapshot: Snapshot, benchmarkId: string): Observation[] {
  let x = byBenchmark.get(snapshot.observations);
  if (!x || x.n !== snapshot.observations.length) {
    const lists = new Map<string, Observation[]>();
    for (const o of snapshot.observations) { const l = lists.get(o.benchmarkId); if (l) l.push(o); else lists.set(o.benchmarkId, [o]); }
    byBenchmark.set(snapshot.observations, x = { n: snapshot.observations.length, lists });
  }
  return x.lists.get(benchmarkId) ?? NONE;
}
