"use client";
import { useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { CONTAIN_AXIS_LABELS, insideLabels, useChartPalette, useEChart } from "../chart/echarts";

export type StripPoint = { key: string; value: number; label: string; tip: string };

/** Stable 0..1 jitter per point, so the strip doesn't reshuffle between renders. */
function jitter(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

/**
 * The field spread along one value, jittered so points don't stack: everyone else ghosted, this
 * model's points in its lab color (labeled), the leader ringed, the median dashed.
 */
export function FieldStrip({ field, mine, lead, color, fmt, tick = fmt, log, inverse, aria, height = 150 }: {
  field: StripPoint[]; mine: StripPoint[]; lead?: StripPoint; color: string; fmt: (v: number) => string; /** Axis ticks, shorter than `fmt` (no unit) so they fit on a phone. */ tick?: (v: number) => string; log?: boolean; inverse?: boolean; aria: string; height?: number;
}) {
  const pal = useChartPalette();
  const [plotW, setPlotW] = useState(0);
  const option = useMemo<EChartsOption>(() => {
    const all = [...field, ...mine].map((p) => p.value).sort((a, b) => a - b), mid = all[Math.floor(all.length / 2)];
    const y = (p: StripPoint) => 0.18 + jitter(p.key) * 0.64;
    const tip = (p: unknown) => (p as { data?: { tip?: string } }).data?.tip ?? "";
    // Neighbouring efforts alternate their labels above and below, so close values don't collide.
    const order = new Map([...mine].sort((a, b) => a.value - b.value).map((p, i) => [p.key, i]));
    // The leader's name only when it sits clear of this model's points (on the axis's own scale); the ring and tooltip stay.
    const pos = (v: number) => (log ? Math.log10(Math.max(v, 1e-9)) : v), span = (pos(all[all.length - 1]) - pos(all[0])) || 1;
    const named = lead && mine.every((p) => Math.abs(pos(p.value) - pos(lead.value)) / span > 0.14);
    // Near either end the name goes on the inward side so it isn't cut off.
    const at = lead ? (pos(lead.value) - pos(all[0])) / span : 0.5, side = (inverse ? 1 - at : at) < 0.15 ? "right" as const : (inverse ? 1 - at : at) > 0.85 ? "left" as const : "bottom" as const;
    return {
      grid: { left: 12, right: 18, top: 24, bottom: 30, ...CONTAIN_AXIS_LABELS },
      xAxis: { type: log ? "log" : "value", scale: true, inverse, splitNumber: plotW && plotW < 420 ? 3 : 4, axisLabel: { formatter: (v: number) => tick(v), hideOverlap: true } },
      yAxis: { type: "value", min: 0, max: 1, show: false },
      tooltip: { trigger: "item", confine: true, formatter: tip },
      series: [
        { type: "scatter", id: "ghost", symbolSize: 7, data: field.map((p) => ({ value: [p.value, y(p)], tip: p.tip })), itemStyle: { color: pal.grey, opacity: pal.dark ? 0.35 : 0.32 }, emphasis: { itemStyle: { opacity: 0.9 } }, z: 1,
          markLine: { silent: true, symbol: "none", label: { show: true, position: "end", formatter: "median", color: pal.grey, fontSize: 10 }, lineStyle: { color: pal.grey, type: "dashed", width: 1 }, data: mid == null ? [] : [{ xAxis: mid }] } },
        ...(lead ? [{ type: "scatter" as const, id: "lead", symbolSize: 12, data: [{ value: [lead.value, y(lead)], name: lead.label, tip: lead.tip }], itemStyle: { color: "transparent", borderColor: pal.ink, borderWidth: 1.5 }, label: { show: !!named, position: side, formatter: "{b}", fontSize: 10.5, color: pal.ink2, distance: 5, textBorderColor: pal.bg, textBorderWidth: 3 }, labelLayout: { hideOverlap: true }, z: 2 }] : []),
        { type: "scatter", id: "mine", symbolSize: 12, data: mine.map((p) => ({ value: [p.value, 0.5], name: p.label, tip: p.tip, label: { position: order.get(p.key)! % 2 ? "bottom" as const : "top" as const } })), itemStyle: { color, borderColor: pal.ink, borderWidth: 1.2 }, label: { show: true, position: "top", formatter: "{b}", fontSize: 11, color: pal.ink, distance: 5, textBorderColor: pal.bg, textBorderWidth: 3 }, labelLayout: insideLabels(() => plotW || undefined, { moveOverlap: true }), z: 3 },
      ],
    };
  }, [field, mine, lead, color, tick, log, inverse, pal, plotW]);
  const { ref } = useEChart(option, [option]);
  useEffect(() => { const el = ref.current; if (!el) return; const ro = new ResizeObserver(([e]) => setPlotW(Math.round(e.contentRect.width / 4) * 4)); ro.observe(el); return () => ro.disconnect(); }, [ref]);
  return <div ref={ref} role="img" aria-label={aria} style={{ width: "100%", height }} />;
}
