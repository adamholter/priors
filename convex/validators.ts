import { v, type Infer } from "convex/values";
import type { IndexConfig } from "../src/engine";

const taskMetricSource = v.union(v.literal("aa"), v.literal("terminalbench-4"), v.literal("deepswe-1.1"), v.literal("frontierswe-v2"));

/**
 * The stored shape of an index. It must describe exactly the engine's `IndexConfig`: the assertion
 * below fails `npm run typecheck` (and therefore the Vercel build) the moment either side gains,
 * loses or changes a field, so a config the app can produce is always one the database accepts.
 */
export const indexConfig = v.object({
  id: v.string(),
  name: v.string(),
  weights: v.record(v.string(), v.number()),
  required: v.array(v.string()),
  cutoff: v.number(),
  estimateMissing: v.boolean(),
  variants: v.union(v.literal("all"), v.literal("best")),
  effortMatching: v.optional(v.union(v.literal("calibrated"), v.literal("nearest"), v.literal("strict"))),
  strictness: v.optional(v.number()),
  optional: v.optional(v.array(v.string())),
  rankingVariants: v.optional(v.union(v.literal("all"), v.literal("best"))),
  costSource: v.optional(taskMetricSource),
  costBasis: v.optional(v.union(v.literal("api"), v.literal("subscription"))),
  planResets: v.optional(v.literal(false)),
  timeSource: v.optional(taskMetricSource),
  paretoVariants: v.optional(v.union(v.literal("all"), v.literal("best"))),
  efforts: v.optional(v.array(v.string())),
  rankingEfforts: v.optional(v.array(v.string())),
  labs: v.optional(v.array(v.string())),
  excludeModels: v.optional(v.array(v.string())),
  onlyModels: v.optional(v.array(v.string())),
  releasedAfter: v.optional(v.string()),
  highlight: v.optional(v.array(v.string())),
  focus: v.optional(v.union(v.literal("capabilities"), v.literal("knowledge"), v.literal("problem-solving"), v.literal("general"))),
});

/**
 * An owner's default for one chart. Visitors start from it; their own tweaks stay in their browser.
 * Model membership is never stored here (the model list stays live as new models arrive).
 */
export const chartView = v.object({
  kind: v.optional(v.union(v.literal("scatter"), v.literal("bars"))),
  mode: v.optional(v.union(v.literal("all"), v.literal("best"))),
  scale: v.optional(v.union(v.literal("log"), v.literal("linear"))),
  frontier: v.optional(v.boolean()),
  links: v.optional(v.boolean()),
  guides: v.optional(v.boolean()),
  density: v.optional(v.number()),
  labelScale: v.optional(v.number()),
  /** Custom formula replacing the chart's metric, and whether higher or lower is better. */
  formula: v.optional(v.string()),
  formulaBetter: v.optional(v.union(v.literal("higher"), v.literal("lower"))),
});
export type ChartViewDefault = Infer<typeof chartView>;
/** One More-metrics panel: shown or hidden, open by default, and its chart default. Order is array order. */
export const galleryMetric = v.object({ id: v.string(), hidden: v.optional(v.boolean()), open: v.optional(v.boolean()), view: v.optional(chartView) });
export type GalleryMetric = Infer<typeof galleryMetric>;

/** A page is a list of sections; the editor and the agent skill both manipulate this. */
export const section = v.object({
  id: v.string(),
  kind: v.union(
    v.literal("rankings"), v.literal("pareto"), v.literal("speed"), v.literal("benchmark"),
    v.literal("text"), v.literal("links"), v.literal("history"), v.literal("gallery"),
  ),
  title: v.optional(v.string()),
  indexId: v.optional(v.string()), // rankings/pareto/speed/history
  benchmarkId: v.optional(v.string()), // benchmark
  body: v.optional(v.string()), // text (markdown-lite)
  links: v.optional(v.array(v.object({ label: v.string(), url: v.string() }))),
  hidden: v.optional(v.boolean()),
  /** pareto/speed: the owner's default chart view. */
  view: v.optional(chartView),
  /** gallery: which metrics show, in what order, open or not. Metrics missing from the list are new and stay hidden. */
  metrics: v.optional(v.array(galleryMetric)),
});
export type Section = Infer<typeof section>;

/** Owner-chosen page appearance. */
export const profileTheme = v.object({ accent: v.optional(v.string()), surface: v.optional(v.union(v.literal("bone"), v.literal("white"))), preset: v.optional(v.string()), /** "fixed" locks the chosen light/dark version; default follows the visitor. */ mode: v.optional(v.union(v.literal("auto"), v.literal("fixed"))), cardDesign: v.optional(v.string()), serif: v.optional(v.string()), mono: v.optional(v.string()), css: v.optional(v.string()) });
export type ProfileTheme = Infer<typeof profileTheme>;

/** Field names the database stores; used to drop transient client-only keys before saving. */
export const INDEX_CONFIG_FIELDS = Object.keys(indexConfig.fields) as (keyof IndexConfig)[];

type Exact<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
// If this line errors, convex/validators.ts and IndexConfig (src/engine/index.ts) have drifted apart.
export type IndexConfigMatchesEngine = Assert<Exact<Required<Infer<typeof indexConfig>>, Required<IndexConfig>>>;

/**
 * Exactly the stored fields of an index. Configs travel through URLs, React state, the assistant and
 * agent payloads, where transient keys can ride along at runtime; every write goes through this.
 */
export function storableIndex(c: IndexConfig): IndexConfig {
  const out: Record<string, unknown> = {};
  for (const k of INDEX_CONFIG_FIELDS) if (c[k] !== undefined) out[k] = c[k];
  return out as unknown as IndexConfig;
}
