"use client";
import { SiteFooter } from "@/components/SiteFooter";
import Link from "next/link";
import { HeaderAccount } from "@/components/AccountMenu";
import { SettingsButton } from "../SiteSettings";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { EChartsOption } from "echarts";
import type { Benchmark, Snapshot } from "@/data/types";
import { benchRows, type BenchRow as Row, type ModelView, type ViewBenchmark, type ViewField } from "@/lib/model-view";
import { rankParam, type RankingOption } from "@/lib/model-ranking-param";
import { Wordmark } from "../Wordmark";
import { SiteNav } from "../SiteNav";
import { CONTAIN_AXIS_LABELS, insideLabels, markColor, useChartPalette, useEChart } from "../chart/echarts";
import { BenchmarkInfo, InfoIcon } from "../BenchmarkInfo";
import { ModelStrengths } from "./ModelStrengths";
import { FieldStrip, type StripPoint } from "./FieldStrip";
import { ModelCostSpeed } from "./ModelCostSpeed";
import { escapeSvg as esc } from "../chart/export-frame";
import { useNearView } from "../use-near-view";

type Bench = Pick<Benchmark, "unit" | "higherIsBetter" | "name" | "effortBasis">;

function fmt(b: Pick<Bench, "unit">, v: number) {
  if (b.unit === "percent") return `${v.toFixed(1)}%`;
  if (b.unit === "usd") return `$${v >= 100 ? Math.round(v).toLocaleString() : v.toFixed(2)}`;
  if (b.unit === "seconds") return `${v.toFixed(v >= 10 ? 0 : 1)}s`;
  return v.toFixed(b.unit === "elo" ? 0 : 1);
}

interface Props {
  view: ModelView; summary?: string;
  /** Where a server-drawn page gets the rest of its benchmarks. */
  othersUrl: string;
  options: RankingOption[]; current: string; onPick: (param: string) => void;
  /** The chosen ranking is still downloading, or could not. */
  pending: boolean; error: string; retry: () => void;
  /** `null` while on-demand benchmark details are loading. */
  infoSnapshot: Snapshot | null; info: string | null; onInfo: (id: string | null) => void;
  probe: ReactNode;
}

