/**
 * Priors data contract. Everything the site renders comes from one immutable Snapshot
 * produced by the local scraper pipeline (scripts/scrape). Scrapers emit RawRows with the
 * label strings they saw; normalization into canonical models/variants happens centrally.
 */

export type Effort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max" | "default";
export const EFFORT_ORDER: Effort[] = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];

export interface Lab {
  id: string; // "anthropic"
  name: string; // "Anthropic"
  color: string; // hex, muted for bone background
}

export interface Model {
  id: string; // canonical slug, e.g. "claude-opus-4.8"
  name: string; // display, e.g. "Opus 4.8"
  labId: string;
  releaseDate?: string; // ISO date, used for gap estimation peers
  priceTier?: "frontier" | "mid" | "small"; // used for gap estimation peers
  kind: "llm" | "image" | "video" | "audio" | "other"; // only llm is ranked
  reasoning: boolean; // has reasoning-effort variants anywhere
  aliases: string[]; // lowercase raw labels seen across sources
}

export interface Variant {
  id: string; // `${modelId}@${effort}`
  modelId: string;
  effort: Effort;
  configuration?: string;
  sourceModel?: { id: string; slug: string; name: string; url: string; metadata?: Record<string, unknown> };
  /** Complete source lineage when several publishers refer to the same model and effort. */
  sourceModels?: NonNullable<Variant["sourceModel"]>[];
  /** Old source-scoped IDs accepted by saved highlights and links. */
  aliases?: string[];
}

/** Onboarding lineup-fit focus preset. Stored on IndexConfig; ranking ignores it. */
export type FocusId = "capabilities" | "knowledge" | "problem-solving" | "general";
export const FOCUS_IDS: FocusId[] = ["capabilities", "knowledge", "problem-solving", "general"];

export type BenchmarkUnit = "percent" | "score" | "elo" | "usd" | "seconds" | "count";
export type BenchmarkCategory =
  | "coding" | "agentic" | "reasoning" | "knowledge" | "math" | "long-context"
  | "instruction" | "creative" | "safety" | "economics" | "composite" | "speed" | "cost" | "reliability" | "other";

export interface Benchmark {
  id: string; // "frontierswe-v2"
  name: string; // "FrontierSWE v2"
  shortName?: string;
  sourceId: string; // scraper that produced it
  url: string; // canonical public page
  description: string; // one or two sentences, what it measures
  /** Date the publisher last updated this benchmark's results, when published. */
  lastUpdated?: string; // YYYY-MM-DD; distinct from benchmark release and scrape dates
  /** Fixed source-defined scale; independent of which models the user filters. */
  normalization?: { kind: "linear"; min: number; max: number };
  unit: BenchmarkUnit;
  higherIsBetter: boolean;
  category: BenchmarkCategory;
  /** Logical-benchmark policy. "fallback": prefer this benchmark, fall back to `fallbackTo` for
   *  models missing here (DeepSWE 1.1 -> 1). "fresh": a new version is a new benchmark; older
   *  versions stay only for time travel. */
  versionPolicy?: { kind: "fallback"; fallbackTo: string } | { kind: "fresh"; supersedes?: string };
  /** Explicit score-space conversions for related benchmarks, in preference order.
   * Factors must come from recorded paired calibration evidence. */
  estimationRoutes?: {
    sourceId: string;
    factor: number;
    /** Frozen release-specific ratios, keyed by canonical variant identity. */
    variantFactors?: Record<string, number>;
    method: "paired-average" | "manual";
    pairedCount?: number;
    evidenceId: string;
  }[];
  /** Sub-splits or advanced knobs a user may expose; UI hides these by default. */
  advanced?: { id: string; name: string }[];
  /** True when it's a proxy (e.g. token price) rather than a measured quantity. */
  proxy?: boolean;
  /** Suggested default weight in the "General" starter index (0 = present but off). */
  defaultWeight?: number;
  /** Included in the coverage-based default index if coverage of relevant models is high. */
  eligibleForDefault?: boolean;
}

