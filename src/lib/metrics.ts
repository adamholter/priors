import { taskMetricData, taskMetricDescription, type TaskMetricSource } from "../data/task-metrics";
import type { Observation, Snapshot } from "@/data/types";
import type { RankedVariant } from "@/engine";

/** Anchor slug for chart titles — shared with ChartLink deep links. */
export const anchorOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** A metric scatter point: x is the (possibly transformed) metric value. */
export interface MetricPoint { x: number; r: RankedVariant; /** untransformed value for labels when x is transformed */ raw?: number }

export interface MetricChart {
  better: "lower" | "higher";
  points: (rows: RankedVariant[]) => MetricPoint[];
  xLabel: string;
  xName: string;
  scale?: "linear" | "log" | "time";
  /** x values are seconds — share-card ticks format them as "30s" / "2 min". */
  secs?: boolean;
  formatX: (x: number) => string;
  formatValue?: (x: number) => string;
  aria: string;
  /** Chart shown before the user picks one. Bars for single metrics where the trade-off against
   *  index score isn't the point; the scatter (with its Pareto frontier) stays a click away. */
  defaultKind?: "bars" | "scatter";
  /** Release chronology has no frontier until the viewer enables it. */
  defaultFrontier?: boolean;
}

export interface MetricPanel {
  id: string;
  title: string;
  desc: string;
  open?: boolean;
  chart?: MetricChart;
  speed?: boolean;
}

const MIN_PTS = 3;

/** Compact mark label: model, effort, and fallback flag — never the full source configuration string. */
export function chartLabel(r: RankedVariant) {
  const named = new RegExp(`\\b${r.variant.effort}\\b`, "i").test(r.model.name);
  const name = r.variant.effort === "default" || named ? r.model.name : `${r.model.name} ${r.variant.effort}`;
  const source = r.variant.sourceModel?.name ?? "";
  return /no fallback|without fallback/i.test(source) ? `${name}, no fallback` : /fallback/i.test(source) ? `${name}, fallback` : name;
}

