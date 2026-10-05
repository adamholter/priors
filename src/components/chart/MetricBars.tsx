"use client";
import { ChartExport, type ChartExportHandle } from "./ChartExport";
import type { EChartsOption } from "echarts";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Lab } from "@/data/types";
import { DARK_PALETTE, LIGHT_PALETTE, markColor, useChartPalette, useEChart } from "./echarts";
import { HighlightList, HighlightMenu, togglePoint, useHighlight } from "./highlight";
import { chartLabel, type ScatterPoint } from "./ScoreScatter";
import { barsOption, compact, selectBars } from "./bars-option";
import { barsHtml, unitOf } from "./embed";
import { ChartLink, type ChartLinkParams } from "./ChartLink";
import { useChartExpand } from "./ChartExpand";
import { dimColor } from "./theme";
import { featuredPoints, highlightedModels } from "./scatter-option";
import { ChartContextMenu, useChartContextMenu, useChartVisibility } from "./ChartContextMenu";

const value = (p: ScatterPoint) => p.raw ?? p.x;

/**
 * Vertical bars of one metric (Artificial Analysis style), best first. The caller's effort mode
 * applies: best mode shows one bar per model, all mode shows every effort. Capped at `limit`
 * points by index score so the axis stays readable.
 */
export function MetricBars({ pts: allPoints, labs, better, xName, formatValue, height = 400, aria, title, actions, limit = 24, exportName, anchor, linkParams }: {
  pts: ScatterPoint[]; labs: Lab[]; better: "lower" | "higher"; xName: string; formatValue: (x: number) => string;
  height?: number; aria: string; title?: ReactNode; actions?: ReactNode; limit?: number; exportName: string; anchor?: string; linkParams?: ChartLinkParams;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const visibility = useChartVisibility(allPoints), pts = visibility.points;
  const context = useChartContextMenu();
  const exportControl = useRef<ChartExportHandle>(null);
  const contextPick = useRef(context.pointMenu);
  useEffect(() => { contextPick.current = context.pointMenu; });
  const [narrow, setNarrow] = useState(false);
  useEffect(() => { const el = wrap.current; if (!el) return; const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 560)); ro.observe(el); return () => ro.disconnect(); }, []);
  const expand = useChartExpand(exportName);
  const cap = expand.expanded ? (narrow ? 20 : Math.max(limit, 40)) : narrow ? Math.min(12, limit) : limit;
  const pal = useChartPalette();
  const hl = useHighlight();
  const highlight = hl?.items;
  const bars = useMemo(() => selectBars(pts, better, cap, highlight), [pts, better, cap, highlight]);
  const option = useMemo<EChartsOption>(() => barsOption({ bars, labs, xName, formatValue, pal, narrow, highlight }), [bars, labs, xName, formatValue, narrow, pal, highlight]);
  const pick = useRef<(p: ScatterPoint) => void>(() => {});
  useEffect(() => { pick.current = (p) => { if (hl) hl.set(togglePoint(hl.items, pts, p)); }; }, [hl, pts]);
  const { ref, chart } = useEChart(option, [option], (c) => {
    c.on("click", (e) => { const d = (e.data as { extra?: ScatterPoint } | undefined)?.extra; if (d) pick.current(d); });
    c.on("contextmenu", (e) => {
      const d = (e.data as { extra?: ScatterPoint } | undefined)?.extra;
      const event = e.event?.event as MouseEvent | undefined;
      if (d && event) { event.preventDefault(); event.stopPropagation(); contextPick.current(d, event.clientX, event.clientY); }
    });
  });
  const getHtml = () => {
    const highlightItems = highlight ?? [], focusedModels = highlightedModels(highlightItems);
    const featured = new Set(featuredPoints(bars, highlightItems).map((p) => p.r.variant.id));
    return barsHtml({
      title: exportName, yName: xName, unit: unitOf(formatValue), highlight: highlightItems,
      bars: bars.map((p) => {
        const lab = labs.find((l) => l.id === p.r.model.labId), c = markColor(lab?.color, LIGHT_PALETTE, p.r.model.labId), d = markColor(lab?.color, DARK_PALETTE, p.r.model.labId);
        return {
          n: chartLabel(p.r), v: value(p), c, d, dc: dimColor(c, LIGHT_PALETTE), dd: dimColor(d, DARK_PALETTE),
          m: p.r.model.id, id: p.r.variant.id, e: p.r.variant.effort,
          h: focusedModels.has(p.r.model.id), a: featured.has(p.r.variant.id),
          t: `<b>${chartLabel(p.r)}</b><div style="font-family:'JetBrains Mono',monospace;margin-top:4px">${compact(formatValue)(value(p))} · index ${p.r.score.toFixed(1)}</div>`,
        };
      }),
    });
  };
  return (
    <>{expand.backdrop}<div ref={wrap} id={anchor} className={`max-sm:-mx-4 scroll-mt-20 ${expand.expanded ? "chart-expanded" : ""}`} role={expand.expanded ? "dialog" : undefined} aria-modal={expand.expanded || undefined} aria-label={expand.expanded ? exportName : undefined}>
      <div className={`chart-toolbar flex flex-wrap items-center justify-end gap-1 max-sm:px-4 min-h-8 ${title || expand.expanded ? "mb-1" : "-mb-8 relative z-10 pointer-events-none"}`}>{(title || expand.expanded) ? <div className="min-w-0 mr-auto">{title ?? <h2 className="text-[22px]">{exportName}</h2>}<HighlightList /></div> : <div className="min-w-0 mr-auto"><HighlightList /></div>}<div className="flex items-center gap-1 pointer-events-auto"><HighlightMenu label={exportName} />{visibility.canUndo && <button type="button" className="cap hover:text-ink" onClick={visibility.undo} aria-label="Undo chart removal">Undo</button>}{actions}{anchor && <ChartLink id={anchor} name={exportName} params={linkParams} />}<ChartExport ref={exportControl} name={exportName} frame getHtml={getHtml} getSvg={() => chart.current?.renderToSVGString()} getRows={() => bars.map((p, i) => ({ rank: i + 1, model: p.r.model.name, effort: p.r.variant.effort, [xName]: +value(p).toFixed(4), index_score: +p.r.score.toFixed(2) }))} />{expand.button}</div></div>
      <div className={expand.expanded ? "flex-1 min-h-0" : undefined}><div ref={ref} role="img" aria-label={aria} tabIndex={0} onContextMenu={context.onContextMenu} onKeyDown={context.onKeyDown} style={{ width: "100%", height: expand.expanded ? "100%" : height, overflow: "hidden", position: "relative", isolation: "isolate" }} /></div>
      <ChartContextMenu exportControl={exportControl} state={context.menu} close={context.close} name={exportName} points={bars} visibility={visibility} chart={chart} wrap={wrap} expanded={expand.expanded} anchor={anchor} />
    </div></>
  );
}
