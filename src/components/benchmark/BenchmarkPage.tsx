"use client";
import { planResetNote } from "@/data/plan-resets";
import { setPlanResetsPref, usePlanResetsOn, withResetsPref } from "@/lib/plan-resets-pref";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Benchmark, Observation, Snapshot } from "@/data/types";
import { chartVariantMode, computeIndex, DEFAULT_EFFORTS, EFFORT_CHOICES, filterEfforts, rankingRows as rankingRowsOf, type IndexConfig, type RankedVariant } from "@/engine";
import { hasSubscriptionPrices } from "@/data/task-metrics";
import { effectiveBasis, type CostBasis } from "@/data/subscription";
import { subscriptionShare } from "@/engine";
import { hiddenIds, toggleVisibility, SHOW_ALL, type Vis } from "@/lib/model-visibility";
import { formulaInputs } from "@/lib/metrics";
import { formatBenchValue } from "@/lib/benchmark-format";
import { benchmarkIndex, benchmarkView, hasOwnCost } from "@/lib/benchmark-page";
import { SiteFooter } from "../SiteFooter";
import { HeaderAccount } from "../AccountMenu";
import { SettingsButton } from "../SiteSettings";
import { Wordmark } from "../Wordmark";
import { SiteNav } from "../SiteNav";
import { Rankings } from "../Rankings";
import { ParetoChart } from "../chart/ParetoChart";
import { ChartSettings } from "../chart/ChartSettings";
import { useScatterView } from "../chart/ScoreScatter";
import { HighlightContext } from "../chart/highlight";
import { markColor, useChartPalette } from "../chart/echarts";
import { GalleryChart, Panel } from "../page/MetricGallery";
import { INDEX_SCORE_AXIS, ScoreAxisContext, type ScoreAxis } from "../chart/score-axis";
import { BreakdownTable, Relatives, SeriesChart } from "./BenchmarkExtras";
import { metricChartOf } from "@/lib/benchmark-chart";
import { benchmarkMetrics, benchmarkSeries, formatMetric, type BenchMetric } from "@/lib/benchmark-metrics";

const fmt = formatBenchValue;
const usd = (v: number) => v === 0 ? "free" : `$${v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toFixed(v >= 0.1 ? 2 : 3)}`;