/** Gallery panel definitions — shared between the client gallery and share cards. */
export function metricPanels(snapshot: Snapshot, ranked: RankedVariant[], timeSource: TaskMetricSource = "aa"): MetricPanel[] {
  const obs = new Map<string, Map<string, Observation>>();
  for (const o of snapshot.observations) {
    const b = obs.get(o.benchmarkId) ?? obs.set(o.benchmarkId, new Map()).get(o.benchmarkId)!;
    b.set(o.variantId, o);
    // Source-qualified variants (`id@effort~source-conf`) back their base
    // effort variant's metrics, the same way the engine substitutes them.
    const base = o.variantId.split("~")[0];
    if (!b.has(base)) b.set(base, o);
  }

  const at = (benchId: string, pick: (o: Observation) => number | undefined = (o) => o.value) => (rows: RankedVariant[]): MetricPoint[] =>
    rows.flatMap((r) => { const o = obs.get(benchId)?.get(r.variant.id); const x = o && pick(o); return x != null && Number.isFinite(x) && x > 0 ? [{ x, r }] : []; });

  const panels: MetricPanel[] = [];
  const iiId = snapshot.benchmarks.filter((b) => b.id.startsWith("aa-intelligence-index")).sort((a, b) => b.id.localeCompare(a.id))[0]?.id;
  const ttft = at("aa-ttft");
  const timeData = taskMetricData(snapshot, timeSource, "time");
  const decode = (rows: RankedVariant[]): MetricPoint[] => rows.flatMap((r) => { const x = timeData.get(r.variant.id)?.value; return x == null ? [] : [{ x, r }]; });
  const tokens = iiId ? at(iiId, (o) => (o.details?.outputTokensPerTask as number | undefined) ?? o.outputTokens ?? undefined) : () => [];
  const uptime = at("openrouter-uptime");
  const dates = (rows: RankedVariant[]) => rows.flatMap((r) => r.model.releaseDate ? [{ x: Date.parse(r.model.releaseDate), r }] : []);
  const has = (f: (rows: RankedVariant[]) => MetricPoint[]) => f(ranked).length >= MIN_PTS;

  const fmt = (u: string) => (x: number) => `${x.toLocaleString(undefined, { maximumFractionDigits: 2 })}${u}`;
  const fmtDate = (x: number) => new Date(x).toISOString().slice(0, 10);
  const secs = (x: number) => x >= 1000 ? `${Math.round(x / 100) / 10}k s` : fmt("s")(x);

  panels.push({ id: "tpt", title: "Time per task", desc: taskMetricDescription(timeSource, "time"), open: true, chart: { better: "lower", points: decode, xLabel: "s/task", xName: "Time per task (s)", scale: "log", secs: true, formatX: secs, aria: timeSource === "aa" ? "Index score versus estimated time per task" : "Index score versus average task-run duration" } });
  if (ranked.some((r) => r.speed)) panels.push({ id: "speed", title: "Output speed", desc: "tokens per second", open: !has(decode), speed: true });
  if (has(ttft)) panels.push({ id: "latency", title: "Latency", desc: "seconds to first token", chart: { better: "lower", points: ttft, xLabel: "s", xName: "Time to first token (s)", scale: "log", secs: true, formatX: fmt("s"), aria: "Index score versus time to first token", defaultKind: "bars" } });
  if (has(tokens)) panels.push({ id: "tokens", title: "Output tokens", desc: "tokens generated per task", chart: { better: "lower", points: tokens, xLabel: "tok", xName: "Output tokens per task", scale: "log", formatX: (x) => x >= 1000 ? `${(x / 1000).toFixed(0)}k` : `${x.toFixed(0)}`, aria: "Index score versus output tokens per task", defaultKind: "bars" } });
  if (has(dates)) panels.push({ id: "date", title: "Release date", desc: "when each model shipped", chart: { better: "lower", points: dates, xLabel: "", xName: "Release date", scale: "time", formatX: fmtDate, aria: "Index score versus model release date", defaultFrontier: false } });
  if (has(uptime)) {
    // "Nines" axis: plot -log10(downtime) so 90%, 99%, 99.9% get equal spacing.
    const nines = (rows: RankedVariant[]) => uptime(rows).map((p) => ({ r: p.r, raw: p.x, x: -Math.log10(Math.max(0.01, 100 - p.x)) }));
    panels.push({ id: "uptime", title: "Uptime", desc: "OpenRouter provider uptime, trailing 7 days", chart: { better: "higher", points: nines, xLabel: "", xName: "Uptime (%)", formatX: (t) => `${parseFloat((100 - 10 ** -t).toFixed(3))}%`, formatValue: fmt("%"), aria: "Index score versus OpenRouter uptime", defaultKind: "bars" } });
  }
  // Model-level (no effort): one point per model, on its best-scoring ranked variant.
  const usageByModel = new Map<string, number>();
  const variantModel = new Map(snapshot.variants.map((v) => [v.id, v.modelId]));
  for (const o of snapshot.observations) if (o.benchmarkId === "t3-usage-share" && o.value > 0) { const m = variantModel.get(o.variantId) ?? o.variantId.split("@")[0]; usageByModel.set(m, Math.max(usageByModel.get(m) ?? 0, o.value)); }
  const usage = (rows: RankedVariant[]): MetricPoint[] => {
    const best = new Map<string, RankedVariant>();
    for (const r of rows) if (usageByModel.has(r.model.id) && (!best.has(r.model.id) || r.score > best.get(r.model.id)!.score)) best.set(r.model.id, r);
    return [...best.values()].map((r) => ({ x: usageByModel.get(r.model.id)!, r }));
  };
  if (has(usage)) {
    const pct = (x: number) => `${x >= 10 ? x.toFixed(0) : x >= 0.1 ? x.toFixed(1) : x.toFixed(2)}%`;
    const window = snapshot.observations.find((o) => o.benchmarkId === "t3-usage-share")?.details?.window;
    panels.push({ id: "usage", title: "Usage", desc: `share of turns in T3 Code${typeof window === "string" ? `, ${window.replace(" to ", " – ")}` : ""} · via Slopalytics`, chart: { better: "higher", points: usage, xLabel: "%", xName: "Share of T3 Code turns (%)", scale: "log", formatX: pct, formatValue: pct, aria: "Index score versus T3 Code usage share", defaultKind: "bars" } });
  }
  return panels;
}

