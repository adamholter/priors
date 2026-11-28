"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { IconCaretDownFilled, IconCaretUpFilled } from "@tabler/icons-react";
import { LabLogo } from "./LabLogo";
import { markColor, textSize, useChartPalette, useEChart, useLabColor, type ChartPalette } from "./chart/echarts";
import { step } from "./chart/UsageStream";
import type { BoardData, BoardRow, BoardSeries } from "@/lib/priorsbench-board";
import "./priorsbench.css";

const SHOWN = 15;
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const dayLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Line colors: each lab's color, with a second or third model from the same lab stepped lighter so lines stay apart. */
function seriesColors(series: { labId: string; color?: string }[], pal: ChartPalette) {
  const seen = new Map<string, number>();
  return series.map((s) => { const k = seen.get(s.labId) ?? 0; seen.set(s.labId, k + 1); return step(markColor(s.color, pal, s.labId), pal, [0, 0.38, 0.6, 0.72][Math.min(k, 3)]); });
}

function Move({ row }: { row: BoardRow }) {
  if (row.move == null) return <span className="text-[10px] font-mono text-indigo">new</span>;
  if (row.move === 0) return null;
  const up = row.move > 0;
  return <span className={`inline-flex items-center font-mono text-[11px] ${up ? "text-[var(--good)]" : "text-[var(--danger)]"}`} title={`${up ? "Up" : "Down"} ${Math.abs(row.move)} since a week ago`}>{up ? <IconCaretUpFilled size={11} /> : <IconCaretDownFilled size={11} />}{Math.abs(row.move)}</span>;
}

/** The top three, bars to scale from the lowest-rated model on the board (`floor`). */
export function Podium({ rows, floor }: { rows: BoardRow[]; floor: number }) {
  const labColor = useLabColor();
  const [first, second, third] = rows;
  if (!third) return null;
  const top = first.rating;
  const height = (r: BoardRow) => Math.max(24, ((r.rating - floor) / Math.max(1, top - floor)) * 180);
  return (
    <ol className="grid grid-cols-3 items-end gap-3 sm:gap-5 w-full" aria-label="Top three">
      {[second, first, third].map((r) => { const place = rows.indexOf(r) + 1; return (
        <li key={r.id} className={`grid gap-2 min-w-0 ${place === 1 ? "order-2" : place === 2 ? "order-1" : "order-3"}`}>
          <div className="grid gap-1 min-w-0">
            <span className="font-serif text-[28px] sm:text-[34px] leading-none text-ink">{place}</span>
            <Link href={`/models/${r.id}`} className="flex items-start gap-2 min-w-0 text-[14px] sm:text-[15px] text-ink hover:underline min-h-[2.6em] sm:min-h-0"><LabLogo lab={r.labId} name={r.labId} color={r.color} size={18} /><span className="line-clamp-2 leading-snug">{r.name}</span></Link>
            <span className="font-mono text-[18px] sm:text-[22px] tabular-nums text-ink">{fmt(r.rating)}{r.ci && <span className="text-[11px] text-grey ml-1.5">&plusmn;{fmt((r.ci[1] - r.ci[0]) / 2)}</span>}</span>
          </div>
          <div className="rounded-t-[3px] podium-rise" style={{ height: height(r), background: labColor(r.labId, r.color) }} />
        </li>
      ); })}
    </ol>
  );
}

