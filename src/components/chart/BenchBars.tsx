"use client";
import type { EChartsOption } from "echarts";
import { useEffect, useMemo } from "react";
import { useChartPalette, useEChart } from "./echarts";
import { CONTAIN_AXIS_LABELS, markFill, markSize, textSize, type ChartPalette } from "./theme";
import { formatValue, type RadarAxis } from "./radar-data";
import type { RadarSeries } from "./radar-view";

/** What one benchmark's chart plots: every selected model that has a value, best first. */
export function benchBars(axis: RadarAxis, index: number, series: RadarSeries[]) {
  return series.flatMap((s) => { const p = s.points[index]; return p?.value == null ? [] : [{ s, p, height: p.raw ?? p.value }]; })
    .sort((a, b) => b.p.value! - a.p.value! || a.s.name.localeCompare(b.s.name));
}

function barOption(axis: RadarAxis, index: number, series: RadarSeries[], pal: ChartPalette, focus: string | null, narrow: boolean): EChartsOption {
  const t = textSize(pal), bars = benchBars(axis, index, series), sans = pal.fonts?.sans ?? "var(--font-inter), Inter, sans-serif";
  return {
    animationDurationUpdate: 350,
    grid: { left: 6, right: 6, top: 24, bottom: (narrow ? 64 : 76) * t, ...CONTAIN_AXIS_LABELS },
    xAxis: { type: "category", data: bars.map((b) => b.s.name), axisLabel: { rotate: 40, interval: 0, fontSize: 10.5 * t, color: pal.ink2, fontFamily: sans, width: 110 * t, overflow: "truncate" }, axisTick: { show: false }, axisLine: { show: false } },
    yAxis: { type: "value", min: 0, axisLabel: { show: false } },
    tooltip: { trigger: "item", confine: true, formatter: (p: unknown) => { const b = bars[(p as { dataIndex: number }).dataIndex]; return b ? `<div style="font-weight:600">${b.s.name}</div><div style="font-family:var(--font-jetbrains);margin-top:4px">${formatValue(b.p, axis)}${b.p.estimated ? (b.p.estimateRange ? ` (estimated, ${b.p.estimateRange[0].toFixed(0)} to ${b.p.estimateRange[1].toFixed(0)})` : " (estimated)") : ""} · ${axis.name}</div>` : ""; } },
    series: [{
      type: "bar", id: "bench", barMaxWidth: 34 * markSize(pal), barCategoryGap: "22%",
      data: bars.map((b) => ({ value: b.height, itemStyle: { color: markFill(b.s.color, pal), opacity: focus && focus !== b.s.id ? 0.3 : b.p.estimated ? 0.6 : 1, borderRadius: [pal.style?.barRadius ?? 2, pal.style?.barRadius ?? 2, 0, 0] } })),
      label: { show: true, position: "top", distance: 3, color: pal.ink, fontSize: 10 * t, fontFamily: pal.fonts?.mono ?? "var(--font-jetbrains), monospace", formatter: (p: { dataIndex: number }) => formatValue(bars[p.dataIndex].p, axis).replace(/\.0%$/, "%") },
    }],
  };
}

function BenchBarCard({ axis, index, series, focus, onInfo, register }: { axis: RadarAxis; index: number; series: RadarSeries[]; focus: string | null; onInfo: (id: string) => void; register: (id: string, svg: (() => string | undefined) | null) => void }) {
  const pal = useChartPalette();
  const option = useMemo(() => barOption(axis, index, series, pal, focus, false), [axis, index, series, pal, focus]);
  const { ref, chart } = useEChart(option, [option]);
  useEffect(() => { register(axis.id, () => chart.current?.renderToSVGString()); return () => register(axis.id, null); }, [axis.id, chart, register]);
  const empty = !series.some((s) => s.points[index]?.value != null);
  return <section className="rl-bench">
    <button type="button" className="rl-bench-head" onClick={() => onInfo(axis.id)} title={`About ${axis.name}`}>
      <span className="rl-bench-name">{axis.name}</span>
      <span className="cap rl-bench-share">{axis.share.toFixed(0)}% of index</span>
    </button>
    {empty ? <p className="cap rl-bench-empty">None of these models has a score here.</p> : <div ref={ref} role="img" aria-label={`${axis.name}: ${benchBars(axis, index, series).map((b) => `${b.s.name} ${formatValue(b.p, axis)}`).join(", ")}`} className="rl-bench-chart" />}
  </section>;
}

/** One bar chart per benchmark in the index, the Artificial Analysis way: same models on every chart, best first. */
export function BenchBars({ axes, series, focus, onInfo, register }: { axes: RadarAxis[]; series: RadarSeries[]; focus: string | null; onInfo: (id: string) => void; register: (id: string, svg: (() => string | undefined) | null) => void }) {
  return <div className="rl-bench-grid">{axes.map((a, i) => <BenchBarCard key={a.id} axis={a} index={i} series={series} focus={focus} onInfo={onInfo} register={register} />)}</div>;
}

/** A static sheet of every benchmark chart (PNG/SVG export), built from the charts that are on screen. */
export function benchSheetSvg(axes: RadarAxis[], svgs: Map<string, () => string | undefined>, pal: { bg: string; ink: string; grey: string }, title: string) {
  const cols = Math.min(3, axes.length), cw = 520, ch = 330, head = 64, gap = 16, rows = Math.ceil(axes.length / cols);
  const W = cols * cw + (cols + 1) * gap, H = head + rows * (ch + 40) + gap;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  const cells = axes.map((a, i) => {
    const x = gap + (i % cols) * (cw + gap), y = head + Math.floor(i / cols) * (ch + 40);
    const inner = svgs.get(a.id)?.();
    const nested = inner ? inner.replace(/^<svg[^>]*?width="(\d+)"[^>]*?height="(\d+)"[^>]*?>/, (_, w, h) => `<svg x="${x}" y="${y + 30}" width="${cw}" height="${ch}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">`) : "";
    return `<text x="${x}" y="${y + 18}" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="600" fill="${pal.ink}">${esc(a.name)}</text>${nested}`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${pal.bg}"/><text x="${gap}" y="38" font-family="Newsreader, Georgia, serif" font-size="26" fill="${pal.ink}">${esc(title)}</text>${cells.join("")}<text x="${gap}" y="${H - 8}" font-family="'JetBrains Mono', monospace" font-size="11" fill="${pal.grey}">mypriors.com</text></svg>`;
}