export interface Observation {
  benchmarkId: string;
  variantId: string;
  value: number; // in benchmark unit
  ci?: [number, number]; // confidence interval if published
  /** Measured run economics when the benchmark publishes them. */
  costUsd?: number; // cost per task/run, NOT token price
  outputTokens?: number;
  steps?: number;
  durationSec?: number;
  harness?: string; // e.g. "claude-code", "codex-cli", AA's harness name
  observedAt: string; // ISO datetime when scraped
  sourceUrl: string;
  sourceModelId?: string;
  details?: Record<string, unknown>;
  rank?: number; // as shown by the source, if any
  note?: string;
}

/** Time-series for benchmarks like VendingBench 2 (balance over time). */
export interface Series {
  benchmarkId: string;
  variantId: string;
  x: number[]; // step / day index
  y: number[];
  xLabel: string;
  yLabel: string;
  sourceUrl: string;
}

export interface SourceRun {
  sourceId: string;
  status: "ok" | "partial" | "failed";
  fetchedAt: string;
  rowCount: number;
  unknownLabels: string[]; // labels that could not be normalized; excluded from ranking
  rawPath: string; // local path of raw artifact for audit/reparse
  error?: string;
}

export interface Snapshot {
  version: 1;
  date: string; // YYYY-MM-DD
  generatedAt: string;
  labs: Lab[];
  models: Model[];
  variants: Variant[];
  benchmarks: Benchmark[];
  observations: Observation[];
  /** Explicit normalized estimates, kept separate so they cannot masquerade as measurements. */
  estimates?: {
    benchmarkId: string;
    variantId: string;
    value: number;
    estimateKind: "scaled" | "cross-effort" | "performance";
    sourceBenchmarkId?: string;
    sourceVariantId?: string;
    sourceUrl?: string;
    evidence: string[];
  }[];
  series: Series[];
  sources: SourceRun[];
}

/* ------------------------------------------------------------------ */
/* Scraper contract                                                    */
/* ------------------------------------------------------------------ */

/** A single scraped row before normalization. The scraper never guesses canonical ids. */
export interface RawRow {
  benchmarkId: string;
  /** Authoritative structured source identity, bypassing heuristic label matching. */
  identity?: { modelId: string; modelName: string; labId: string; effort: Effort; variantId: string; configuration?: string; sourceModelId: string; sourceSlug: string };
  modelMetadata?: Record<string, unknown>;
  sourceModelId?: string;
  details?: Record<string, unknown>;
  /** Exactly the model label the source shows, including any effort/thinking suffix. */
  modelLabel: string;
  /** Effort if the source shows it separately (e.g. DeepSWE's "[xhigh]"). Leave undefined if unknown. */
  effort?: string;
  value: number;
  ci?: [number, number];
  costUsd?: number;
  outputTokens?: number;
  steps?: number;
  durationSec?: number;
  harness?: string;
  rank?: number;
  sourceUrl: string;
  note?: string;
  /** Optional lab hint from the source (e.g. provider column). */
  labHint?: string;
  /** Optional release date hint from the source. */
  releaseDateHint?: string;
}

export interface RawSeries {
  benchmarkId: string;
  modelLabel: string;
  effort?: string;
  x: number[];
  y: number[];
  xLabel: string;
  yLabel: string;
  sourceUrl: string;
}

export interface ScrapeResult {
  benchmarks: Benchmark[]; // definitions this source owns (may be several)
  rows: RawRow[];
  series?: RawSeries[];
  /** Any extra per-model metadata the source exposes (AA: speed, price, release dates). */
  modelMeta?: { modelLabel: string; labHint?: string; releaseDateHint?: string; kind?: Model["kind"]; identity?: RawRow["identity"]; modelMetadata?: Record<string, unknown> }[];
  /** Raw artifacts to persist for audit (filename -> content). */
  raw: Record<string, string>;
  /** Free-form notes for the run log. */
  notes?: string[];
}

export interface ScrapeContext {
  /** Fetch with sane defaults, retries, and a browser-like UA. */
  fetchText(url: string, init?: RequestInit): Promise<string>;
  fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<T>;
  /** Render a page in headless Chromium and return the HTML after network idle, or run a callback. */
  withPage<T>(url: string, fn: (page: import("playwright").Page) => Promise<T>): Promise<T>;
  now: string;
  log(msg: string): void;
}

export interface Source {
  id: string;
  name: string;
  url: string;
  /** Must discover new models automatically; never hardcode result rows. */
  scrape(ctx: ScrapeContext): Promise<ScrapeResult>;
}
