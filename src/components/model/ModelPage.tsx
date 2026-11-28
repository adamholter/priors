"use client";
import { categoryName } from "@/data/categories";
import { SiteFooter } from "@/components/SiteFooter";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { EChartsOption } from "echarts";
import type { Benchmark, Snapshot } from "@/data/types";
import { benchRows, type BenchRow as Row, type ModelView, type ViewBenchmark, type ViewField } from "@/lib/model-view";
import type { ModelAvailability } from "@/lib/model-availability";
import type { RankingOption } from "@/lib/model-ranking-param";
import type { RankSummary } from "@/lib/model-rank-text";
import type { OwnRanking } from "@/lib/model-ranks";
import { CONTAIN_AXIS_LABELS, insideLabels, markColor, useChartPalette, useEChart } from "../chart/echarts";
import { BenchmarkInfo, InfoIcon } from "../BenchmarkInfo";
import { ModelHeader } from "./ModelHeader";
import { ModelStrengths } from "./ModelStrengths";
import { ModelDomains } from "./ModelDomains";
import { FieldStrip, type StripPoint } from "./FieldStrip";
import { ModelCostSpeed } from "./ModelCostSpeed";
import { ModelAvailabilitySection } from "./ModelAvailability";
import { escapeSvg as esc } from "../chart/export-frame";
import { useNearView } from "../use-near-view";
import { SiteHeader } from "@/components/SiteHeader";
import { buildEfforts } from "@/lib/model-efforts";
import { BestEffortContext, EffortRows, ModelEfforts } from "./ModelEfforts";

type Bench = Pick<Benchmark, "unit" | "higherIsBetter" | "name" | "effortBasis">;

function fmt(b: Pick<Bench, "unit">, v: number) {
  if (b.unit === "percent") return `${v.toFixed(1)}%`;
  if (b.unit === "usd") return `$${v >= 100 ? Math.round(v).toLocaleString() : v.toFixed(2)}`;
  if (b.unit === "seconds") return `${v.toFixed(v >= 10 ? 0 : 1)}s`;
  return v.toFixed(b.unit === "elo" ? 0 : 1);
}

interface Props {
  view: ModelView; summary?: string; availability?: ModelAvailability;
  /** Where a server-drawn page gets the rest of its benchmarks. */
  othersUrl: string;
  options: RankingOption[]; current: string; onPick: (param: string) => void;
  /** Where the model stands in each ranking the picker lists, and the ranking made from its own benchmarks when no standard ranking places it. */
  ranks: Record<string, RankSummary | undefined>; own?: OwnRanking;
  /** The ranking picker opened or closed. */
  onMenu: (open: boolean) => void;
  /** The chosen ranking is still downloading, or could not. */
  pending: boolean; error: string; retry: () => void;
  /** `null` while on-demand benchmark details are loading. */
  infoSnapshot: Snapshot | null; info: string | null; onInfo: (id: string | null) => void;
  probe: ReactNode;
}

