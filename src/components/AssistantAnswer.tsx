"use client";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { EChartsOption } from "echarts";
import type { AnswerChart } from "@/lib/answer-chart";
import { markColor, useChartPalette, useEChart } from "./chart/echarts";
import { answerHeight, answerMarkAt, answerOption, answerRows } from "./chart/answer-option";
import { chartLink } from "@/lib/answer-chart";
import { ChartExpandIcon } from "./chart/ChartIcons";
import { ChartExport } from "./chart/ChartExport";
import { HighlightContext, HighlightMenu, toggleModel, type HighlightState } from "./chart/highlight";

/** The active index's highlights, which answer charts show and their expanded view edits. */
export type AnswerHighlight = { items: string[]; set: (items: string[]) => void };

/** **bold** inside a line; everything else is plain text. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => /^\*\*[^*]+\*\*$/.test(part) ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>);
}

/**
 * An assistant reply: paragraphs, "- " lists, **bold**, and charts where the reply places
 * `[[chart:N]]`. Nothing else is interpreted, so model output can't inject markup.
 */
export function AssistantAnswer({ text, charts = [], highlight }: { text: string; charts?: AnswerChart[]; highlight?: AnswerHighlight }) {
  const blocks = text.split(/(\[\[chart:\d+\]\])/).filter(Boolean);
  return <div className="assistant-answer">{blocks.map((block, i) => {
    const chart = block.match(/^\[\[chart:(\d+)\]\]$/);
    if (chart) { const c = charts[Number(chart[1]) - 1]; return c ? <ChartBlock key={i} chart={c} highlight={highlight} /> : null; }
    return block.split(/\n{2,}/).map((para) => para.trim()).filter(Boolean).map((para, j) => {
      const lines = para.split("\n");
      if (lines.every((l) => /^\s*[-•*]\s+/.test(l))) return <ul key={`${i}-${j}`}>{lines.map((l, k) => <li key={k}>{inline(l.replace(/^\s*[-•*]\s+/, ""))}</li>)}</ul>;
      return <p key={`${i}-${j}`}>{lines.map((l, k) => <Fragment key={k}>{k > 0 && <br />}{inline(l)}</Fragment>)}</p>;
    });
  })}</div>;
}

/** Copies a link that opens this chart on the index it was asked under. Nothing when the chart carries no recipe (older chats). */
function ChartLinkButton({ chart, className = "assistant-icon" }: { chart: AnswerChart; className?: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? undefined : chartLink(window.location.origin, chart);
  if (!url) return null;
  const copy = () => { void navigator.clipboard?.writeText(url).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1600); }).catch(() => window.prompt("Copy this link", url)); };
  return <button type="button" className={className} onClick={copy} aria-label={`Copy a link to ${chart.title}`} title={copied ? "Link copied" : "Copy link to this chart"}>
    {copied
      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>}
  </button>;
}

const Key = ({ chart }: { chart: AnswerChart }) => chart.kind === "grouped" ? <span className="assistant-key">{chart.series.map((s, i) => <span key={s}><i style={{ opacity: i === chart.series.length - 1 ? 1 : 0.4 }} />{s}</span>)}</span> : null;

/** One chart, drawn with the viewer's chart palette so it follows the site theme. Expands to fill the screen. */
function ChartBlock({ chart, highlight }: { chart: AnswerChart; highlight?: AnswerHighlight }) {
  const pal = useChartPalette(), hl = highlight?.items;
  // Scatter labels flip left at the right edge, so the option needs the plot's width.
  const box = useRef<HTMLElement>(null), [w, setW] = useState<number>();
  useEffect(() => { const el = box.current; if (!el) return; const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width))); ro.observe(el); return () => ro.disconnect(); }, []);
  const option = useMemo<EChartsOption>(() => answerOption(chart, pal, () => w, hl), [chart, pal, w, hl]);
  const { ref } = useEChart(option, [option]);
  const [expanded, setExpanded] = useState(false), trigger = useRef<HTMLButtonElement>(null);
  const collapse = useCallback(() => { setExpanded(false); requestAnimationFrame(() => trigger.current?.focus()); }, []);
  return <figure ref={box} className="assistant-chart">
    <figcaption><span className="mr-auto">{chart.title}</span><Key chart={chart} />
      <ChartLinkButton chart={chart} className="assistant-icon assistant-chart-expand" />
      <button ref={trigger} type="button" className="assistant-icon assistant-chart-expand" onClick={() => setExpanded(true)} aria-label={`Expand ${chart.title}`} title="Expand"><ChartExpandIcon /></button>
    </figcaption>
    <div ref={ref} role="img" aria-label={chart.title} style={{ width: "100%", height: answerHeight(chart) }} />
    {expanded && createPortal(<ExpandedChart chart={chart} highlight={highlight} onClose={collapse} />, document.body)}
  </figure>;
}

