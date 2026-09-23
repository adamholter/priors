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
export function metricPanels(snapshot: Snapshot, ranked: RankedVariant[]): MetricPanel[] {
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
  const decode = iiId ? at(iiId, (o) => (o.details?.estimatedDecodeSecondsPerTask as number | undefined) ?? undefined) : () => [];
  const tokens = iiId ? at(iiId, (o) => (o.details?.outputTokensPerTask as number | undefined) ?? o.outputTokens ?? undefined) : () => [];
  const uptime = at("openrouter-uptime");
  const dates = (rows: RankedVariant[]) => rows.flatMap((r) => r.model.releaseDate ? [{ x: Date.parse(r.model.releaseDate), r }] : []);
  const has = (f: (rows: RankedVariant[]) => MetricPoint[]) => f(ranked).length >= MIN_PTS;

  const fmt = (u: string) => (x: number) => `${x.toLocaleString(undefined, { maximumFractionDigits: 2 })}${u}`;
  const fmtDate = (x: number) => new Date(x).toISOString().slice(0, 10);
  const secs = (x: number) => x >= 1000 ? `${Math.round(x / 100) / 10}k s` : fmt("s")(x);

  if (has(decode)) panels.push({ id: "tpt", title: "Time per task", desc: "Artificial Analysis · weighted decode time per Intelligence Index task, excl. first-token wait and overhead", open: true, chart: { better: "lower", points: decode, xLabel: "s/task", xName: "Time per task (s)", scale: "log", secs: true, formatX: secs, aria: "Index score versus estimated time per task" } });
  if (ranked.some((r) => r.speed)) panels.push({ id: "speed", title: "Output speed", desc: "tokens per second", open: !has(decode), speed: true });
  if (has(ttft)) panels.push({ id: "latency", title: "Latency", desc: "seconds to first token", chart: { better: "lower", points: ttft, xLabel: "s", xName: "Time to first token (s)", scale: "log", secs: true, formatX: fmt("s"), aria: "Index score versus time to first token" } });
  if (has(tokens)) panels.push({ id: "tokens", title: "Output tokens", desc: "tokens generated per task", chart: { better: "lower", points: tokens, xLabel: "tok", xName: "Output tokens per task", scale: "log", formatX: (x) => x >= 1000 ? `${(x / 1000).toFixed(0)}k` : `${x.toFixed(0)}`, aria: "Index score versus output tokens per task" } });
  if (has(dates)) panels.push({ id: "date", title: "Release date", desc: "when each model shipped", chart: { better: "higher", points: dates, xLabel: "", xName: "Release date", scale: "time", formatX: fmtDate, aria: "Index score versus model release date" } });
  if (has(uptime)) {
    // "Nines" axis: plot -log10(downtime) so 90%, 99%, 99.9% get equal spacing.
    const nines = (rows: RankedVariant[]) => uptime(rows).map((p) => ({ r: p.r, raw: p.x, x: -Math.log10(Math.max(0.01, 100 - p.x)) }));
    panels.push({ id: "uptime", title: "Uptime", desc: "OpenRouter provider uptime, trailing 7 days", chart: { better: "higher", points: nines, xLabel: "", xName: "Uptime (%)", formatX: (t) => `${parseFloat((100 - 10 ** -t).toFixed(3))}%`, formatValue: fmt("%"), aria: "Index score versus OpenRouter uptime" } });
  }
  return panels;
}

/** Output speed as a metric chart (from RankedVariant.speed, not observations). */
export const speedChart: MetricChart = {
  better: "higher",
  points: (rows) => rows.flatMap((r) => (r.speed && r.speed > 0 ? [{ x: r.speed, r }] : [])),
  xLabel: "tok/s",
  xName: "Output speed (tok/s)",
  formatX: (v) => `${Math.round(v)}`,
  aria: "Index score versus output speed",
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
};

export function chartTitle(c: string | undefined): string | undefined {
  return c !== undefined && c in CHART_TITLES ? CHART_TITLES[c] || undefined : undefined;
}

/** Resolve a chart param to its card kind: "rankings" | "cost" | a metric chart. */
export function chartKind(snapshot: Snapshot, ranked: RankedVariant[], c: string | undefined): { kind: "rankings" | "cost" } | { kind: "metric"; chart: MetricChart } | null {
  if (!c || c === "rankings") return { kind: "rankings" };
  if (c === "cost") return { kind: "cost" };
  if (c === "output-speed") return ranked.some((r) => r.speed) ? { kind: "metric", chart: speedChart } : null;
  const panel = metricPanels(snapshot, ranked).find((p) => anchorOf(p.title) === c && p.chart);
  return panel?.chart ? { kind: "metric", chart: panel.chart } : null;
}