export function ModelPage({ view, summary, availability, othersUrl, options, current, onPick, ranks, own, onMenu, pending, error, retry, infoSnapshot, info, onInfo, probe }: Props) {
  const { model, lab, mine, field, others, strengths, cost, measured, weighted } = view;
  const pal = useChartPalette();
  const labC = markColor(lab?.color ?? "#2F4FB0", pal, lab?.id);
  const color = useMemo(() => ({ lab: labC, name: (id: string) => field.names[id] ?? id }), [labC, field.names]);
  const inMix = field.benchmarks;
  // A ranking that leaves the model out has only the full list to show, so it starts open (and opens again when a pick leaves the model out).
  const unranked = mine.length === 0;
  const [showAll, setShowAll] = useState(unranked), [wasUnranked, setWasUnranked] = useState(unranked);
  if (unranked !== wasUnranked) { setWasUnranked(unranked); if (unranked) setShowAll(true); }
  const all = useRef<HTMLDetailsElement>(null);
  const openAll = useCallback(() => {
    setShowAll(true);
    requestAnimationFrame(() => all.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
  }, []);
  // Against the field median only: the leader's outline makes a model with no place a speck at the centre.
  const domains = useMemo(() => (view.domains && unranked ? { ...view.domains, leader: undefined } : view.domains), [view.domains, unranked]);
  const modelId = model.id;
  const efforts = useMemo(() => buildEfforts(view), [view]);
  const bestEffort = efforts.list.find((r) => r.best)?.effort ?? null;

  return (
    <main className="min-h-screen">
      {probe}
      <SiteHeader current="models" />
      <BestEffortContext.Provider value={bestEffort}>
      <div className="max-w-[1100px] mx-auto px-5 sm:px-8 py-10 grid gap-12">
        <ModelHeader view={view} summary={summary} labC={labC} options={options} current={current} onPick={onPick} ranks={ranks} own={own} pending={pending} error={error} retry={retry} onMenu={onMenu} onShowAll={openAll} />

        <ModelEfforts data={efforts} color={labC} pending={pending} />

        {strengths && <ModelStrengths data={strengths} labColors={view.labColors} onInfo={onInfo} />}

        {domains && <ModelDomains data={domains} name={model.name} labId={lab?.id} labColors={view.labColors} />}

        {mine.length > 0 && <ModelCostSpeed data={cost} modelId={modelId} name={model.name} color={labC} />}

        {availability && <ModelAvailabilitySection data={availability} />}

        {inMix.length > 0 && <section className="grid gap-4">
          <div className="flex items-baseline justify-between border-b hairline pb-2"><h2 className="text-[26px]">This ranking&rsquo;s benchmarks</h2><span className="cap">{inMix.length} of {weighted} measured</span></div>
          {view.costBasis === "subscription" && <p className="cap -mt-2">Cost per task is what a subscriber pays: the model&rsquo;s plan price, a share of API price. Models no plan sells are at API price.</p>}
          <div className="grid gap-8 lg:grid-cols-2">{inMix.map((b) => <BenchCard key={b.id} b={b} view={field} modelId={modelId} color={color} plan={view.costBasis === "subscription"} onInfo={() => onInfo(b.id)} />)}</div>
        </section>}

        {others > 0 && <details ref={all} open={showAll} className="group border-t hairline pt-4" onToggle={(e) => setShowAll(e.currentTarget.open)}>
          <summary className="disclosure items-baseline"><h2 className="text-[22px]">All {measured} benchmarks</h2><span className="cap ml-auto group-open:hidden">show {others} more</span><span className="cap ml-auto hidden group-open:inline">hide</span></summary>
          {showAll && <LazyCards data={view.otherField} url={othersUrl} modelId={modelId} lab={labC} plan={view.costBasis === "subscription"} onInfo={onInfo} />}
        </details>}
      </div>
      </BestEffortContext.Provider>
      <BenchmarkInfo snapshot={infoSnapshot} benchmarkId={info} onClose={() => onInfo(null)} />
      <SiteFooter />
    </main>
  );
}

/** A chart that only exists while it is near the screen; the same height either way, so nothing jumps. */
function NearView({ height, children }: { height: number; children: ReactNode }) {
  const [ref, near] = useNearView<HTMLDivElement>();
  return <div ref={ref} style={{ minHeight: height }}>{near && children}</div>;
}

/** The rest of the model's benchmarks, rendered only once the section is opened. A page drawn on the server fetches them then. */
function LazyCards({ data, url, modelId, lab, plan, onInfo }: { data?: ViewField; url: string; modelId: string; lab: string; plan: boolean; onInfo: (id: string) => void }) {
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
  return <div className="grid gap-8 lg:grid-cols-2 mt-5">{field.benchmarks.map((b) => <BenchCard key={b.id} b={b} view={field} modelId={modelId} color={color} plan={plan} onInfo={() => onInfo(b.id)} />)}</div>;
}

/** One benchmark: this model's efforts highlighted on score-vs-cost (others ghosted), or on the field's spread when cost is unknown, plus placements. */
function BenchCard({ b, view, modelId, color, plan = false, onInfo }: { b: ViewBenchmark; view: Pick<ViewField, "variants">; modelId: string; color: { lab: string; name: (id: string) => string }; plan?: boolean; onInfo: () => void }) {
  const rows = useMemo(() => benchRows(view, b), [view, b]);
  const mine = useMemo(() => rows.filter((r) => r.modelId === modelId), [rows, modelId]);
  const withCost = rows.filter((r) => r.cost && r.cost > 0);
  return (
    <article className="grid gap-3 content-start">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="cap">{categoryName(b.category)}</p><h3 className="text-[19px] leading-tight flex items-center gap-1.5">{b.name}<InfoIcon name={b.name} onClick={onInfo} /></h3></div><span className="cap shrink-0 pt-4">{rows.length} results</span></div>
      {withCost.length >= 3 && mine.some((r) => r.cost) ? <NearView height={230}><BenchScatter b={b} rows={withCost} modelId={modelId} color={color} plan={plan} /></NearView>
        : rows.length >= 3 && <NearView height={150}><BenchStrip b={b} rows={rows} modelId={modelId} color={color} /></NearView>}
      <EffortRows b={b} mine={mine} of={rows.length} color={color.lab} fmt={fmt} />
      <p className="cap">Leader: {rows[0]?.modelId === modelId ? "this model" : color.name(rows[0]?.modelId ?? "")} · {rows[0] ? fmt(b, rows[0].value) : ""}</p>
    </article>
  );
}

function BenchScatter({ b, rows, modelId, color, plan }: { b: Bench; rows: Row[]; modelId: string; color: { lab: string; name: (id: string) => string }; plan: boolean }) {
  const pal = useChartPalette();
  const [plotW, setPlotW] = useState(0);
  const option = useMemo<EChartsOption>(() => {
    const mine = rows.filter((r) => r.modelId === modelId).sort((a, c) => a.cost! - c.cost!), rest = rows.filter((r) => r.modelId !== modelId);
    const labColor = color.lab;
    return {
      grid: { left: 44, right: 70, top: 14, bottom: 34, ...CONTAIN_AXIS_LABELS },
      xAxis: { type: "log", name: plan ? "plan $ / task" : "$ / task", nameLocation: "end", nameGap: 6, nameTextStyle: { color: pal.grey, fontSize: 10, align: "right", verticalAlign: "top", padding: [22, 0, 0, 0] }, axisLabel: { formatter: (v: number) => `$${v >= 1 ? Math.round(v) : v.toFixed(2)}`, hideOverlap: true, showMinLabel: false, showMaxLabel: false }, min: (e: { min: number }) => e.min / 1.5, max: (e: { max: number }) => e.max * 1.5 },
      yAxis: { type: "value", scale: true, axisLabel: { formatter: (v: number) => b.unit === "percent" ? `${v}%` : `${v}` } },
      tooltip: { trigger: "item", confine: true, formatter: (p: unknown) => { const d = (p as { data?: { r?: Row } }).data?.r; return d ? `<b>${esc(color.name(d.modelId))} ${esc(d.effort)}</b><br/><span style="font-family:var(--font-jetbrains)">${fmt(b, d.value)} · $${d.cost!.toFixed(2)}/task${plan ? " on plan" : ""} · #${d.rank}</span>` : ""; } },
      series: [
        { type: "scatter", id: "ghost", symbolSize: 7, data: rest.map((r) => ({ value: [r.cost, r.value], r })), itemStyle: { color: pal.dark ? "#8C8B83" : "#A3A39B", opacity: pal.dark ? 0.32 : 0.28 }, emphasis: { itemStyle: { opacity: 0.9 } }, z: 1 },
        { type: "line", id: "mine-line", data: mine.map((r) => [r.cost, r.value]), showSymbol: false, lineStyle: { color: labColor, width: 1.2, opacity: 0.6 }, silent: true, z: 2 },
        { type: "scatter", id: "mine", symbolSize: 11, data: mine.map((r) => ({ value: [r.cost, r.value], r, name: r.effort })), itemStyle: { color: labColor, borderColor: pal.ink, borderWidth: 1.2 }, label: { show: true, position: "right", formatter: "{b}", fontSize: 11, color: pal.ink, distance: 6, textBorderColor: pal.bg, textBorderWidth: 3 }, labelLayout: insideLabels(() => plotW || undefined), z: 3 },
      ],
    };
  }, [b, rows, modelId, color, pal, plotW, plan]);
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
