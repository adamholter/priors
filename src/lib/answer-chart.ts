/**
 * Charts the assistant embeds in an answer. The server fills every value from the data (the model
 * only picks the chart and where it goes), and the browser draws it with Priors' chart palette, so
 * it follows the viewer's theme. Marks carry the lab's base color; the client theme-adjusts it.
 */
export interface AnswerMetric { name: string; unit: string; better: "higher" | "lower"; log?: boolean }
export interface AnswerMark { label: string; modelId: string; labId: string; color?: string }

export type AnswerChart =
  /** One value per mark, best first. */
  | { kind: "bar"; title: string; metric: AnswerMetric; items: (AnswerMark & { value: number })[] }
  /** Side-by-side bars: one group per model, one bar per effort (or per metric). */
  | { kind: "grouped"; title: string; metric: AnswerMetric; series: string[]; groups: (AnswerMark & { values: (number | null)[] })[] }
  /** A metric across reasoning efforts, one line per model. */
  | { kind: "lines"; title: string; metric: AnswerMetric; x: string[]; lines: (AnswerMark & { values: (number | null)[] })[] }
  /** Two metrics against each other, one point per mark. */
  | { kind: "scatter"; title: string; x: AnswerMetric; y: AnswerMetric; points: (AnswerMark & { x: number; y: number })[] };

/** Where a chart sits in the reply text: a line of its own reading `[[chart:N]]`. */
export const CHART_TOKEN = /\[\[chart:(\d+)\]\]/g;

/** Format a value in a metric's unit for labels and tooltips. */
export function formatMetric(m: Pick<AnswerMetric, "unit">, v: number): string {
  const abs = Math.abs(v), digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  const raw = abs > 0 && abs < 0.01 ? Math.abs(v).toPrecision(2) : Math.abs(v).toFixed(digits);
  const n = raw.includes(".") && !raw.includes("e") ? raw.replace(/0+$/, "").replace(/\.$/, "") : raw, sign = v < 0 ? "−" : "";
  if (m.unit === "$") return `${sign}$${n}`;
  if (m.unit === "%") return `${sign}${n}%`;
  if (m.unit === "s") return `${sign}${n}s`;
  return m.unit && m.unit !== "pts" ? `${sign}${n} ${m.unit}` : `${sign}${n}`;
}