export const money = (v: number) => `$${v >= 10 ? Math.round(v) : v >= 1 ? v.toFixed(1).replace(/\.0$/, "") : v >= 0.01 ? v.toFixed(2).replace(/0$/, "") : v.toPrecision(1)}`;

/**
 * Metric-chart points honoring the effort mode. `all` passes every measured effort through;
 * `best` keeps, per model, the highest-index-score point *that has the metric* — so a model
 * whose top-scoring effort lacks the metric still appears via its best measured effort.
 */
export function pickPoints(chart: MetricChart, ranked: RankedVariant[], mode: "all" | "best"): MetricPoint[] {
  const pts = chart.points(ranked);
  if (mode === "all") return pts;
  const best = new Map<string, MetricPoint>();
  for (const p of pts) { const cur = best.get(p.r.model.id); if (!cur || p.r.score > cur.r.score) best.set(p.r.model.id, p); }
  return [...best.values()];
}

/** Index score vs measured cost per task — same fields ParetoChart passes to ScoreScatter. */
export const costChart: MetricChart & { xShort: string } = {
  better: "lower",
  points: (rows) => rows.flatMap((r) => (r.costUsd != null && r.costUsd > 0 ? [{ x: r.costUsd, r }] : [])),
  xLabel: "",
  xName: "Cost per task ($, log)",
  xShort: "$ / task (log)",
  scale: "log",
  formatX: money,
  formatValue: (v) => `$${v.toFixed(v < 0.1 ? 3 : 2)}/task`,
  aria: "Index score versus cost per task",
};

/** Output speed as a metric chart (from RankedVariant.speed, not observations). */
export const speedChart: MetricChart = {
  better: "higher",
  points: (rows) => rows.flatMap((r) => (r.speed && r.speed > 0 ? [{ x: r.speed, r }] : [])),
  xLabel: "tok/s",
  xName: "Output speed (tok/s)",
  formatX: (v) => `${Math.round(v)}`,
  aria: "Index score versus output speed",
  defaultKind: "bars",
};

/** Canonical chart-link ids (ChartLink anchors) → card titles. `rankings` uses the index name. */
export const CHART_TITLES: Record<string, string> = {
  rankings: "",
  cost: "Score vs cost per task",
  "time-per-task": "Time per task",
  "output-speed": "Output speed",
  latency: "Latency",
  "output-tokens": "Output tokens",
  "release-date": "Release date",
  uptime: "Uptime",
  strengths: "Strengths",
};

export function chartTitle(c: string | undefined): string | undefined {
  return c !== undefined && c in CHART_TITLES ? CHART_TITLES[c] || undefined : undefined;
}

/** Resolve a chart param to its card kind: "rankings" | "cost" | a metric chart. */
export function chartKind(snapshot: Snapshot, ranked: RankedVariant[], c: string | undefined, timeSource: TaskMetricSource = "aa"): { kind: "rankings" | "cost" } | { kind: "metric"; chart: MetricChart } | null {
  if (!c || c === "rankings") return { kind: "rankings" };
  if (c === "cost") return { kind: "cost" };
  if (c === "output-speed") return ranked.some((r) => r.speed) ? { kind: "metric", chart: speedChart } : null;
  const panel = metricPanels(snapshot, ranked, timeSource).find((p) => anchorOf(p.title) === c && p.chart);
  return panel?.chart ? { kind: "metric", chart: panel.chart } : null;
}
