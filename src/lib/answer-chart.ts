/**
 * Charts the assistant embeds in an answer. The server fills every value from the data (the model
 * only picks the chart and where it goes), and the browser draws it with Priors' chart palette, so
 * it follows the viewer's theme. Marks carry the lab's base color; the client theme-adjusts it.
 */
export interface AnswerMetric { name: string; unit: string; better: "higher" | "lower"; log?: boolean }
export interface AnswerMark { label: string; modelId: string; labId: string; color?: string }

export type AnswerChart = AnswerChartShape & { spec?: ChartSpec; index?: string };

/** What the assistant asked for, as passed to make_chart; the server redraws it from this, so a link can carry it. */
export type ChartSpec = Record<string, unknown>;
type AnswerChartShape =
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

/** A chart's recipe in a URL: base64url JSON, so any chart the assistant can draw can be linked. */
export function encodeSpec(spec: ChartSpec): string {
  const bytes = new TextEncoder().encode(JSON.stringify(spec));
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function decodeSpec(s: string): ChartSpec | null {
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/")), v = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    return v && typeof v === "object" && !Array.isArray(v) ? v as ChartSpec : null;
  } catch { return null; }
}
/** Link to the builder with this index and the chart open over it. `look` is the theme and light/dark mode the preview image uses. */
export function chartLink(origin: string, chart: Pick<AnswerChart, "spec" | "index">, look?: { theme?: string; scheme?: "light" | "dark" }): string | undefined {
  if (!chart.spec || !chart.index) return undefined;
  const q = new URLSearchParams({ i: chart.index, chart: encodeSpec(chart.spec) });
  // The sharer's look, which the link's preview image is drawn in (as the share dialog's cards do).
  if (look?.theme) q.set("theme", look.theme);
  if (look?.scheme) q.set("scheme", look.scheme);
  // As prettyQuery in lib/url writes it: the `|` inside an index stays escaped, since chat apps cut a link at a bare pipe.
  return `${origin}/?${q.toString().replace(/%3A/g, ":").replace(/%2C/g, ",").replace(/%3D/g, "=").replace(/%2520/g, "+")}`;
}
