"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import type { Lab } from "@/data/types";
import type { RankedVariant } from "@/engine";
import type { MetricChart } from "@/lib/metrics";
import { chartLabel } from "@/lib/metrics";
import { formatMetric, type BenchMetric, type BenchSeries, type MetricGroup } from "@/lib/benchmark-metrics";
import { benchmarkPath } from "@/lib/benchmark-slug";
import { markColor, useChartPalette, useEChart } from "../chart/echarts";
import { escapeSvg as esc } from "../chart/export-frame";

/** Look a metric up for a ranked row: exact variant, then the variant without its configuration suffix. */
const valueFor = (m: BenchMetric, r: RankedVariant) => m.values.get(r.variant.id) ?? m.values.get(r.variant.id.split("~")[0]);

/** Score vs one of the benchmark's own measurements, in the shape the gallery charts take. */
export function metricChartOf(m: BenchMetric, benchmarkName: string): MetricChart {
  const all = [...m.values.values()];
  const positive = all.every((v) => v > 0);
  const log = positive && Math.max(...all) / Math.min(...all) >= 20;
  return {
    better: m.better,
    points: (rows) => rows.flatMap((r) => { const x = valueFor(m, r); return x != null && Number.isFinite(x) && (!log || x > 0) ? [{ x, r }] : []; }),
    xLabel: "",
    xName: `${m.label}${log ? " (log)" : ""}`,
    scale: log ? "log" : "linear",
    secs: m.kind === "seconds",
    formatX: (v) => formatMetric(m.kind, v),
    aria: `${benchmarkName} score versus ${m.label.toLowerCase()}`,
  };
}

