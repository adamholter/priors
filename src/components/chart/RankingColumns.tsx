"use client";
import type { EChartsOption } from "echarts";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Lab } from "@/data/types";
import type { RankedVariant } from "@/engine";
import { variantLabel } from "./ParetoChart";
import { markColor, useChartPalette, useEChart } from "./echarts";
import { CONTAIN_AXIS_LABELS, dimColor, markSize, textSize } from "./theme";

let ctx: CanvasRenderingContext2D | null = null;
/** Cut a label with an ellipsis so it is at most `max` px wide in `font`. */
function ellipsize(text: string, max: number, font: string) {
  ctx ??= document.createElement("canvas").getContext("2d");
  if (!ctx) return text;
  ctx.font = font;
  if (ctx.measureText(text).width <= max) return text;
  let n = text.length;
  while (n > 1 && ctx.measureText(text.slice(0, n).trimEnd() + "…").width > max) n--;
  return text.slice(0, n).trimEnd() + "…";
}

/** The Analysis theme leaderboard: one vertical bar per model, best first, score inside the bar (Artificial Analysis style). */
export function RankingColumns({ rows, labs, showEffort, selected, onSelect, getRef }: {
  rows: RankedVariant[]; labs: Lab[]; showEffort: boolean; selected?: string | null; onSelect?: (r: RankedVariant | null) => void;
  getRef?: (svg: () => string | undefined) => void;
}) {
  const pal = useChartPalette(), t = textSize(pal);
  const pick = useRef(onSelect), rowsRef = useRef(rows), selRef = useRef(selected);
  useEffect(() => { pick.current = onSelect; rowsRef.current = rows; selRef.current = selected; });
  // Labels slant down-left from their bar, so the first few have little room before the chart's left edge.
  const box = useRef<HTMLDivElement | null>(null), [w, setW] = useState<number>();
  useEffect(() => { const el = box.current; if (!el) return; const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width))); ro.observe(el); return () => ro.disconnect(); }, []);
  const option = useMemo<EChartsOption>(() => {
    const color = new Map(labs.map((l) => [l.id, markColor(l.color, pal, l.id)]));
    const on = !!selected && rows.some((r) => r.variant.id === selected);
    const left = 40 * t, size = 11 * t, slot = w ? (w - left - 8) / Math.max(1, rows.length) : 0;
    const font = `${size}px ${(pal.fonts?.sans ?? "").replace(/var\([^)]*\),?\s*/g, "") || "Inter, sans-serif"}`;
    const label = (text: string, i: number) => (w ? ellipsize(text, Math.min(150 * t, (left + slot * (i + 0.5) - 6) / Math.SQRT1_2 - size), font) : text);
    return {
      grid: { left, right: 8, top: 24, bottom: 130 * t, ...CONTAIN_AXIS_LABELS },
      xAxis: { type: "category", data: rows.map((r, i) => label(showEffort ? variantLabel(r) : r.model.name, i)), axisLabel: { rotate: 45, interval: 0, fontSize: 11 * t, color: pal.ink2, fontFamily: pal.fonts?.sans ?? "var(--font-inter), Inter, sans-serif", width: 150 * t, overflow: "truncate" }, axisTick: { show: false }, axisLine: { show: false } },
      yAxis: { type: "value", min: 0 },
      tooltip: { trigger: "item", confine: true, formatter: (p: unknown) => { const r = rows[(p as { dataIndex: number }).dataIndex]; return r ? `<div style="font-weight:600">${r.variant.sourceModel?.name ?? variantLabel(r)}</div><div style="font-family:var(--font-jetbrains);margin-top:4px">#${r.rank} · index ${r.score.toFixed(1)}</div>` : ""; } },
      series: [{
        type: "bar", id: "rank", barMaxWidth: 36 * markSize(pal), barCategoryGap: "28%",
        data: rows.map((r) => { const c = color.get(r.model.labId) ?? "#A3A39B", dim = on && r.variant.id !== selected; return { value: r.score, itemStyle: { color: dim ? dimColor(c, pal) : c, opacity: dim ? 0.6 : 1, borderRadius: [pal.style?.barRadius ?? 2, pal.style?.barRadius ?? 2, 0, 0] }, label: dim ? { color: pal.ink, opacity: 0.75, textBorderWidth: 0 } : undefined }; }),
        label: { show: true, position: "insideTop", distance: 6, color: "#FFFFFF", textBorderColor: "rgba(0,0,0,.18)", textBorderWidth: 1.5, fontSize: 10 * t, fontFamily: pal.fonts?.mono ?? "var(--font-jetbrains), monospace", formatter: (p: { value?: unknown }) => Number(p.value).toFixed(1) }, labelLayout: { hideOverlap: true },
        animationDurationUpdate: 350,
      }],
    };
  }, [rows, labs, showEffort, selected, pal, t, w]);
  const { ref, chart } = useEChart(option, [option], (c) => {
    c.on("click", (e) => { const r = rowsRef.current[e.dataIndex]; if (r) pick.current?.(selRef.current === r.variant.id ? null : r); });
  });
  useEffect(() => { getRef?.(() => chart.current?.renderToSVGString()); });
  return <div ref={(el) => { ref.current = el; box.current = el; }} role="img" aria-label={`Rankings, ${rows.length} models by index score`} style={{ width: "100%", height: Math.round(460 * (pal.size?.height ?? 1)), overflow: "hidden", position: "relative", isolation: "isolate" }} />;
}
