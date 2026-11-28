import type { Snapshot } from "@/data/types";
import type { IndexConfig, IndexResult, RankedVariant } from "@/engine";
import { radarModelsFor, radarRows } from "@/components/chart/radar-view";
import type { RadarModel } from "@/components/chart/radar-data";
import { chartLabel, modelLabel, pickPoints, speedChart, type MetricChart } from "./metrics";

/** What the More metrics contact sheet shows for a metric: who leads, and every model's mark on the metric's own axis. Built from the points the open chart draws. */

/** The one fact a closed card states: who leads, and by how much. */
export interface Answer { modelId: string; name: string; labId: string; text: string; unit?: string; /** What the value counts, for readouts with room ("to first token"). */ qual?: string }

/** One drawn mark of a metric: what the open chart would draw for a model (or a model at one effort). */
export interface Mark extends Answer { key: string; x: number; score: number; /** The model is one of the index's top ten: drawn in its lab color, the rest in grey. */ top: boolean }

export interface Summary {
  id: string;
  title: string;
  answer: (Answer & { key?: string }) | null;
  /** Distinct models with data. */
  n: number;
  /** Best end first (Release date: newest first). */
  marks: Mark[];
  /** Per model, its best mark by the metric's direction. */
  byModel: Map<string, Mark>;
  scale: "linear" | "log" | "time";
  lo: number;
  hi: number;
  /** Strengths: the index's three top ranked models, drawn over each other. */
  strengths?: { axes: number; top: RadarModel[] };
}

export interface MetricSource { id: string; title: string; chart?: MetricChart; speed?: boolean; rows: RankedVariant[] }

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Nov 18", with the year once it is more than a year before `ref`. */
export function dateText(ms: number, ref: number) {
  const d = new Date(ms);
  return `${MONTH[d.getUTCMonth()]} ${d.getUTCDate()}${ref - ms > 365 * 864e5 ? `, ${d.getUTCFullYear()}` : ""}`;
}

const UNITS: Record<string, string> = { speed: "tok/s", tokens: "tok" };
/** What a value counts, in two or three plain words, for readouts that have room. */
const QUALIFIER: Record<string, string> = { latency: "to first token", tokens: "per task", usage: "of turns", tpt: "per task" };

/** How many models the index's top list names: the ones a reader is choosing between. */
export const CONTENDERS = 10;
/** Models drawn over each other on the Strengths card. */
export const STRENGTHS_TOP = 3;

/** The models with the highest index score, each at its best effort. */
export function contendersOf(ranked: RankedVariant[], n = CONTENDERS): Set<string> {
  const best = new Map<string, number>();
  for (const r of ranked) best.set(r.model.id, Math.max(best.get(r.model.id) ?? -Infinity, r.score));
  return new Set([...best.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([id]) => id));
}

/** A metric's summary, or null when it has no chart of its own (Strengths). The answer is the best of the index's top ten, not of all models: a 1.7B model leading latency answers nothing a reader is choosing between. */
export function metricSummary(spec: MetricSource, mode: "all" | "best", snapshot: Snapshot, contenders: Set<string>): Summary | null {
  const chart = spec.speed ? speedChart : spec.chart;
  if (!chart) return null;
  const date = spec.id === "date", ref = Date.parse(snapshot.date) || Date.now();
  const fmt = chart.formatValue ?? chart.formatX, unit = UNITS[spec.id];
  const marks: Mark[] = pickPoints(chart, spec.rows, mode).map((p) => {
    const raw = p.raw ?? p.x;
    return { key: p.r.variant.id, modelId: p.r.model.id, name: mode === "all" ? chartLabel(p.r) : modelLabel(p.r), labId: p.r.model.labId, x: p.x, text: date ? dateText(raw, ref) : fmt(raw), unit, qual: QUALIFIER[spec.id], score: p.r.score, top: contenders.has(p.r.model.id) };
  });
  const lowerBetter = chart.better === "lower" && !date;
  marks.sort((a, b) => (lowerBetter ? a.x - b.x : b.x - a.x) || b.score - a.score);
  const byModel = new Map<string, Mark>();
  for (const m of marks) if (!byModel.has(m.modelId)) byModel.set(m.modelId, m);
  const lo = marks.reduce((a, m) => Math.min(a, m.x), Infinity), hi = marks.reduce((a, m) => Math.max(a, m.x), -Infinity);
  return {
    id: spec.id, title: spec.title, answer: marks.find((m) => m.top) ?? marks[0] ?? null, n: byModel.size, marks, byModel,
    scale: chart.scale === "log" ? "log" : chart.scale === "time" ? "time" : "linear", lo: marks.length ? lo : 0, hi: marks.length ? hi : 1,
  };
}

/** The first `n` models by index rank. */
export const topRanked = (models: RadarModel[], n = STRENGTHS_TOP) => [...models].sort((a, b) => a.rank - b.rank).slice(0, n);

export function strengthsSummary(radar: { ranked: RankedVariant[]; benchmarks: IndexResult["benchmarks"]; config: IndexConfig }, snapshot: Snapshot, title = "Strengths"): Summary | null {
  const { axes, models } = radarModelsFor(radarRows(snapshot, radar.config, radar.ranked, radar.benchmarks), radar.benchmarks, "rank");
  if (!models.length || axes.length < 3) return null;
  const top = topRanked(models), lead = top[0];
  return { id: "strengths", title, answer: { modelId: lead.id, name: lead.name, labId: lead.labId, text: "" }, n: models.length, marks: [], byModel: new Map(), scale: "linear", lo: 0, hi: 1, strengths: { axes: axes.length, top } };
}

/** Position (0 to 1) of a value along the metric's own axis, as its open chart draws it. */
export function axisOf(s: Pick<Summary, "scale" | "lo" | "hi">) {
  const f = s.scale === "log" ? (v: number) => Math.log10(Math.max(v, 1e-9)) : (v: number) => v;
  const a = f(s.lo), b = f(s.hi);
  return (x: number) => (b === a ? 0.5 : (f(x) - a) / (b - a));
}