/** One benchmark on its own: who leads it, and what each result costs, priced the way a subscriber pays when the lab has a plan. */
export function BenchmarkPage({ snapshot, benchmarkId, models, relatives, initial }: { snapshot: Snapshot; benchmarkId: string; models: number; relatives: { family: { id: string; label: string }[]; versions: { id: string; label: string }[] }; /** Settings from a copied link. */ initial?: IndexConfig }) {
  const b = snapshot.benchmarks.find((x) => x.id === benchmarkId)!;
  const [config, setConfig] = useState<IndexConfig>(() => initial ?? benchmarkIndex(snapshot, benchmarkId));
  const patch = useCallback((p: Partial<IndexConfig>) => setConfig((c) => ({ ...c, ...p })), []);
  const resetsOn = usePlanResetsOn();
  const result = useMemo(() => computeIndex(snapshot, { ...withResetsPref(config, resetsOn), variants: "all" }, benchmarkView(snapshot, benchmarkId)), [snapshot, config, benchmarkId, resetsOn]);
  const pal = useChartPalette();
  const rankingMode = chartVariantMode(config, "ranking"), paretoMode = chartVariantMode(config, "pareto");
  const rows = useMemo(() => rankingRowsOf(result.ranked, config), [result, config]);
  const metricRanked = useMemo(() => filterEfforts(result.ranked, config.efforts), [result.ranked, config.efforts]);
  const hasCost = hasOwnCost(snapshot, benchmarkId) && result.ranked.some((r) => r.costUsd != null);
  const plans = hasSubscriptionPrices(snapshot);
  const basis = effectiveBasis(config.costBasis, plans);
  const apiObs = useMemo(() => new Map(snapshot.observations.filter((o) => o.benchmarkId === benchmarkId).map((o) => [o.variantId, o])), [snapshot, benchmarkId]);
  const [paretoView, setParetoView] = useScatterView("benchmark-pareto");
  const [allRows, setAllRows] = useState(false);
  const [highlight, setHighlight] = useState<string[]>(() => initial?.highlight ?? []);
  // Every model with a result, ranked first, then the ones hidden, so a hidden model can be shown again.
  const pickerModels = useMemo(() => {
    const col = new Map(snapshot.labs.map((l) => [l.id, markColor(l.color, pal, l.id)]));
    const seen = new Map<string, { id: string; name: string; color?: string; open?: boolean }>();
    const add = (id: string) => { if (!seen.has(id)) { const m = snapshot.models.find((x) => x.id === id); if (m) seen.set(id, { id, name: m.name, color: col.get(m.labId), open: m.openWeights }); } };
    for (const r of result.ranked) if (!seen.has(r.model.id)) seen.set(r.model.id, { id: r.model.id, name: r.model.name, color: col.get(r.model.labId), open: r.model.openWeights });
    for (const id of result.candidateModelIds) add(id);
    for (const id of config.excludeModels ?? []) add(id);
    return [...seen.values()];
  }, [result, config.excludeModels, snapshot, pal]);
  const pickerIds = useMemo(() => pickerModels.map((m) => m.id), [pickerModels]);
  const excludedIds = useMemo(() => hiddenIds(config, pickerIds, result.autoHidden), [config, pickerIds, result.autoHidden]);
  const setVisibility = useCallback((vis: Vis) => setConfig((c) => ({ ...c, ...vis })), []);
  const toggleModel = useCallback((id: string) => setConfig((c) => ({ ...c, ...toggleVisibility(c, id, pickerIds, result.autoHidden) })), [pickerIds, result.autoHidden]);
  const modelPicker = { models: pickerModels, excluded: excludedIds, onToggleModel: toggleModel, onShowAllModels: () => setVisibility(SHOW_ALL), onHideAllModels: () => setVisibility({ excludeModels: pickerIds, onlyModels: undefined }), onShowOnly: (ids: string[]) => setVisibility({ excludeModels: pickerIds.filter((id) => !ids.includes(id)), onlyModels: undefined }) };
  const releaseProps = { releasedAfter: config.releasedAfter, onChangeReleased: (v: string) => patch({ releasedAfter: v }) };
  const highlightState = useMemo(() => ({ items: highlight, set: setHighlight, models: pickerModels, linkIndices: [{ ...config, highlight: highlight.length ? highlight : undefined }], curated: config.excludeModels !== undefined || config.onlyModels !== undefined }), [highlight, pickerModels, config]);
  const host = (() => { try { return new URL(b.url).hostname.replace(/^www\./, ""); } catch { return ""; } })();
  const table = result.ranked; // best first; scores already account for direction
  const effortProps = { efforts: { value: config.efforts ?? DEFAULT_EFFORTS, onChange: (efforts: string[]) => patch({ efforts }) } };
  const title = (name: string) => <h2 className="text-[22px] sm:text-[26px]">{name}</h2>;
  // What this benchmark publishes beyond the score: per-task measurements, sub-scores and splits, series.
  const metrics = useMemo(() => benchmarkMetrics(snapshot, b), [snapshot, b]);
  const series = useMemo(() => benchmarkSeries(snapshot, benchmarkId), [snapshot, benchmarkId]);
  const [explore, setExplore] = useState(() => metrics.details[0]?.id);
  // The measure being explored rides in the address (`bm`), so a copied link to that chart previews and opens on it.
  useEffect(() => {
    const frame = requestAnimationFrame(() => { const id = new URL(window.location.href).searchParams.get("bm"); if (id && metrics.details.some((m) => m.id === id)) setExplore(id); });
    return () => cancelAnimationFrame(frame);
  }, [metrics]);
  const pickExplore = (id: string) => { setExplore(id); const url = new URL(window.location.href); url.searchParams.set("bm", id); window.history.replaceState(window.history.state, "", url); };
  const exploring = metrics.details.find((m) => m.id === explore) ?? metrics.details[0];
  const inputs = useMemo(() => formulaInputs(snapshot, result.ranked, config.timeSource), [snapshot, result.ranked, config.timeSource]);
  // Charts plot the benchmark's published value (a dollar balance, an Elo), not Priors' 0 to 100 index score, when
  // higher is better there: then the frontier and "best" still mean the same thing. Bars keep the index score for length.
  const published = (r: RankedVariant) => r.values[0]?.raw;
  const plotRaw = b.higherIsBetter !== false && result.ranked.every((r) => published(r) != null);
  const axis = useMemo<ScoreAxis>(() => ({ name: b.shortName ?? b.name, format: (v) => fmt(b, v), fit: true }), [b]);
  const asPublished = useCallback((list: RankedVariant[]) => plotRaw ? list.map((r) => ({ ...r, score: published(r)! })) : list, [plotRaw]);
  const plotted = useMemo(() => asPublished(metricRanked), [asPublished, metricRanked]);
  const gallerySettings = { ...releaseProps, ...effortProps, ...modelPicker };
  const ci = result.ranked.some((r) => apiObs.get(r.variant.id)?.ci), harness = result.ranked.some((r) => apiObs.get(r.variant.id)?.harness);

  return (
    <main className="min-h-screen">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-8 py-2 sm:h-14 border-b hairline"><div className="flex items-center gap-5"><Wordmark /><span className="max-sm:hidden"><SiteNav /></span></div><span className="ml-auto flex items-center gap-2"><HeaderAccount /><SettingsButton /></span><span className="sm:hidden w-full"><SiteNav /></span></header>
      <HighlightContext.Provider value={highlightState}><ScoreAxisContext.Provider value={plotRaw ? axis : { ...INDEX_SCORE_AXIS, name: "Score (Priors scale)" }}>
        <div className="max-w-[1100px] mx-auto px-5 sm:px-8 py-10 grid gap-12">
          <section className="grid gap-2">
            <p className="cap"><Link href={"/benchmarks" as "/"} className="hover:text-ink">Benchmarks</Link> · {b.category}</p>
            <h1 className="text-[34px] sm:text-[44px] leading-[1.05]">{b.name}</h1>
            <p className="text-[15px] text-ink-2 max-w-[68ch]">{b.description}</p>
            <div className="mt-2"><Relatives current={benchmarkId} family={relatives.family} versions={relatives.versions} /></div>
            <p className="cap">{models} models · {result.ranked.length} results{b.lastUpdated ? ` · updated ${b.lastUpdated}` : ` · data as of ${snapshot.date}`}{host && <> · <a href={b.url} target="_blank" rel="noreferrer" className="hover:text-ink underline decoration-dotted">{host} ↗</a></>}</p>
          </section>

          <section className="chart-panel">
            <Rankings anchor="rankings" format={(r) => { const v = published(r); return v != null ? fmt(b, v) : r.score.toFixed(1); }} title={title("Leaderboard")} ranked={rows} labs={snapshot.labs} showEffort={rankingMode === "all"} limit={25}
              actions={<ChartSettings label="Ranking" efforts={{ value: config.rankingEfforts ?? [...EFFORT_CHOICES], onChange: (rankingEfforts) => patch({ rankingEfforts }), withMode: true }} mode={rankingMode} onChange={(rankingVariants) => patch({ rankingVariants })} {...releaseProps} {...modelPicker} />} />
          </section>

          {hasCost && <section className="chart-panel">
            <ParetoChart formulaInputs={formulaInputs(snapshot, result.ranked, config.timeSource)} anchor="cost" basis={basis} description={`${b.name} · measured cost per task${basis === "subscription" ? " · subscription-priced where plan data exists (Real API Pricing, full allowance used)" : ""}`} ranked={plotted} mode={paretoMode} labs={snapshot.labs} height={440} view={paretoView} onView={setParetoView}
              title={title(basis === "subscription" ? "Score vs subscription cost per task" : "Score vs cost per task")}
              actions={(barModels) => <ChartSettings anchor="cost" defaultScale="log" label="Pareto" mode={paretoMode} onChange={(paretoVariants) => patch({ paretoVariants })} view={paretoView} onView={setParetoView} {...releaseProps} {...effortProps} {...modelPicker} {...(barModels ?? {})}
                costBasis={plans ? { value: effectiveBasis(config.costBasis), onChange: (next: CostBasis) => patch({ costBasis: next === "subscription" ? undefined : next }) } : undefined} planResets={{ value: withResetsPref(config, resetsOn).planResets === true, onChange: (on: boolean) => { setPlanResetsPref(on); patch({ planResets: on ? true : undefined }); }, note: planResetNote(snapshot) }} />} />
          </section>}

          {series.map((sr) => <section key={sr.id} className="chart-panel grid gap-2">
            {title(sr.label)}
            <p className="cap">As published by {host || "the benchmark"}, one line per run · follows the leaderboard&rsquo;s model and effort settings</p>
            <SeriesChart series={sr} ranked={rows} labs={snapshot.labs} />
          </section>)}

          {(metrics.standard.length > 0 || metrics.details.length > 0) && <section className="grid">
            <div className="flex items-baseline justify-between border-b-2 border-ink pb-2"><h2 className="text-[22px] sm:text-[26px]">More from this benchmark</h2><span className="cap">{metrics.standard.length + metrics.details.length} published measures</span></div>
            {metrics.standard.map((m, i) => <Panel key={m.id} anchor={`metric-${m.id}`} title={m.label} desc={`${m.values.size} results · lower is better`} defaultOpen={i === 0}>
              <GalleryChart id={`bench-${m.id}`} anchor={`metric-${m.id}`} title={m.label} chart={metricChartOf(m, b.name)} ranked={plotted} defaultMode="all" labs={snapshot.labs} settings={gallerySettings} inputs={inputs} />
            </Panel>)}
            {exploring && <Panel anchor="metric-explore" title="Score vs any published measure" desc={`${metrics.details.length} measures: sub-scores, splits, counts`} defaultOpen={!metrics.standard.length}
              tools={<span onClick={(e) => e.stopPropagation()}><select aria-label="Measure" className="inp !w-auto !py-0.5 !text-[12px] max-w-[260px]" value={exploring.id} onChange={(e) => pickExplore(e.target.value)}>{metrics.details.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></span>}>
              <GalleryChart key={exploring.id} id={`bench-explore`} anchor="metric-explore" title={exploring.label} chart={metricChartOf(exploring, b.name)} ranked={plotted} defaultMode="all" labs={snapshot.labs} settings={gallerySettings} inputs={inputs} />
            </Panel>}
          </section>}

          {metrics.groups.length > 0 && <section className="grid gap-3">
            <div className="flex items-baseline justify-between border-b hairline pb-2"><h2 className="text-[22px] sm:text-[26px]">Breakdown</h2><span className="cap">darker is better within each column · click a column to sort</span></div>
            <BreakdownTable groups={metrics.groups} ranked={rows} />
          </section>}

          <section className="grid gap-3">
            <div className="flex items-baseline justify-between border-b hairline pb-2"><h2 className="text-[22px] sm:text-[26px]">All results</h2><span className="cap">{table.length} rows</span></div>
            <div className="overflow-x-auto"><table className="w-full text-[13px] min-w-[560px]">
              <thead><tr className="cap text-left"><th className="py-1.5 pr-3 font-normal w-10">#</th><th className="py-1.5 pr-3 font-normal">Model</th><th className="py-1.5 pr-3 font-normal">Effort</th><th className="py-1.5 pr-3 font-normal text-right">{b.name.length > 24 ? "Score" : b.name}</th>{hasCost && <th className="py-1.5 pr-3 font-normal text-right">{basis === "subscription" ? "Subscription $ / task" : "$ / task"}</th>}{hasCost && basis === "subscription" && <th className="py-1.5 pr-3 font-normal text-right">API $ / task</th>}{metrics.standard.map((m) => <th key={m.id} className="py-1.5 pr-3 font-normal text-right">{m.label.replace(" per task", "")}</th>)}{harness && <th className="py-1.5 font-normal">Harness</th>}</tr></thead>
              <tbody>{(allRows ? table : table.slice(0, 30)).map((r, i) => <Row key={r.variant.id} r={r} i={i} b={b} hasCost={hasCost} basis={basis} obs={apiObs.get(r.variant.id)} ci={ci} standard={metrics.standard} harness={harness} />)}</tbody>
            </table></div>
            {table.length > 30 && <button type="button" className="btn-quiet justify-self-start" onClick={() => setAllRows((v) => !v)}>{allRows ? "Show fewer" : `Show all ${table.length}`}</button>}
          </section>
        </div>
      </ScoreAxisContext.Provider></HighlightContext.Provider>
      <SiteFooter />
    </main>
  );
}

function Row({ r, i, b, hasCost, basis, obs, ci, standard, harness }: { r: RankedVariant; i: number; b: Benchmark; hasCost: boolean; basis: CostBasis; obs?: Observation; ci: boolean; standard: BenchMetric[]; harness: boolean }) {
  const raw = r.values[0]?.raw, api = obs?.costUsd;
  const half = ci && obs?.ci ? (obs.ci[1] - obs.ci[0]) / 2 : undefined;
  return <tr className="border-t hairline">
    <td className="py-1.5 pr-3 num text-grey">{i + 1}</td>
    <td className="py-1.5 pr-3"><Link href={`/models/${r.model.id}` as "/"} className="hover:text-ink">{r.model.name}</Link></td>
    <td className="py-1.5 pr-3 mono text-ink-2">{r.variant.effort === "default" ? "" : r.variant.effort}</td>
    <td className="py-1.5 pr-3 num text-right" title={obs?.ci ? `interval ${fmt(b, obs.ci[0])} to ${fmt(b, obs.ci[1])}` : obs?.note}>{raw != null ? fmt(b, raw) : r.score.toFixed(1)}{half != null && <span className="text-grey"> ±{fmt(b, half).replace("%", "")}</span>}{obs?.details?.launchClaim != null && <span className="text-grey text-[11px] ml-1" data-launch-claim>launch</span>}</td>
    {hasCost && <td className="py-1.5 pr-3 num text-right" title={r.costPlan ? `${r.costPlan.plan}: ${subscriptionShare(r.costPlan.ratio)} of API price` : undefined}>{r.costUsd != null ? usd(r.costUsd) : ""}</td>}
    {hasCost && basis === "subscription" && <td className="py-1.5 pr-3 num text-right text-grey">{api != null ? usd(api) : ""}</td>}
    {standard.map((m) => { const v = m.values.get(r.variant.id); return <td key={m.id} className="py-1.5 pr-3 num text-right text-ink-2">{v != null ? formatMetric(m.kind, v) : ""}</td>; })}
    {harness && <td className="py-1.5 text-ink-2 truncate max-w-[160px]">{obs?.harness ?? ""}</td>}
  </tr>;
}
