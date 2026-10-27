import type { Benchmark, Observation, Series, Snapshot } from "@/data/types";

/**
 * What a benchmark publishes beyond its score, found from its observations rather than listed per source:
 * the standard per-task measurements (time, tokens, agent steps) and every number in the scraper's `details`
 * (sub-scores, category splits, win/loss counts, rubric rates). Numbers that share a parent form a group,
 * which the page shows as a breakdown. Settings and interval bounds are left out.
 */
export type MetricKind = "usd" | "seconds" | "ms" | "tokens" | "fraction" | "percent" | "count" | "number";
export interface BenchMetric {
  id: string;
  label: string;
  /** Parent path of a details number ("" for the top level); undefined for the standard measurements. */
  group?: string;
  key: string;
  kind: MetricKind;
  better: "higher" | "lower";
  values: Map<string, number>;
}
export interface MetricGroup { id: string; label: string; metrics: BenchMetric[] }

const MIN_ROWS = 3;
const MAX_DEPTH = 4;
/** Run settings and bookkeeping, not results. */
const SKIP = /^(temperature|top_?p|max_output_tokens|tie_breaker_score|neverSentinel|lower95ci|upper95ci|ci95|.*_sem|.*_std|stderr|standardErrorPercentagePoints|ratingDeviation|confidence|promptCoverage|coveredPrompts|activePrompts|numTasks|num_epochs|num_final_values|n|released|builtAt|completedAt|pageUpdated)$/i;
const LOWER = /cost|price|usd|latency|duration|time|seconds|token|steps?$|turns?|tool.?calls?|calls$|hallucinat|inconsisten|refus|wrong|loss|error|missed|deviation|minutes/i;

const humanize = (key: string) => {
  const s = key.replace(/_/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/\belo\b/g, "Elo").replace(/\bci\b/g, "CI").replace(/\bapi\b/g, "API");
};

function kindOf(key: string, values: number[]): MetricKind {
  if (/cost|usd|price/i.test(key)) return "usd";
  if (/ms$|timeMs/i.test(key)) return "ms";
  if (/latency/i.test(key)) return "ms";
  if (/duration|seconds|time/i.test(key)) return "seconds";
  if (/token/i.test(key)) return "tokens";
  const max = Math.max(...values.map(Math.abs));
  if (/rate|share|pass|accuracy|ratio/i.test(key) && max <= 1) return "fraction";
  if (values.every((v) => Number.isInteger(v)) && /wins|losses|draws|votes|battles|correct|count|calls|turns|refused|wrong|misses|milestones|responses|posts/i.test(key)) return "count";
  return "number";
}

