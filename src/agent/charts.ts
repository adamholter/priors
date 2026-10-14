/**
 * Data questions: tables and charts built from the user's current mix and the published data.
 * The model names what to show; every number here comes from DataView, never from the model.
 */
import type { AnswerChart, AnswerMark, AnswerMetric } from "../lib/answer-chart";
import { byEffort, resolveMetric, type DataView, type Metric } from "./data";
import type { RankedVariant } from "../engine";

type Efforts = "best" | "all" | string[];
export type DataArgs = { labs?: string[]; metrics?: string[]; metric?: string; x_metric?: string; models?: string[]; top?: number; efforts?: Efforts; from_effort?: string; to_effort?: string; delta?: "absolute" | "percent"; type?: string; title?: string };

const EFFORT_ALIAS: Record<string, string> = { "extra high": "xhigh", "x-high": "xhigh", maximum: "max", med: "medium" };
const effortList = (e: unknown): Efforts | undefined => {
  if (e === "best" || e === "all") return e;
  if (!Array.isArray(e) || !e.length) return undefined;
  const list = e.map((x) => EFFORT_ALIAS[String(x).toLowerCase()] ?? String(x).toLowerCase());
  return list.length === 1 && (list[0] === "best" || list[0] === "all") ? (list[0] as "best" | "all") : list;
};

/** Models fill every optional field (top: 0, models: [], x_metric: ""); empty means unset. */
function clean(args: DataArgs): DataArgs {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (v === "" || v == null || (Array.isArray(v) && !v.length) || (k === "top" && !(Number(v) > 0))) continue;
    out[k] = v;
  }
  return out as DataArgs;
}
const effortWord = (e: string) => EFFORT_ALIAS[e.toLowerCase()] ?? e.toLowerCase();
const am = (m: Metric): AnswerMetric => ({ name: m.name, unit: m.unit, better: m.better, ...(m.log ? { log: true } : {}) });
const label = (r: RankedVariant, withEffort: boolean) => withEffort && r.variant.effort !== "default" ? `${r.model.name} ${r.variant.effort}` : r.model.name;
const round = (v: number) => +v.toPrecision(4);

function metricsOf(view: DataView, names: string[]): { metrics: Metric[]; unknown: string[] } {
  const metrics: Metric[] = [], unknown: string[] = [];
  for (const n of names) { const m = resolveMetric(view.snapshot, n); if (m) metrics.push(m); else unknown.push(n); }
  return { metrics, unknown };
}

/** A table of values: rows per model (or per model and effort) for one or more metrics. */
export function queryData(view: DataView, raw: DataArgs) {
  const args = clean(raw);
  const { metrics, unknown: unknownMetrics } = metricsOf(view, args.metrics?.length ? args.metrics : ["index"]);
  if (!metrics.length) return { error: `Unknown metric: ${unknownMetrics.join(", ")}. Use index, cost, time, speed, latency, tokens or a benchmark name (search_benchmarks finds them).` };
  const efforts = effortList(args.efforts) ?? "best";
  const { rows, unknown, unranked } = view.pick(args.models, args.top, efforts, args.labs);
  const labs = new Map(view.snapshot.labs.map((l) => [l.id, l.name]));
  const table = rows.slice(0, 60).map((r) => { const row = view.row(r, metrics); return { model: row.model, lab: labs.get(row.labId) ?? row.labId, effort: row.effort, rank: row.rank, ...Object.fromEntries(metrics.map((m) => [m.name, row.values[m.key] == null ? null : round(row.values[m.key]!)])) }; });
  return {
    metrics: metrics.map((m) => ({ name: m.name, unit: m.unit, better: m.better })), rows: table,
    note: [
      unknownMetrics.length ? `Unknown metrics: ${unknownMetrics.join(", ")}.` : "",
      unknown.length ? `Not in the data: ${unknown.join(", ")}.` : "",
      unranked.length ? `Not ranked under this index (filtered out or too little measured data), so no index score or rank: ${unranked.join(", ")}. Their published benchmark values are still shown.` : "",
      rows.length > 60 ? `Showing 60 of ${rows.length} rows.` : "",
      "rank is the model's position in the user's ranking; null values are not measured.",
    ].filter(Boolean).join(" "),
  };
}