export function ModelPage({ view, summary, othersUrl, options, current, onPick, pending, error, retry, infoSnapshot, info, onInfo, probe }: Props) {
  const { model, lab, mine, field, others, strengths, cost, loose, place, models, total, measured, weighted } = view;
  const pal = useChartPalette();
  const labC = markColor(lab?.color ?? "#2F4FB0", pal, lab?.id);
  const color = useMemo(() => ({ lab: labC, name: (id: string) => field.names[id] ?? id }), [labC, field.names]);
  const inMix = field.benchmarks;
  const [showAll, setShowAll] = useState(false);
  const top = mine[0];
  const modelId = model.id;

  return (
    <main className="min-h-screen">
      {probe}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-8 py-2 sm:h-14 border-b hairline"><div className="flex items-center gap-5"><Wordmark /><Link href={view.builderHref as "/builder"} prefetch={false} className="max-sm:hidden text-grey text-[13px] hover:text-ink">Builder</Link></div><span className="ml-auto flex items-center gap-2"><HeaderAccount /><SettingsButton /></span><span className="sm:hidden w-full"><SiteNav /></span></header>
      <div className="max-w-[1100px] mx-auto px-5 sm:px-8 py-10 grid gap-12">
        <section className="grid gap-5 sm:grid-cols-[1fr_auto] items-end">
          <div>
            <p className="cap flex items-center gap-2"><i className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: labC }} />{lab?.name}{model.releaseDate && ` · released ${model.releaseDate}`}</p>
            <h1 className="text-[44px] leading-[1.05] mt-2">{model.name}</h1>
            {summary && <p className="text-[13.5px] text-ink-2 mt-2 max-w-[70ch]">{summary}</p>}
            <p className="text-[13.5px] text-ink-2 mt-2">Measured on {measured} benchmarks{mine.length > 1 ? ` across ${mine.length} reasoning efforts` : ""}.</p>
          </div>
          <div className="sm:text-right">
            <label className="cap inline-flex items-center gap-2">Ranked in
              <select className="inp !w-auto !py-1 !text-[12px] max-w-[220px] normal-case" value={current} aria-busy={pending} onChange={(e) => onPick(e.target.value)} aria-label="Ranking to place this model in">
                {[...new Set(options.map((o) => o.group))].map((g) => <optgroup key={g} label={g}>{options.filter((o) => o.group === g).map((o) => <option key={o.key} value={rankParam(o)}>{o.label}</option>)}</optgroup>)}
              </select>
            </label>
            {pending && <p role="status" className="cap mt-1">Loading this ranking…</p>}
            {error && <p role="status" className="cap mt-1">{error} <button type="button" className="underline" onClick={retry}>Retry</button></p>}
            {top ? <><p className="num text-[52px] leading-none mt-1" style={{ color: "var(--indigo)" }}>{top.score.toFixed(1)}</p><p className="text-[13px] text-ink-2 mt-1">#{place + 1} of {models} models{top.effort !== "default" ? ` · best at ${top.effort}` : ""}</p>{loose && <p className="cap mt-1 max-w-[30ch] sm:ml-auto">includes estimates: {Math.round(top.measuredShare * 100)}% of the mix is measured for this model</p>}</>
              : <p className="text-[13px] text-ink-2 mt-2 max-w-[28ch]">Not ranked in this one: too little measured data for its benchmarks. Pick another ranking above.</p>}
          </div>
        </section>

        {mine.length > 1 && <section className="border-t-2 border-ink pt-3">
          <h2 className="text-[20px] mb-2">Reasoning efforts in this ranking</h2>
          <div className="grid gap-[5px]">{mine.map((r) => <EffortRow key={r.id} r={r} rank={r.rank} total={total} max={mine[0].score} color={labC} />)}</div>
        </section>}

        {strengths && <ModelStrengths data={strengths} labColors={view.labColors} onInfo={onInfo} />}

        {mine.length > 0 && <ModelCostSpeed data={cost} modelId={modelId} name={model.name} color={labC} />}

        <section className="grid gap-4">
          <div className="flex items-baseline justify-between border-b hairline pb-2"><h2 className="text-[26px]">This ranking&rsquo;s benchmarks</h2><span className="cap">{inMix.length} of {weighted} measured</span></div>
          {inMix.length ? <div className="grid gap-8 lg:grid-cols-2">{inMix.map((b) => <BenchCard key={b.id} b={b} view={field} modelId={modelId} color={color} onInfo={() => onInfo(b.id)} />)}</div>
            : <p className="cap">This model has no results on this ranking&rsquo;s benchmarks.</p>}
        </section>

        {others > 0 && <details className="group border-t hairline pt-4" onToggle={(e) => setShowAll(e.currentTarget.open)}>
          <summary className="disclosure items-baseline"><h2 className="text-[22px]">All {measured} benchmarks</h2><span className="cap ml-auto group-open:hidden">show {others} more</span><span className="cap ml-auto hidden group-open:inline">hide</span></summary>
          {showAll && <LazyCards data={view.otherField} url={othersUrl} modelId={modelId} lab={labC} onInfo={onInfo} />}
        </details>}
      </div>
      <BenchmarkInfo snapshot={infoSnapshot} benchmarkId={info} onClose={() => onInfo(null)} />
      <SiteFooter />
    </main>
  );
}

function EffortRow({ r, rank, total, max, color }: { r: ModelView["mine"][number]; rank: number; total: number; max: number; color?: string }) {
  return <div className="grid grid-cols-[64px_minmax(0,1fr)_56px_90px] items-center gap-3 h-[26px] text-[12.5px]">
    <span className="mono">{r.effort}</span>
    <span className="h-[9px] bg-hair-2 rounded-[2px] overflow-hidden"><i className="block h-full rounded-[2px]" style={{ width: `${Math.max(3, r.score / Math.max(1, max) * 100)}%`, background: color }} /></span>
    <span className="num text-right">{r.score.toFixed(1)}</span>
    <span className="cap text-right">#{rank} of {total}</span>
  </div>;
}