export function formatMetric(kind: MetricKind, v: number): string {
  if (!Number.isFinite(v)) return "";
  switch (kind) {
    case "usd": return v === 0 ? "$0" : `$${v >= 100 ? Math.round(v).toLocaleString() : v >= 1 ? v.toFixed(2) : v.toPrecision(2)}`;
    case "seconds": return v >= 3600 ? `${(v / 3600).toFixed(1)} h` : v >= 90 ? `${(v / 60).toFixed(v >= 600 ? 0 : 1)} min` : `${v.toFixed(v >= 10 ? 0 : 1)}s`;
    case "ms": return formatMetric("seconds", v / 1000);
    case "tokens": return v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}k` : `${Math.round(v)}`;
    case "fraction": return `${(v * 100).toFixed(v >= 0.1 ? 0 : 1)}%`;
    case "percent": return `${v.toFixed(1)}%`;
    case "count": return Math.round(v).toLocaleString();
    default: return Math.abs(v) >= 1000 ? Math.round(v).toLocaleString() : Math.abs(v) >= 10 ? v.toFixed(1) : v.toPrecision(3).replace(/\.?0+$/, "");
  }
}

/** Every number under `details`, by dotted path. Arrays are series, not metrics. */
function leaves(details: Record<string, unknown>, prefix = "", depth = 0, out = new Map<string, number>()) {
  if (depth >= MAX_DEPTH) return out;
  for (const [k, v] of Object.entries(details)) {
    if (SKIP.test(k)) continue;
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "number" && Number.isFinite(v)) out.set(path, v);
    else if (v && typeof v === "object" && !Array.isArray(v)) leaves(v as Record<string, unknown>, path, depth + 1, out);
  }
  return out;
}

const STANDARD: { key: "durationSec" | "outputTokens" | "steps"; label: string; kind: MetricKind }[] = [
  { key: "steps", label: "Agent steps per task", kind: "count" },
  { key: "durationSec", label: "Time per task", kind: "seconds" },
  { key: "outputTokens", label: "Output tokens per task", kind: "tokens" },
];

/** A benchmark's own observations, best per variant (the scraper's first row wins, as the engine does). */
export function benchmarkObservations(snapshot: Snapshot, benchmarkId: string): Observation[] {
  const seen = new Set<string>();
  return snapshot.observations.filter((o) => o.benchmarkId === benchmarkId && !o.details?.priorsEstimate && !seen.has(o.variantId) && !!seen.add(o.variantId));
}

export function benchmarkMetrics(snapshot: Snapshot, benchmark: Benchmark): { standard: BenchMetric[]; details: BenchMetric[]; groups: MetricGroup[] } {
  const obs = benchmarkObservations(snapshot, benchmark.id);
  const standard: BenchMetric[] = [];
  for (const s of STANDARD) {
    const values = new Map(obs.flatMap((o) => typeof o[s.key] === "number" && Number.isFinite(o[s.key]) && o[s.key]! > 0 ? [[o.variantId, o[s.key]!] as const] : []));
    if (values.size >= MIN_ROWS) standard.push({ id: s.key, label: s.label, key: s.key, kind: s.kind, better: "lower", values });
  }
  const byPath = new Map<string, Map<string, number>>();
  for (const o of obs) if (o.details) for (const [path, v] of leaves(o.details)) (byPath.get(path) ?? byPath.set(path, new Map()).get(path)!).set(o.variantId, v);
  const score = new Map(obs.map((o) => [o.variantId, o.value]));
  const named = new Map((benchmark.advanced ?? []).map((a) => [a.id, a.name]));
  const details: BenchMetric[] = [];
  for (const [path, values] of byPath) {
    if (values.size < MIN_ROWS) continue;
    const vs = [...values.values()];
    if (vs.every((v) => v === vs[0])) continue; // a constant tells nothing
    if ([...values].every(([id, v]) => Math.abs(v - (score.get(id) ?? NaN)) < 1e-9)) continue; // the score again
    const parts = path.split("."), key = parts[parts.length - 1], group = parts.slice(0, -1).join(".");
    const label = (!group && named.get(key)) || [...parts.slice(-2, -1).map(humanize), named.get(key) ?? humanize(key)].join(" · ");
    details.push({ id: `d:${path}`, label, group, key, kind: kindOf(key, vs), better: LOWER.test(key) ? "lower" : "higher", values });
  }
  const groups: MetricGroup[] = [];
  for (const g of new Set(details.map((m) => m.group!))) {
    const metrics = details.filter((m) => m.group === g);
    if (metrics.length < 2) continue;
    // Compare like with like: a group mixing counts and dollars reads as a table of unrelated numbers, so split by kind.
    const kinds = new Set(metrics.map((m) => m.kind));
    for (const kind of kinds) {
      const same = metrics.filter((m) => m.kind === kind);
      if (same.length < 2) continue;
      const base = g ? g.split(".").map(humanize).join(" · ") : benchmark.advanced?.length ? "Subsets" : "Breakdown";
      groups.push({ id: `${g}|${kind}`, label: kinds.size > 1 ? `${base} (${kindLabel(kind)})` : base, metrics: same });
    }
  }
  // The richest split first: the one a reader most likely came for (14 subjects beats a total and an average).
  groups.sort((a, b) => b.metrics.length - a.metrics.length);
  return { standard, details, groups };
}

const kindLabel = (k: MetricKind) => ({ usd: "cost", seconds: "time", ms: "time", tokens: "tokens", fraction: "rates", percent: "percent", count: "counts", number: "values" })[k];

/** Time series the benchmark publishes: scraped series (Vending-Bench balance by day), and per-model number lists in details. */
export interface BenchSeries { id: string; label: string; xLabel: string; yLabel: string; rows: { variantId: string; x: number[]; y: number[] }[] }
export function benchmarkSeries(snapshot: Snapshot, benchmarkId: string): BenchSeries[] {
  const out: BenchSeries[] = [];
  const scraped = snapshot.series.filter((s: Series) => s.benchmarkId === benchmarkId);
  if (scraped.length) out.push({ id: "series", label: `${scraped[0].yLabel} by ${scraped[0].xLabel.toLowerCase()}`, xLabel: scraped[0].xLabel, yLabel: scraped[0].yLabel, rows: scraped.map((s) => ({ variantId: s.variantId, x: s.x, y: s.y })) });
  const lists = new Map<string, { variantId: string; y: number[] }[]>();
  for (const o of benchmarkObservations(snapshot, benchmarkId)) {
    for (const [k, v] of Object.entries(o.details ?? {})) {
      if (!Array.isArray(v) || v.length < 5 || !v.every((x) => typeof x === "number" && Number.isFinite(x))) continue;
      (lists.get(k) ?? lists.set(k, []).get(k)!).push({ variantId: o.variantId, y: v as number[] });
    }
  }
  for (const [k, rows] of lists) {
    // A list that is the same for every model (totals across all models) is context, not a per-model series.
    if (rows.length < 2 || rows.every((r) => r.y.join() === rows[0].y.join())) continue;
    out.push({ id: `d:${k}`, label: humanize(k), xLabel: /daily|day/i.test(k) ? "Day" : "Step", yLabel: humanize(k), rows: rows.map((r) => ({ variantId: r.variantId, x: r.y.map((_, i) => i + 1), y: r.y })) });
  }
  return out;
}

/** Other boards of the same benchmark: its category splits (arena categories, subsets) and its other versions. */
export function benchmarkRelatives(snapshot: Snapshot, benchmark: Benchmark): { family: { id: string; label: string }[]; versions: { id: string; label: string }[] } {
  const measured = new Set(snapshot.observations.map((o) => o.benchmarkId));
  const main = benchmark.variantOf ?? benchmark.id;
  const mainB = snapshot.benchmarks.find((b) => b.id === main);
  const kids = snapshot.benchmarks.filter((b) => b.variantOf === main && measured.has(b.id));
  const family = kids.length && mainB ? [{ id: main, label: mainB.variantLabel ?? "Overall" }, ...kids.map((b) => ({ id: b.id, label: b.variantLabel ?? b.name }))] : [];
  // Versions: follow `supersedes` (and a fallback, DeepSWE 1.1 to 1) both ways from this board's main.
  const sup = new Map<string, string>(), by = new Map<string, string>();
  for (const b of snapshot.benchmarks) {
    const older = b.versionPolicy?.kind === "fresh" ? b.versionPolicy.supersedes : b.versionPolicy?.kind === "fallback" ? b.versionPolicy.fallbackTo : undefined;
    if (older) { sup.set(b.id, older); by.set(older, b.id); }
  }
  const chain: string[] = [main];
  for (let x = sup.get(main); x && !chain.includes(x); x = sup.get(x)) chain.push(x);
  for (let x = by.get(main); x && !chain.includes(x); x = by.get(x)) chain.unshift(x);
  const versions = chain.length > 1 ? chain.filter((id) => measured.has(id)).map((id) => ({ id, label: snapshot.benchmarks.find((b) => b.id === id)?.name ?? id })) : [];
  return { family, versions };
}