/** Category splits (buttons, or a menu when there are many) and versions (always a menu, newest first): other boards of this benchmark. */
export function Relatives({ current, family, versions }: { current: string; family: { id: string; label: string }[]; versions: { id: string; label: string }[] }) {
  const router = useRouter();
  const row = (label: string, list: { id: string; label: string }[], select = false) => !list.length ? null : select || list.length > 6
    ? <label className="cap flex items-center gap-2">{label}<select className="inp !w-auto !py-1 !text-[12.5px] normal-case" value={list.some((x) => x.id === current) ? current : list[0].id} onChange={(e) => router.push(benchmarkPath(e.target.value) as "/")}>{list.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
    : <div className="flex flex-wrap items-center gap-2"><span className="cap">{label}</span><div className="seg" role="group" aria-label={label}>{list.map((x) => <Link key={x.id} href={benchmarkPath(x.id) as "/"} aria-current={x.id === current ? "page" : undefined} aria-pressed={x.id === current} className="!text-[12.5px] !px-2.5">{x.label}</Link>)}</div></div>;
  if (!family.length && !versions.length) return null;
  return <div className="flex flex-wrap items-center gap-x-6 gap-y-3">{row("Category", family)}{row("Version", versions, true)}</div>;
}

/** Models down the side, a group's columns across, each cell shaded by where it sits in its column (better is darker). Click a column to sort by it. */
export function BreakdownTable({ groups, ranked }: { groups: MetricGroup[]; ranked: RankedVariant[] }) {
  const [gid, setGid] = useState(groups[0]?.id);
  const [sort, setSort] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const group = groups.find((g) => g.id === gid) ?? groups[0];
  const rows = useMemo(() => {
    if (!group) return [];
    const has = ranked.filter((r) => group.metrics.some((m) => valueFor(m, r) != null));
    const col = group.metrics.find((m) => m.id === sort);
    if (!col) return has;
    const dir = col.better === "lower" ? 1 : -1;
    return [...has].sort((a, b) => { const x = valueFor(col, a), y = valueFor(col, b); return x == null ? 1 : y == null ? -1 : dir * (x - y); });
  }, [group, ranked, sort]);
  const range = useMemo(() => new Map(group?.metrics.map((m) => { const v = rows.flatMap((r) => { const x = valueFor(m, r); return x == null ? [] : [x]; }); return [m.id, [Math.min(...v), Math.max(...v)] as const]; }) ?? []), [group, rows]);
  if (!group) return null;
  const shade = (m: BenchMetric, v: number) => {
    const [lo, hi] = range.get(m.id) ?? [0, 0];
    const t = hi > lo ? (v - lo) / (hi - lo) : 0.5;
    return `color-mix(in oklab, var(--indigo) ${Math.round(6 + 44 * (m.better === "lower" ? 1 - t : t))}%, transparent)`;
  };
  const shown = all ? rows : rows.slice(0, 25);
  return (
    <div className="grid gap-3">
      {groups.length > 1 && <label className="cap flex items-center gap-2">Breakdown<select className="inp !w-auto !py-1 !text-[12.5px] normal-case" value={group.id} onChange={(e) => { setGid(e.target.value); setSort(null); }}>{groups.map((g) => <option key={g.id} value={g.id}>{g.label} · {g.metrics.length}</option>)}</select></label>}
      <div className="overflow-x-auto">
        <table className="text-[12.5px] border-separate border-spacing-0">
          <thead><tr>
            <th className="sticky left-0 bg-bone text-left font-normal cap py-1.5 pr-4 min-w-[170px]">Model</th>
            {group.metrics.map((m) => <th key={m.id} className="font-normal cap py-1.5 px-2 text-right align-bottom max-w-[110px]"><button type="button" className={`text-right leading-tight hover:text-ink ${sort === m.id ? "text-ink" : ""}`} title={`Sort by ${m.label}${m.better === "lower" ? " (lower is better)" : ""}`} onClick={() => setSort(sort === m.id ? null : m.id)}>{m.group ? m.label.split(" · ").pop() : m.label}{sort === m.id ? " ↓" : ""}</button></th>)}
          </tr></thead>
          <tbody>{shown.map((r) => <tr key={r.variant.id} className="border-t hairline">
            <td className="sticky left-0 bg-bone py-1 pr-4 whitespace-nowrap"><Link href={`/models/${r.model.id}` as "/"} className="hover:text-ink">{chartLabel(r)}</Link></td>
            {group.metrics.map((m) => { const v = valueFor(m, r); return <td key={m.id} className="num text-right py-1 px-2" style={v == null ? undefined : { background: shade(m, v) }}>{v == null ? "" : formatMetric(m.kind, v)}</td>; })}
          </tr>)}</tbody>
        </table>
      </div>
      {rows.length > 25 && <button type="button" className="btn-quiet justify-self-start" onClick={() => setAll((v) => !v)}>{all ? "Show fewer" : `Show all ${rows.length}`}</button>}
    </div>
  );
}

/** Each model's published series (money balance by day, turns by day), the leaders labeled at the line end. */
export function SeriesChart({ series, ranked, labs }: { series: BenchSeries; ranked: RankedVariant[]; labs: Lab[] }) {
  const pal = useChartPalette();
  const [all, setAll] = useState(false);
  const rows = useMemo(() => {
    const byId = new Map(series.rows.map((r) => [r.variantId, r]));
    // Ranked order, so the leaders come first and hidden models stay hidden; one line per variant that has a series.
    const out = ranked.flatMap((r) => { const s = byId.get(r.variant.id) ?? byId.get(r.variant.id.split("~")[0]); return s ? [{ r, s }] : []; });
    return out;
  }, [series, ranked]);
  const shown = all ? rows : rows.slice(0, 10);
  const option = useMemo<EChartsOption>(() => {
    const color = (r: RankedVariant) => markColor(labs.find((l) => l.id === r.model.labId)?.color ?? pal.grey, pal, r.model.labId);
    return {
      grid: { left: 56, right: 150, top: 16, bottom: 40 },
      xAxis: { type: "value", name: series.xLabel, nameLocation: "middle", nameGap: 26, min: "dataMin", max: "dataMax" },
      yAxis: { type: "value", name: series.yLabel, nameTextStyle: { align: "left" }, scale: true },
      tooltip: { trigger: "axis", confine: true, order: "valueDesc", valueFormatter: (v) => typeof v === "number" ? (Math.abs(v) >= 100 ? Math.round(v).toLocaleString() : v.toFixed(2)) : String(v) },
      series: shown.map(({ r, s }, i) => ({
        type: "line", name: esc(chartLabel(r)), showSymbol: false, data: s.x.map((x, k) => [x, s.y[k]]),
        lineStyle: { width: i < 3 ? 2 : 1.2, color: color(r), opacity: i < 5 ? 0.95 : 0.6 }, itemStyle: { color: color(r) },
        endLabel: { show: i < 8, formatter: "{a}", color: pal.ink2, fontSize: 11 }, labelLayout: { moveOverlap: "shiftY" }, emphasis: { focus: "series" },
      })),
    };
  }, [shown, series, labs, pal]);
  const { ref } = useEChart(option, [option], undefined, true);
  return (
    <div className="grid gap-2">
      <div ref={ref} role="img" aria-label={`${series.label}, by model`} style={{ width: "100%", height: 420 }} />
      <p className="cap">{all ? `All ${rows.length} runs` : `Top ${shown.length} of ${rows.length} runs by score`}{rows.length > 10 && <> · <button type="button" className="underline decoration-dotted hover:text-ink" onClick={() => setAll((v) => !v)}>{all ? "show top 10" : "show all"}</button></>}</p>
    </div>
  );
}