/**
 * An answer chart over the page, like the page's own expanded charts: highlight models (the star menu
 * or clicking a mark, saved on the index) and export it. Escape or the backdrop closes it.
 */
export function ExpandedChart({ chart, highlight, onClose }: { chart: AnswerChart; highlight?: AnswerHighlight; onClose: () => void }) {
  const pal = useChartPalette(), hl = highlight?.items;
  const box = useRef<HTMLDivElement>(null), close = useRef<HTMLButtonElement>(null), [w, setW] = useState<number>();
  useEffect(() => { const el = box.current; if (!el) return; const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width))); ro.observe(el); return () => ro.disconnect(); }, []);
  const option = useMemo<EChartsOption>(() => answerOption(chart, pal, () => w, hl, 1.6), [chart, pal, w, hl]);
  const latest = useRef(highlight);
  useEffect(() => { latest.current = highlight; });
  const { ref, chart: instance } = useEChart(option, [option], (c) => c.on("click", (p) => {
    const m = answerMarkAt(chart, p as { dataIndex: number; seriesIndex?: number }), h = latest.current;
    if (m && h) h.set(toggleModel(h.items, m.modelId));
  }));
  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector('details[name="chart-settings"][open]')) onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Capture, so an open highlight menu is still open here and its Escape closes only the menu.
    window.addEventListener("keydown", onKey, true);
    return () => { window.removeEventListener("keydown", onKey, true); document.body.style.overflow = prev; };
  }, [onClose]);
  const state = useMemo<HighlightState | null>(() => {
    if (!highlight) return null;
    const marks = chart.kind === "bar" ? chart.items : chart.kind === "grouped" ? chart.groups : chart.kind === "lines" ? chart.lines : chart.points;
    const models = [...new Map(marks.map((m) => [m.modelId, { id: m.modelId, name: m.label, color: markColor(m.color, pal, m.labId) }])).values()];
    return { ...highlight, models };
  }, [chart, highlight, pal]);
  return <>
    <div className="chart-expand-backdrop" aria-hidden="true" onClick={onClose} />
    <div className="chart-expanded" role="dialog" aria-modal="true" aria-label={chart.title}>
      <div className="flex flex-wrap items-center gap-1 mb-2"><h2 className="text-[22px] min-w-0 mr-auto">{chart.title}</h2><Key chart={chart} />
        <HighlightContext.Provider value={state}><HighlightMenu label={chart.title} /></HighlightContext.Provider>
        <ChartLinkButton chart={chart} className="p-1.5 text-grey hover:text-ink rounded-sm focus-visible:outline-indigo" />
        <ChartExport name={chart.title} frame getSvg={() => instance.current?.renderToSVGString()} getRows={() => answerRows(chart)} />
        <button ref={close} type="button" className="p-1.5 text-grey hover:text-ink rounded-sm focus-visible:outline-indigo" aria-label={`Close expanded ${chart.title}`} title="Close (Esc)" onClick={onClose}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
      </div>
      <div ref={box} className="flex-1 min-h-0"><div ref={ref} role="img" aria-label={chart.title} style={{ width: "100%", height: "100%" }} /></div>
    </div>
  </>;
}
