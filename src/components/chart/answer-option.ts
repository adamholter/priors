import type { EChartsOption } from "echarts";
import { formatMetric, type AnswerChart, type AnswerMark } from "@/lib/answer-chart";
import { CONTAIN_AXIS_LABELS, dimColor, insideLabels, markColor, markLabel, MONO, SANS, type ChartPalette } from "./theme";

const ROW = 24;

/** Plot height for a chart in an assistant answer: bars grow with their rows, the rest are fixed. */
export function answerHeight(c: AnswerChart): number {
  if (c.kind === "bar") return 40 + c.items.length * ROW;
  if (c.kind === "grouped") return 40 + c.groups.length * (ROW + 8);
  return c.kind === "lines" ? 260 : 280;
}

/**
 * ECharts options for an assistant chart, in the viewer's palette: lab colors through markColor, the
 * theme's fonts and grid, values in the metric's unit. Bars are horizontal so model names stay
 * readable in a narrow panel.
 */
export function answerOption(c: AnswerChart, pal: ChartPalette, width: () => number | undefined = () => undefined): EChartsOption {
  const color = (m: AnswerMark) => markColor(m.color, pal, m.labId), mono = pal.fonts?.mono ?? MONO, sans = pal.fonts?.sans ?? SANS;
  const valueLabel = (fmt: (v: number) => string) => ({ show: true, position: "right" as const, distance: 6, fontFamily: mono, fontSize: 10.5, color: pal.ink2, formatter: (p: { value?: unknown }) => fmt(Number(p.value)) });
  const tip = (lines: string[]) => lines.map((l, i) => i ? `<div>${l}</div>` : `<div style="font-weight:600">${l}</div>`).join("");
  const category = (labels: string[]) => ({ type: "category" as const, data: labels, inverse: true, axisLabel: { color: pal.ink, fontFamily: sans, fontSize: 11.5, width: 150, overflow: "truncate" as const }, axisLine: { show: false }, axisTick: { show: false } });

  if (c.kind === "bar") {
    const f = (v: number) => formatMetric(c.metric, v), neg = c.items.some((i) => i.value < 0);
    return {
      grid: { left: 8, right: 56, top: 8, bottom: 8, ...CONTAIN_AXIS_LABELS },
      xAxis: { type: "value", axisLabel: { show: false }, splitLine: { show: neg } },
      yAxis: category(c.items.map((i) => i.label)),
      tooltip: { trigger: "item", formatter: (p: unknown) => { const i = c.items[(p as { dataIndex: number }).dataIndex]; return tip([i.label, `${c.metric.name}: ${f(i.value)}`]); } },
      series: [{ type: "bar", barMaxWidth: 14, data: c.items.map((i) => ({ value: i.value, itemStyle: { color: color(i), borderRadius: i.value < 0 ? [2, 0, 0, 2] : [0, 2, 2, 0] }})), label: valueLabel(f) }],
    };
  }
  if (c.kind === "grouped") {
    const f = (v: number) => formatMetric(c.metric, v), last = c.series.length - 1;
    // Lighter bars for lower efforts, the lab's full color for the last series (the figure's key says which).
    const shade = (m: AnswerMark, s: number) => s === last ? color(m) : dimColor(color(m), pal, 0.35 + 0.35 * ((last - s) / Math.max(1, last)));
    return {
      grid: { left: 8, right: 56, top: 8, bottom: 8, ...CONTAIN_AXIS_LABELS },
      xAxis: { type: "value", axisLabel: { show: false } },
      yAxis: category(c.groups.map((g) => g.label)),
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, formatter: (ps: unknown) => { const list = ps as { dataIndex: number }[], g = c.groups[list[0]?.dataIndex ?? 0]; return tip([g.label, ...c.series.map((s, i) => `${s}: ${g.values[i] == null ? "not measured" : f(g.values[i]!)}`)]); } },
      series: c.series.map((s, si) => ({ type: "bar" as const, name: s, barMaxWidth: 10, barGap: "20%", data: c.groups.map((g) => ({ value: g.values[si], itemStyle: { color: shade(g, si), borderRadius: [0, 2, 2, 0] } })), label: valueLabel(f) })),
    };
  }
  if (c.kind === "lines") {
    const f = (v: number) => formatMetric(c.metric, v);
    return {
      grid: { left: 8, right: 96, top: 12, bottom: 8, ...CONTAIN_AXIS_LABELS },
      xAxis: { type: "category", data: c.x, boundaryGap: false, axisLabel: { color: pal.ink2, fontFamily: sans, fontSize: 11 } },
      yAxis: { type: c.metric.log ? "log" : "value", scale: true, axisLabel: { formatter: (v: number) => f(v) } },
      tooltip: { trigger: "axis", formatter: (ps: unknown) => { const list = ps as { seriesName: string; value: number | null; axisValue: string }[]; return tip([list[0]?.axisValue ?? "", ...list.filter((p) => p.value != null).sort((a, b) => Number(b.value) - Number(a.value)).map((p) => `${p.seriesName}: ${f(Number(p.value))}`)]); } },
      series: c.lines.map((l) => ({ type: "line" as const, name: l.label, data: l.values, connectNulls: true, symbolSize: 6, lineStyle: { width: 2, color: color(l) }, itemStyle: { color: color(l) }, endLabel: { show: true, formatter: "{a}", color: pal.ink, fontSize: 11, distance: 6 }, labelLayout: { hideOverlap: true }, emphasis: { focus: "series" as const } })),
    };
  }
  const fx = (v: number) => formatMetric(c.x, v), fy = (v: number) => formatMetric(c.y, v);
  return {
    grid: { left: 8, right: 24, top: 16, bottom: 28, ...CONTAIN_AXIS_LABELS },
    xAxis: { type: c.x.log ? "log" : "value", scale: true, name: c.x.name, nameLocation: "middle", nameGap: 26, nameTextStyle: { color: pal.grey, fontSize: 11 }, axisLabel: { formatter: (v: number) => fx(v) } },
    yAxis: { type: c.y.log ? "log" : "value", scale: true, name: c.y.name, nameTextStyle: { color: pal.grey, fontSize: 11, align: "left" }, axisLabel: { formatter: (v: number) => fy(v) } },
    tooltip: { trigger: "item", formatter: (p: unknown) => { const q = c.points[(p as { dataIndex: number }).dataIndex]; return tip([q.label, `${c.y.name}: ${fy(q.y)}`, `${c.x.name}: ${fx(q.x)}`]); } },
    series: [{ type: "scatter", symbolSize: 9, data: c.points.map((q) => ({ value: [q.x, q.y], name: q.label, itemStyle: { color: color(q) } })), label: { ...markLabel(pal), fontSize: 10.5 }, labelLayout: insideLabels(width) }],
  };
}
