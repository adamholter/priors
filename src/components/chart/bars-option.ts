import type { EChartsOption } from "echarts";
import type { Lab } from "../../data/types";
import { CONTAIN_AXIS_LABELS, markColor, type ChartPalette } from "./theme";
import { chartLabel } from "../../lib/metrics";
import type { ScatterPoint } from "./scatter-option";

const value = (p: ScatterPoint) => p.raw ?? p.x;

/** Bar labels: round to what a reader compares (189 s, 45.2%, 0.83 s), keeping the metric's unit. */
export const compact = (format: (x: number) => string) => (v: number) => {
  const unit = format(1).replace(/^[$]?[\d.,]+/, ""), dollar = format(1).startsWith("$");
  const n = Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : Math.abs(v) >= 100 ? Math.round(v).toString() : Math.abs(v) >= 10 ? v.toFixed(1) : v.toPrecision(2);
  return `${dollar ? "$" : ""}${n}${unit.replace(/^k(?=\s|$)/, "")}`;
};

/** Top `cap` points by index score, drawn in metric order. The caller's effort mode applies. */
export function selectBars(pts: ScatterPoint[], better: "lower" | "higher", cap: number): ScatterPoint[] {
  const top = [...pts].sort((a, b) => b.r.score - a.r.score).slice(0, cap);
  return top.sort((a, b) => better === "lower" ? value(a) - value(b) : value(b) - value(a));
}

/** The ECharts option behind MetricBars — shared verbatim by the browser chart and /og rasterizer. */
export function barsOption({ bars, labs, xName, formatValue, pal, narrow }: {
  bars: ScatterPoint[]; labs: Lab[]; xName: string; formatValue: (x: number) => string; pal: ChartPalette; narrow: boolean;
}): EChartsOption {
  const color = new Map(labs.map((l) => [l.id, l.color]));
  return {
    grid: { left: 52, right: 16, top: 52, bottom: 96, ...CONTAIN_AXIS_LABELS },
    xAxis: { type: "category", data: bars.map((p) => chartLabel(p.r)), axisLabel: { rotate: 45, interval: 0, fontSize: 10.5, color: pal.ink2, fontFamily: "var(--font-inter), Inter, sans-serif", width: 110, overflow: "truncate" }, axisTick: { show: false } },
    yAxis: { type: "value", name: xName, nameTextStyle: { color: pal.grey, fontSize: 11, align: "left", padding: [0, 0, 0, -30] }, axisLabel: { formatter: (v: number) => compact(formatValue)(v) } },
    tooltip: { trigger: "item", confine: true, formatter: (p: unknown) => { const d = bars[(p as { dataIndex: number }).dataIndex]; return d ? `<div style="font-weight:600">${chartLabel(d.r)}</div><div style="font-family:var(--font-jetbrains);margin-top:4px">${formatValue(value(d))} · index ${d.r.score.toFixed(1)}</div>` : ""; } },
    series: [{
      type: "bar", id: "bars", barMaxWidth: 28,
      data: bars.map((p) => ({ value: value(p), itemStyle: { color: markColor(color.get(p.r.model.labId), pal, p.r.model.labId), borderRadius: [2, 2, 0, 0] } })),
      label: { show: true, position: "top", fontSize: narrow ? 9 : 10, color: pal.ink, fontFamily: "var(--font-jetbrains), monospace", formatter: (p: { value?: unknown }) => compact(formatValue)(Number(p.value)) },
      animationDurationUpdate: 350,
    }],
  };
}
