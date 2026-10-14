"use client";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { EChartsOption } from "echarts";
import type { AnswerChart } from "@/lib/answer-chart";
import { useChartPalette, useEChart } from "./chart/echarts";
import { answerHeight, answerOption } from "./chart/answer-option";

/** **bold** inside a line; everything else is plain text. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => /^\*\*[^*]+\*\*$/.test(part) ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>);
}

/**
 * An assistant reply: paragraphs, "- " lists, **bold**, and charts where the reply places
 * `[[chart:N]]`. Nothing else is interpreted, so model output can't inject markup.
 */
export function AssistantAnswer({ text, charts = [] }: { text: string; charts?: AnswerChart[] }) {
  const blocks = text.split(/(\[\[chart:\d+\]\])/).filter(Boolean);
  return <div className="assistant-answer">{blocks.map((block, i) => {
    const chart = block.match(/^\[\[chart:(\d+)\]\]$/);
    if (chart) { const c = charts[Number(chart[1]) - 1]; return c ? <ChartBlock key={i} chart={c} /> : null; }
    return block.split(/\n{2,}/).map((para) => para.trim()).filter(Boolean).map((para, j) => {
      const lines = para.split("\n");
      if (lines.every((l) => /^\s*[-•*]\s+/.test(l))) return <ul key={`${i}-${j}`}>{lines.map((l, k) => <li key={k}>{inline(l.replace(/^\s*[-•*]\s+/, ""))}</li>)}</ul>;
      return <p key={`${i}-${j}`}>{lines.map((l, k) => <Fragment key={k}>{k > 0 && <br />}{inline(l)}</Fragment>)}</p>;
    });
  })}</div>;
}

/** One chart, drawn with the viewer's chart palette so it follows the site theme. */
function ChartBlock({ chart }: { chart: AnswerChart }) {
  const pal = useChartPalette();
  // Scatter labels flip left at the right edge, so the option needs the plot's width.
  const box = useRef<HTMLElement>(null), [w, setW] = useState<number>();
  useEffect(() => { const el = box.current; if (!el) return; const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width))); ro.observe(el); return () => ro.disconnect(); }, []);
  const option = useMemo<EChartsOption>(() => answerOption(chart, pal, () => w), [chart, pal, w]);
  const { ref } = useEChart(option, [option]);
  return <figure ref={box} className="assistant-chart">
    <figcaption>{chart.title}{chart.kind === "grouped" && <span className="assistant-key">{chart.series.map((s, i) => <span key={s}><i style={{ opacity: i === chart.series.length - 1 ? 1 : 0.4 }} />{s}</span>)}</span>}</figcaption>
    <div ref={ref} role="img" aria-label={chart.title} style={{ width: "100%", height: answerHeight(chart) }} />
  </figure>;
}