/** Build a chart spec from the data. Returns the chart plus the numbers it shows, for the reply. */
export function makeChart(view: DataView, raw: DataArgs): { chart?: AnswerChart; shown?: unknown; missing?: string[]; error?: string } {
  const args = clean(raw);
  const type = args.type ?? "bar";
  const metric = resolveMetric(view.snapshot, args.metric ?? "index");
  if (!metric) return { error: `Unknown metric: ${args.metric}. Use index, cost, time, speed, latency, tokens or a benchmark name.` };
  const efforts = effortList(args.efforts);
  const mark = (r: RankedVariant, withEffort: boolean): AnswerMark => ({ label: label(r, withEffort), modelId: r.model.id, labId: r.model.labId, color: view.snapshot.labs.find((l) => l.id === r.model.labId)?.color });
  const notFound = (p: ReturnType<DataView["pick"]>) => [...p.unknown.map((x) => `${x} (not in the data)`), ...(metric.key === "index" || metric.key === "cost" || metric.key === "speed" ? p.unranked.map((x) => `${x} (not ranked under this index)`) : [])];

  if (type === "bar") {
    const p = view.pick(args.models, args.top ?? (args.labs ? undefined : 12), efforts ?? "best", args.labs), withEffort = efforts !== "best" && efforts !== undefined;
    const items = p.rows.map((r) => ({ ...mark(r, withEffort), value: view.value(metric, r) })).filter((x): x is AnswerMark & { value: number } => x.value != null);
    const missing = [...notFound(p), ...p.rows.filter((r) => view.value(metric, r) == null).map((r) => `${label(r, withEffort)} (no ${metric.name})`)];
    items.sort((a, b) => metric.better === "higher" ? b.value - a.value : a.value - b.value);
    if (!items.length) return { error: `No ${metric.name} values for those models.`, missing };
    const chart: AnswerChart = { kind: "bar", title: args.title ?? metric.name, metric: am(metric), items: items.slice(0, 24) };
    return { chart, shown: chart.items.map((i) => ({ [i.label]: round(i.value) })), missing };
  }

  if (type === "effort_lines" || type === "effort_compare") {
    const p = view.pick(args.models, args.top ?? (args.labs ? undefined : type === "effort_lines" ? 6 : 8), type === "effort_compare" ? (Array.isArray(efforts) ? efforts : ["xhigh", "max"]) : "all", args.labs);
    const byModel = new Map<string, RankedVariant[]>();
    for (const r of p.rows) (byModel.get(r.model.id) ?? byModel.set(r.model.id, []).get(r.model.id)!).push(r);
    const xs = type === "effort_compare" ? (Array.isArray(efforts) ? efforts : ["xhigh", "max"]) : [...new Set(p.rows.filter((r) => view.value(metric, r) != null && r.variant.effort !== "default").map((r) => r.variant.effort))].sort((a, b) => byEffort({ effort: a }, { effort: b }));
    const marks = [...byModel.values()].map((rs) => ({ ...mark(rs[0], false), values: xs.map((e) => { const r = rs.find((x) => x.variant.effort === e); return r ? view.value(metric, r) : null; }) }));
    const kept = marks.filter((m) => m.values.filter((v) => v != null).length >= (type === "effort_lines" ? 2 : 1));
    const missing = [...notFound(p), ...marks.filter((m) => !kept.includes(m)).map((m) => `${m.label} (fewer than ${type === "effort_lines" ? 2 : 1} measured efforts)`)];
    if (!kept.length) return { error: `None of those models has ${metric.name} at ${type === "effort_lines" ? "two or more efforts" : xs.join(" or ")}.`, missing };
    const chart: AnswerChart = type === "effort_lines"
      ? { kind: "lines", title: args.title ?? `${metric.name} by reasoning effort`, metric: am(metric), x: xs, lines: kept.slice(0, 10) }
      : { kind: "grouped", title: args.title ?? `${metric.name}: ${xs.join(" vs ")}`, metric: am(metric), series: xs, groups: kept.slice(0, 16) };
    return { chart, shown: kept.map((m) => ({ model: m.label, ...Object.fromEntries(xs.map((e, i) => [e, m.values[i] == null ? null : round(m.values[i]!)])) })), missing };
  }

  if (type === "effort_delta") {
    const from = effortWord(args.from_effort ?? "xhigh"), to = effortWord(args.to_effort ?? "max"), pct = args.delta === "percent";
    const p = view.pick(args.models, args.top ?? (args.labs ? undefined : 15), [from, to], args.labs);
    const byModel = new Map<string, { a?: number; b?: number; r: RankedVariant }>();
    for (const r of p.rows) { const v = view.value(metric, r), e = byModel.get(r.model.id) ?? { r }; if (v != null) { if (r.variant.effort === from) e.a = v; if (r.variant.effort === to) e.b = v; } byModel.set(r.model.id, e); }
    const items = [...byModel.values()].filter((e) => e.a != null && e.b != null && (!pct || e.a !== 0)).map((e) => ({ ...mark(e.r, false), value: pct ? ((e.b! - e.a!) / Math.abs(e.a!)) * 100 : e.b! - e.a!, from: e.a!, to: e.b! }));
    const missing = [...notFound(p), ...[...byModel.values()].filter((e) => e.a == null || e.b == null).map((e) => `${e.r.model.name} (${e.a == null ? from : to} not measured)`)];
    items.sort((a, b) => b.value - a.value);
    if (!items.length) return { error: `No model in that set has ${metric.name} at both ${from} and ${to}.`, missing };
    const chart: AnswerChart = { kind: "bar", title: args.title ?? `${metric.name}: ${to} minus ${from}${pct ? " (%)" : ""}`, metric: { name: `${metric.name}, ${to} − ${from}`, unit: pct ? "%" : metric.unit, better: metric.better }, items: items.slice(0, 24).map((i) => ({ label: i.label, modelId: i.modelId, labId: i.labId, color: i.color, value: i.value })) };
    return { chart, shown: items.map((i) => ({ model: i.label, [from]: round(i.from), [to]: round(i.to), change: round(i.value) })), missing };
  }

  if (type === "scatter") {
    const x = resolveMetric(view.snapshot, args.x_metric ?? "cost");
    if (!x) return { error: `Unknown x metric: ${args.x_metric}.` };
    const p = view.pick(args.models, args.top ?? (args.labs ? undefined : 20), efforts ?? "best", args.labs), withEffort = efforts !== undefined && efforts !== "best";
    const points = p.rows.map((r) => ({ ...mark(r, withEffort), x: view.value(x, r), y: view.value(metric, r) })).filter((q): q is AnswerMark & { x: number; y: number } => q.x != null && q.y != null);
    if (points.length < 2) return { error: `Too few models have both ${x.name} and ${metric.name}.` };
    const chart: AnswerChart = { kind: "scatter", title: args.title ?? `${metric.name} vs ${x.name}`, x: am(x), y: am(metric), points: points.slice(0, 40) };
    return { chart, shown: chart.points.map((q) => ({ model: q.label, [x.name]: round(q.x), [metric.name]: round(q.y) })), missing: notFound(p) };
  }
  return { error: `Unknown chart type ${type}.` };
}