function Board({ data }: { data: BoardData }) {
  const labColor = useLabColor();
  const [key, setKey] = useState("all");
  const [all, setAll] = useState(false);
  const view = data.views.find((v) => v.key === key) ?? data.views[0];
  const max = Math.max(...view.rows.map((r) => r.ci?.[1] ?? r.rating));
  const rows = all ? view.rows : view.rows.slice(0, SHOWN);
  const pct = (v: number) => `${Math.max(0, (v / max) * 100)}%`;
  return (
    <section aria-labelledby="leaderboard" className="grid gap-3 min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <h2 id="leaderboard" className="font-serif text-[26px] leading-tight text-ink">Leaderboard</h2>
        {data.views.length > 1 && <>
          <div className="max-sm:hidden"><div className="seg" role="group" aria-label="Focus">
            {data.views.map((v) => <button key={v.key} type="button" aria-pressed={v.key === view.key} onClick={() => { setKey(v.key); setAll(false); }}>{v.label}</button>)}
          </div></div>
          <select className="sm:hidden h-10 px-3 border hairline rounded-[4px] bg-[var(--white)] text-[14px] text-ink" aria-label="Focus" value={view.key} onChange={(e) => { setKey(e.target.value); setAll(false); }}>
            {data.views.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
          </select>
        </>}
      </div>
      <div className="grid text-[14px]">
        <div className="pb-row cap pb-1.5 border-b hairline"><span className="text-right">#</span><span /><span>Model</span><span className="max-md:hidden" /><span className="text-right">Rating</span><span className="text-right max-sm:hidden">Rank range</span><span className="text-right max-sm:hidden">Rankings</span></div>
        {rows.map((r, i) => { const c = labColor(r.labId, r.color); return (
          <div key={`${view.key}-${r.id}`} className="pb-row items-center h-[34px]">
            <span className="text-right font-mono text-[12px] text-grey tabular-nums">{i + 1}</span>
            <span className="flex justify-center"><Move row={r} /></span>
            <Link href={`/models/${r.id}`} className="flex items-center gap-2 min-w-0 text-ink hover:underline"><LabLogo lab={r.labId} name={r.labId} color={r.color} size={16} /><span className="truncate">{r.name}</span></Link>
            <span className="relative h-[14px] max-md:hidden" aria-hidden="true">
              <span className="absolute inset-y-0 left-0 rounded-[2px]" style={{ width: pct(r.rating), background: c }} />
              {r.ci && <span className="absolute top-1/2 h-[1.5px] -translate-y-1/2 bg-ink opacity-50" style={{ left: pct(r.ci[0]), width: `calc(${pct(r.ci[1])} - ${pct(r.ci[0])})` }} />}
            </span>
            <span className="text-right font-mono tabular-nums text-ink">{fmt(r.rating)}</span>
            <span className="text-right font-mono tabular-nums text-[12px] text-grey max-sm:hidden" title={`95% interval ${r.ci ? `${fmt(r.ci[0])} to ${fmt(r.ci[1])}` : "unknown"}`}>{r.band[0] === r.band[1] ? r.band[0] : `${r.band[0]}-${r.band[1]}`}</span>
            <span className="text-right font-mono tabular-nums text-[12px] text-grey max-sm:hidden">{fmt(r.rankings)}</span>
          </div>
        ); })}
      </div>
      {view.rows.length > SHOWN && <button type="button" className="cap text-left hover:text-ink hit w-fit" onClick={() => setAll(!all)}>{all ? "Show top 15" : `Show all ${view.rows.length} models`}</button>}
    </section>
  );
}

function History({ dates, series }: { dates: string[]; series: BoardSeries[] }) {
  const pal = useChartPalette();
  const colors = useMemo(() => seriesColors(series, pal), [series, pal]);
  const t = textSize(pal);
  /** Day labels a fortnight apart touch on a phone's narrow plot, so they sit a month apart there. */
  const every = typeof window !== "undefined" && window.innerWidth < 480 ? 28 : 14;
  const option = useMemo<EChartsOption>(() => ({
    animation: false,
    grid: { left: 44 * t, right: 112 * t, top: 12, bottom: 26 * t },
    xAxis: { type: "category", boundaryGap: false, data: dates.map(dayLabel), axisLabel: { interval: (i: number) => (dates.length - 1 - i) % every === 0 || (i === 0 && (dates.length - 1) % every >= every / 2), hideOverlap: true } },
    yAxis: { type: "value", scale: true, splitNumber: 4 },
    tooltip: {
      trigger: "axis", confine: true, axisPointer: { type: "line", lineStyle: { color: pal.grey, type: "dashed" } },
      formatter: (params: unknown) => {
        const list = (params as { seriesIndex: number; value: number | null; dataIndex: number }[]).filter((p) => p.value != null).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
        const rows = list.map((p) => `<div style="display:flex;justify-content:space-between;gap:16px"><span><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${colors[p.seriesIndex]};margin-right:6px"></i>${escape(series[p.seriesIndex].name)}</span><b style="font-weight:500">${fmt(p.value!)}</b></div>`);
        return `<div style="margin-bottom:4px">${escape(dayLabel(dates[list[0]?.dataIndex ?? 0]))}</div>${rows.join("")}`;
      },
    },
    series: series.map((s, n) => ({
      type: "line", name: s.name, data: s.values, symbol: "none", connectNulls: false, lineStyle: { width: 2, color: colors[n] }, itemStyle: { color: colors[n] },
      endLabel: { show: true, formatter: "{a}", color: pal.ink, fontSize: 11 * t, distance: 6 }, labelLayout: { moveOverlap: "shiftY" }, emphasis: { focus: "series" },
    })),
  }), [dates, series, colors, pal, t, every]);
  const { ref } = useEChart(option, [option]);
  return <div ref={ref} role="img" aria-label={`Ratings by day for the top ${series.length} models.`} className="w-full h-[340px] sm:h-[420px]" />;
}

function Movers({ rows }: { rows: BoardRow[] }) {
  const moved = rows.filter((r) => r.delta != null && Math.abs(r.delta) >= 1);
  const up = [...moved].sort((a, b) => b.delta! - a.delta!).filter((r) => r.delta! > 0).slice(0, 3);
  const down = [...moved].sort((a, b) => a.delta! - b.delta!).filter((r) => r.delta! < 0).slice(0, 3);
  const fresh = rows.filter((r) => r.delta == null).slice(0, 3);
  const list = (title: string, items: BoardRow[], tone: string) => items.length > 0 && (
    <div className="grid gap-1 content-start min-w-0">
      <h3 className="cap">{title}</h3>
      {items.map((r) => <Link key={r.id} href={`/models/${r.id}`} className="flex items-center gap-2 min-w-0 text-[13.5px] text-ink hover:underline h-[28px]"><LabLogo lab={r.labId} name={r.labId} color={r.color} size={15} /><span className="truncate">{r.name}</span><span className={`ml-auto font-mono text-[12px] tabular-nums ${tone}`}>{r.delta == null ? fmt(r.rating) : `${r.delta > 0 ? "+" : ""}${fmt(r.delta)}`}</span></Link>)}
    </div>
  );
  if (!up.length && !down.length && !fresh.length) return null;
  return <section aria-label="Changes since a week ago" className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 gap-x-6 gap-y-4">{list("Up this week", up, "text-[var(--good)]")}{list("Down this week", down, "text-[var(--danger)]")}{list("New this week", fresh, "text-grey")}</section>;
}

function HeadToHead({ h2h }: { h2h: BoardData["h2h"] }) {
  const [hover, setHover] = useState<[number, number] | null>(null);
  const n = h2h.models.length;
  if (n < 3) return null;
  const share = (i: number, j: number) => { const c = h2h.cells[i][j]; return c.both >= 5 ? c.above / c.both : null; };
  const tip = hover && share(hover[0], hover[1]) != null ? `${h2h.models[hover[0]].name} placed above ${h2h.models[hover[1]].name} in ${Math.round(share(hover[0], hover[1])! * 100)}% of ${fmt(h2h.cells[hover[0]][hover[1]].both)} rankings` : "Share of rankings where the row model is placed above the column model";
  const close = h2h.models.flatMap((a, i) => h2h.models.slice(i + 1).map((b, k) => { const j = i + 1 + k, sh = share(i, j); return sh == null ? null : { a, b, share: sh, n: h2h.cells[i][j].both }; })).filter((x) => x != null).sort((x, y) => Math.abs(x.share - 0.5) - Math.abs(y.share - 0.5) || y.n - x.n).slice(0, 5);
  return (
    <div className="grid gap-x-16 gap-y-10 lg:grid-cols-[auto_minmax(0,1fr)] items-start">
    <section aria-labelledby="h2h" className="grid gap-3 min-w-0">
      <h2 id="h2h" className="font-serif text-[26px] leading-tight text-ink">Head to head</h2>
      <p className="cap min-h-[17px]" aria-live="polite">{tip}</p>
      <div className="h2h" style={{ gridTemplateColumns: `minmax(70px,150px) repeat(${n}, minmax(22px, 46px))` }} onMouseLeave={() => setHover(null)}>
        <span />
        {h2h.models.map((m, j) => <span key={m.id} className={`h2h-col ${hover?.[1] === j ? "text-ink" : ""}`} title={m.name}><LabLogo lab={m.labId} name={m.labId} color={m.color} size={14} /></span>)}
        {h2h.models.map((row, i) => [
          <span key={`${row.id}-name`} className={`truncate text-[12.5px] pr-2 self-center ${hover?.[0] === i ? "text-ink" : "text-ink-2"}`}>{row.name}</span>,
          ...h2h.models.map((col, j) => {
            const s = i === j ? null : share(i, j);
            const tint = s == null ? undefined : s >= 0.5 ? `color-mix(in oklab, var(--indigo) ${Math.round((s - 0.5) * 2 * 85)}%, transparent)` : `color-mix(in oklab, var(--danger) ${Math.round((0.5 - s) * 2 * 85)}%, transparent)`;
            return <span key={`${row.id}-${col.id}`} className={`h2h-cell ${i === j ? "h2h-self" : ""} ${s != null && Math.abs(s - 0.5) > 0.3 ? "h2h-strong" : ""}`} style={{ background: tint }} onMouseEnter={() => setHover([i, j])} aria-label={s == null ? undefined : `${row.name} above ${col.name} ${Math.round(s * 100)}%`}>{s == null ? "" : Math.round(s * 100)}</span>;
          }),
        ])}
      </div>
    </section>
    {close.length > 0 && <section aria-labelledby="close" className="grid gap-3 min-w-0 max-w-[460px] lg:pt-[52px]">
      <h3 id="close" className="cap">Closest calls</h3>
      {close.map(({ a, b, share: sh, n }) => { const lead = sh >= 0.5 ? a : b, other = sh >= 0.5 ? b : a, pc = Math.round(Math.max(sh, 1 - sh) * 100); return (
        <div key={`${a.id}-${b.id}`} className="grid gap-1.5">
          <div className="flex items-start gap-3 text-[13.5px] text-ink min-w-0"><span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0"><LabLogo lab={lead.labId} name={lead.labId} color={lead.color} size={15} /><span>{lead.name}</span><span className="text-grey">over</span><LabLogo lab={other.labId} name={other.labId} color={other.color} size={15} /><span>{other.name}</span></span><span className="ml-auto font-mono text-[12px] tabular-nums text-ink-2 shrink-0">{pc}%</span></div>
          <div className="flex h-[4px] rounded-full overflow-hidden bg-[var(--hair)]" aria-hidden="true"><span className="bg-indigo" style={{ width: `${pc}%` }} /></div>
          <span className="cap">{fmt(n)} rankings</span>
        </div>
      ); })}
    </section>}
    </div>
  );
}

export function PriorsBenchBoard({ data }: { data: BoardData }) {
  const all = data.views[0];
  return (
    <div className="grid gap-14">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
        <Board data={data} />
        <div className="grid gap-8 min-w-0">
          <section aria-labelledby="time" className="grid gap-3 min-w-0">
            <h2 id="time" className="font-serif text-[26px] leading-tight text-ink">Over time</h2>
            <History dates={data.history.dates} series={data.history.series} />
          </section>
          <Movers rows={all.rows} />
        </div>
      </div>
      <HeadToHead h2h={data.h2h} />
    </div>
  );
}
