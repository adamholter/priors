"use client";
import { useMemo, useState, type ReactNode } from "react";
import type { EChartsOption } from "echarts";
import type { Lab, Snapshot } from "@/data/types";
import { markColor, textSize, useChartPalette, useEChart, type ChartPalette } from "./echarts";
import { usageData, usageStack, type UsageRow } from "@/lib/usage-stream";

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const compact = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K` : String(Math.round(n));

/** `color` pulled toward the page by `t` (0 to 1): the next model of the same lab gets a lighter or darker step of its lab's color. */
function step(color: string, pal: ChartPalette, t: number) {
  const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  if (!/^#[0-9a-f]{6}$/i.test(color) || !/^#[0-9a-f]{6}$/i.test(pal.bg)) return color;
  const a = hex(color), b = hex(pal.bg);
  return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

/**
 * Each model's share of T3 Code turns, day by day, as stacked areas (or turns, as volume), beside a table of
 * the window's averages. Data is the Slopalytics usage feed (`t3-usage-share` daily series). The biggest model
 * sits at the bottom and everything beyond the top nine is one "Other" band on top.
 */
export function UsageStream({ snapshot, labs, extra }: { snapshot: Snapshot; labs: Lab[]; extra?: ReactNode }) {
  const pal = useChartPalette();
  const [view, setView] = useState<"share" | "volume">("share");
  const data = useMemo(() => usageData(snapshot), [snapshot]);
  const stack = useMemo(() => (data ? usageStack(data) : null), [data]);
  const colors = useMemo(() => {
    if (!stack) return [];
    const labColor = new Map(labs.map((l) => [l.id, l.color]));
    const seen = new Map<string, number>();
    return stack.series.map((s) => {
      if (s.id === "other") return step(pal.grey, pal, 0.55);
      const k = seen.get(s.labId ?? "") ?? 0; seen.set(s.labId ?? "", k + 1);
      return step(markColor(labColor.get(s.labId ?? ""), pal, s.labId), pal, [0, 0.3, 0.5, 0.65, 0.75][Math.min(k, 4)]);
    });
  }, [stack, labs, pal]);
  const t = textSize(pal);
  const option = useMemo<EChartsOption>(() => {
    if (!data || !stack) return {};
    const dates = data.days.map(dayLabel), share = view === "share";
    return {
      animation: false,
      grid: { left: 44 * t, right: 10, top: 12, bottom: 28 * t },
      xAxis: { type: "category", boundaryGap: false, data: dates, axisLabel: { interval: (i: number) => i === 0 || i === dates.length - 1 || i % 7 === 0, hideOverlap: true } },
      yAxis: { type: "value", min: 0, ...(share ? { max: 100, interval: 25 } : { splitNumber: 4 }), axisLabel: { formatter: (v: number) => (share ? `${v}%` : compact(v)) } },
      tooltip: {
        trigger: "axis", confine: true, axisPointer: { type: "line", lineStyle: { color: pal.grey, type: "dashed" } },
        formatter: (params: unknown) => {
          const list = params as { dataIndex: number }[]; const i = list[0]?.dataIndex ?? 0;
          const rows = stack.series.map((s, n) => `<div style="display:flex;justify-content:space-between;gap:14px"><span><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${colors[n]};margin-right:6px"></i>${escape(s.name)}</span><span style="font-family:var(--font-jetbrains)">${share ? `${s.share[i].toFixed(1)}%` : compact(s.turns[i])}</span></div>`);
          return `<div style="font-weight:600;margin-bottom:4px">${escape(dates[i])}</div>${rows.reverse().join("")}`;
        },
      },
      series: stack.series.map((s, n) => ({
        type: "line", name: s.name, stack: "usage", symbol: "none", smooth: false, data: share ? s.share : s.turns,
        lineStyle: { width: 1, color: pal.bg }, itemStyle: { color: colors[n] }, areaStyle: { color: colors[n], opacity: 1 }, emphasis: { focus: "series" },
      })),
    };
  }, [data, stack, colors, view, pal, t]);
  // Replace rather than merge: Share pins the axis at 100 with an interval, which would otherwise survive the switch to Volume and squash the turns into two blocks.
  const { ref } = useEChart(option, [option], undefined, true);
  if (!data || !stack) return <>{extra}</>;
  const window = data.window?.replace(" to ", " – ");
  return (
    <div className="usage-stream @container">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 max-sm:px-4">
        <p className="cap">daily {view === "share" ? "share of turns" : "turns"}{window ? ` · ${window}` : ""} · via Slopalytics</p>
        <div className="flex items-center gap-2">
          <div className="seg whitespace-nowrap" role="group" aria-label="Usage view">
            <button type="button" aria-pressed={view === "share"} onClick={() => setView("share")}>Share</button>
            <button type="button" aria-pressed={view === "volume"} onClick={() => setView("volume")}>Volume</button>
          </div>
          {extra}
        </div>
      </div>
      <div className="grid gap-5 @4xl:grid-cols-[minmax(0,1fr)_320px] items-start">
        <div ref={ref} role="img" aria-label={`Share of T3 Code turns by model over time. ${stack.rows.slice(0, 3).map((r) => `${r.name} ${r.share.toFixed(0)}%`).join(", ")}.`} className="w-full h-[300px] sm:h-[360px]" />
        <UsageTable rows={stack.rows} colors={colors} />
      </div>
    </div>
  );
}

function UsageTable({ rows, colors }: { rows: UsageRow[]; colors: string[] }) {
  return (
    <div className="max-sm:px-4 text-[12.5px]">
      <div className="grid grid-cols-[18px_minmax(0,1fr)_52px_50px_62px] gap-x-2 cap pb-1.5 border-b hairline"><span /><span>Model</span><span className="text-right">Per day</span><span className="text-right">Share</span><span className="text-right">Change</span></div>
      {rows.map((r, i) => (
        <div key={r.id} className="grid grid-cols-[18px_minmax(0,1fr)_52px_50px_62px] gap-x-2 items-center py-1.5 border-b hairline">
          <span className="cap">{r.id === "other" ? "" : i + 1}</span>
          <span className="flex items-center gap-1.5 min-w-0"><i aria-hidden="true" className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: colors[i] }} /><span className="truncate">{r.name}</span></span>
          <span className="num text-right">{compact(r.perDay)}</span>
          <span className="num text-right">{r.share.toFixed(1)}%</span>
          <span className={`num text-right ${r.change >= 0.05 ? "text-good" : r.change <= -0.05 ? "text-danger" : "text-grey"}`}>{Math.abs(r.change) < 0.05 ? "0.0" : `${r.change > 0 ? "+" : "−"}${Math.abs(r.change).toFixed(1)}`}pp</span>
        </div>
      ))}
      <p className="cap mt-2">Change is the average share of the first three days against the last three.</p>
    </div>
  );
}