/** A chart that only exists while it is near the screen; the same height either way, so nothing jumps. */
function NearView({ height, children }: { height: number; children: ReactNode }) {
  const [ref, near] = useNearView<HTMLDivElement>();
  return <div ref={ref} style={{ minHeight: height }}>{near && children}</div>;
}

/** The rest of the model's benchmarks, rendered only once the section is opened. A page drawn on the server fetches them then. */
function LazyCards({ data, url, modelId, lab, onInfo }: { data?: ViewField; url: string; modelId: string; lab: string; onInfo: (id: string) => void }) {
  const [loaded, setLoaded] = useState<{ url: string; field: ViewField } | null>(null);
  const [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (data) return;
    let live = true;
    fetch(url).then((r) => { if (!r.ok) throw new Error(); return r.json() as Promise<ViewField>; }).then((field) => { if (live) { setFailed(false); setLoaded({ url, field }); } }, () => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [data, url, attempt]);
  const field = data ?? (loaded?.url === url ? loaded.field : undefined);
  const color = useMemo(() => ({ lab, name: (id: string) => field?.names[id] ?? id }), [lab, field]);
  if (!field) return <p role="status" className="cap mt-5">{failed ? <>Could not load these benchmarks. <button type="button" className="underline" onClick={() => { setFailed(false); setAttempt((n) => n + 1); }}>Retry</button></> : "Loading benchmarks…"}</p>;
  return <div className="grid gap-8 lg:grid-cols-2 mt-5">{field.benchmarks.map((b) => <BenchCard key={b.id} b={b} view={field} modelId={modelId} color={color} onInfo={() => onInfo(b.id)} />)}</div>;
}

/** One benchmark: this model's efforts highlighted on score-vs-cost (others ghosted), or on the field's spread when cost is unknown, plus placements. */
function BenchCard({ b, view, modelId, color, onInfo }: { b: ViewBenchmark; view: Pick<ViewField, "variants">; modelId: string; color: { lab: string; name: (id: string) => string }; onInfo: () => void }) {
  const rows = useMemo(() => benchRows(view, b), [view, b]);
  const mine = rows.filter((r) => r.modelId === modelId);
  const withCost = rows.filter((r) => r.cost && r.cost > 0);
  return (
    <article className="grid gap-3 content-start">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="cap">{b.category}</p><h3 className="text-[19px] leading-tight flex items-center gap-1.5">{b.name}<InfoIcon name={b.name} onClick={onInfo} /></h3></div><span className="cap shrink-0 pt-4">{rows.length} results</span></div>
      {withCost.length >= 3 && mine.some((r) => r.cost) ? <NearView height={230}><BenchScatter b={b} rows={withCost} modelId={modelId} color={color} /></NearView>
        : rows.length >= 3 && <NearView height={150}><BenchStrip b={b} rows={rows} modelId={modelId} color={color} /></NearView>}
      <ol className="grid gap-[4px]">
        {mine.map((r) => <li key={r.variantId} className="grid grid-cols-[52px_minmax(0,1fr)_70px] items-center gap-3 text-[12.5px] h-[24px]">
          <span className="num text-[15px]" style={{ color: "var(--indigo)" }}>#{r.rank}</span>
          <span className="truncate">{b.effortBasis ? "best measured setting" : r.effort === "default" ? "default" : r.effort} <span className="cap">of {rows.length}</span></span>
          <span className="num text-right">{fmt(b, r.value)}</span>
        </li>)}
      </ol>
      <p className="cap">Leader: {rows[0]?.modelId === modelId ? "this model" : color.name(rows[0]?.modelId ?? "")} · {rows[0] ? fmt(b, rows[0].value) : ""}</p>
    </article>
  );
}

function BenchScatter({ b, rows, modelId, color }: { b: Bench; rows: Row[]; modelId: string; color: { lab: string; name: (id: string) => string } }) {
  const pal = useChartPalette();
  const [plotW, setPlotW] = useState(0);
  const option = useMemo<EChartsOption>(() => {
    const mine = rows.filter((r) => r.modelId === modelId).sort((a, c) => a.cost! - c.cost!), rest = rows.filter((r) => r.modelId !== modelId);
    const labColor = color.lab;
    return {
      grid: { left: 44, right: 70, top: 14, bottom: 34, ...CONTAIN_AXIS_LABELS },
      xAxis: { type: "log", name: "$ / task", nameLocation: "end", nameGap: 6, nameTextStyle: { color: pal.grey, fontSize: 10, align: "right", verticalAlign: "top", padding: [22, 0, 0, 0] }, axisLabel: { formatter: (v: number) => `$${v >= 1 ? Math.round(v) : v.toFixed(2)}`, hideOverlap: true, showMinLabel: false, showMaxLabel: false }, min: (e: { min: number }) => e.min / 1.5, max: (e: { max: number }) => e.max * 1.5 },
      yAxis: { type: "value", scale: true, axisLabel: { formatter: (v: number) => b.unit === "percent" ? `${v}%` : `${v}` } },
      tooltip: { trigger: "item", confine: true, formatter: (p: unknown) => { const d = (p as { data?: { r?: Row } }).data?.r; return d ? `<b>${esc(color.name(d.modelId))} ${esc(d.effort)}</b><br/><span style="font-family:var(--font-jetbrains)">${fmt(b, d.value)} · $${d.cost!.toFixed(2)}/task · #${d.rank}</span>` : ""; } },
      series: [
        { type: "scatter", id: "ghost", symbolSize: 7, data: rest.map((r) => ({ value: [r.cost, r.value], r })), itemStyle: { color: pal.dark ? "#8C8B83" : "#A3A39B", opacity: pal.dark ? 0.32 : 0.28 }, emphasis: { itemStyle: { opacity: 0.9 } }, z: 1 },
        { type: "line", id: "mine-line", data: mine.map((r) => [r.cost, r.value]), showSymbol: false, lineStyle: { color: labColor, width: 1.2, opacity: 0.6 }, silent: true, z: 2 },
        { type: "scatter", id: "mine", symbolSize: 11, data: mine.map((r) => ({ value: [r.cost, r.value], r, name: r.effort })), itemStyle: { color: labColor, borderColor: pal.ink, borderWidth: 1.2 }, label: { show: true, position: "right", formatter: "{b}", fontSize: 11, color: pal.ink, distance: 6, textBorderColor: pal.bg, textBorderWidth: 3 }, labelLayout: insideLabels(() => plotW || undefined), z: 3 },
      ],
    };
  }, [b, rows, modelId, color, pal, plotW]);
  const { ref } = useEChart(option, [option]);
  useEffect(() => { const el = ref.current; if (!el) return; const ro = new ResizeObserver(([e]) => setPlotW(Math.round(e.contentRect.width / 4) * 4)); ro.observe(el); return () => ro.disconnect(); }, [ref]);
  return <div ref={ref} role="img" aria-label={`${b.name} score versus cost per task`} style={{ width: "100%", height: 230 }} />;
}

/** Every result on the benchmark spread along its score (best to the right); this model, the leader and the median marked. */
function BenchStrip({ b, rows, modelId, color }: { b: Bench; rows: Row[]; modelId: string; color: { lab: string; name: (id: string) => string } }) {
  const { field, mine, lead } = useMemo(() => {
    const setting = (r: Row) => b.effortBasis ? "best measured setting" : r.effort;
    const point = (r: Row): StripPoint => ({ key: r.variantId, value: r.value, label: b.effortBasis || r.effort === "default" ? "" : r.effort, tip: `<b>${esc(color.name(r.modelId))} ${esc(setting(r))}</b><br/><span style="font-family:var(--font-jetbrains)">${fmt(b, r.value)} · #${r.rank} of ${rows.length}</span>` });
    const top = rows[0];
    return { field: rows.filter((r) => r.modelId !== modelId).map(point), mine: rows.filter((r) => r.modelId === modelId).map(point), lead: top && top.modelId !== modelId ? { ...point(top), label: color.name(top.modelId) } : undefined };
  }, [b, rows, modelId, color]);
  const format = useCallback((v: number) => fmt(b, v).replace(/\.0(?=%|$)/, ""), [b]);
  return <FieldStrip field={field} mine={mine} lead={lead} color={color.lab} fmt={format} inverse={b.higherIsBetter === false} aria={`${b.name}: where this model sits among ${rows.length} results`} />;
}
