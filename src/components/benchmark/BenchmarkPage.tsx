"use client";
import { planResetsProps, usePlanResetsOn, withResetsPref } from "@/lib/plan-resets-pref";
import { planPicker, useAdjustedSnapshot, useSubscriptionPlansPref, withPlansPref } from "@/lib/subscription-plans-pref";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Snapshot } from "@/data/types";
import { chartVariantMode, computeIndex, DEFAULT_EFFORTS, EFFORT_CHOICES, filterEfforts, rankingRows as rankingRowsOf, type IndexConfig, type RankedVariant } from "@/engine";
import { hasSubscriptionPrices } from "@/data/task-metrics";
import { effectiveBasis, planReadingSettings, type CostBasis } from "@/data/subscription";
import { hiddenIds, toggleVisibility, SHOW_ALL, type Vis } from "@/lib/model-visibility";
import { formulaInputs } from "@/lib/metrics";
import { formatBenchValue } from "@/lib/benchmark-format";
import { benchmarkIndex, benchmarkView, hasOwnCost } from "@/lib/benchmark-page";
import { SiteFooter } from "../SiteFooter";
import { BenchmarkStars } from "./BenchmarkStar";
import { BenchmarkHeader } from "./BenchmarkHeader";
import { QualityPanel, type QualityView } from "./QualityPanel";
import { Rankings } from "../Rankings";
import { ParetoChart } from "../chart/ParetoChart";
import { freeTierSettings } from "@/data/free-tier";
import { ChartSettings } from "../chart/ChartSettings";
import { useScatterView } from "../chart/ScoreScatter";
import { HighlightContext, type HighlightModel } from "../chart/highlight";
import { STAR_CAP } from "../chart/star-menu";
import { markColor, useChartPalette } from "../chart/echarts";
import { GalleryChart, Panel } from "../page/MetricGallery";
import { INDEX_SCORE_AXIS, ScoreAxisContext, type ScoreAxis } from "../chart/score-axis";
import { BreakdownTable, SeriesChart } from "./BenchmarkExtras";
import { ResultsTable } from "./ResultsTable";
import { ExplorePanel, StandardTools } from "./SlicePickers";
import type { SlicePeers } from "@/lib/benchmark-slices";
import { metricChartOf } from "@/lib/benchmark-chart";
import { benchmarkMetrics, benchmarkSeries } from "@/lib/benchmark-metrics";
import { SiteHeader } from "@/components/SiteHeader";
import { CreatorBlocks, CreatorPageProvider, type CreatorPage } from "./CreatorBlocks";
import type { EmbedRow } from "@/lib/benchmark-embed";

const fmt = formatBenchValue;

/** One benchmark on its own: who leads it, and what each result costs, priced the way a subscriber pays when the lab has a plan. */
export function BenchmarkPage({ snapshot: base, benchmarkId, models, relatives, initial, quality, creator }: { snapshot: Snapshot; benchmarkId: string; models: number; relatives: { family: { id: string; label: string }[]; familyLabel?: string; versions: { id: string; label: string }[]; /** Who leads each of those boards, worked out by the server. */ peers?: SlicePeers }; /** Settings from a copied link. */ initial?: IndexConfig; /** The benchmark's quality score, its parts and its stars, from the server. Absent for token-price proxies. */ quality?: QualityView; /** Its verified creators and what they added, from the server. */ creator?: CreatorPage | null }) {
  const snapshot = useAdjustedSnapshot(base);
  const b = snapshot.benchmarks.find((x) => x.id === benchmarkId)!;
  const [config, setConfig] = useState<IndexConfig>(() => initial ?? benchmarkIndex(snapshot, benchmarkId));
  const patch = useCallback((p: Partial<IndexConfig>) => setConfig((c) => ({ ...c, ...p })), []);
  const resetsOn = usePlanResetsOn(), plansPref = useSubscriptionPlansPref();
  const result = useMemo(() => computeIndex(snapshot, { ...withPlansPref(withResetsPref(config, resetsOn), plansPref), variants: "all" }, benchmarkView(snapshot, benchmarkId)), [snapshot, config, benchmarkId, resetsOn, plansPref]);
  const pal = useChartPalette();
  const rankingMode = chartVariantMode(config, "ranking"), paretoMode = chartVariantMode(config, "pareto");
  const rows = useMemo(() => rankingRowsOf(result.ranked, config), [result, config]);
  const metricRanked = useMemo(() => filterEfforts(result.ranked, config.efforts), [result.ranked, config.efforts]);
  const hasCost = hasOwnCost(snapshot, benchmarkId) && result.ranked.some((r) => r.costUsd != null);
  const plans = hasSubscriptionPrices(snapshot);
  const basis = effectiveBasis(config.costBasis, plans);
  const apiObs = useMemo(() => new Map(snapshot.observations.filter((o) => o.benchmarkId === benchmarkId).map((o) => [o.variantId, o])), [snapshot, benchmarkId]);
  const [paretoView, setParetoView] = useScatterView("benchmark-pareto");
  const [highlight, setHighlight] = useState<string[]>(() => initial?.highlight ?? []);
  // Every model with a result, ranked first, then the ones hidden, so a hidden model can be shown again.
  const pickerModels = useMemo(() => {
    const col = new Map(snapshot.labs.map((l) => [l.id, markColor(l.color, pal, l.id)])), labName = new Map(snapshot.labs.map((l) => [l.id, l.name]));
    const seen = new Map<string, HighlightModel>();
    const add = (id: string) => { if (!seen.has(id)) { const m = snapshot.models.find((x) => x.id === id); if (m) seen.set(id, { id, name: m.name, color: col.get(m.labId), open: m.openWeights, lab: labName.get(m.labId), labId: m.labId }); } };
    for (const r of result.ranked) if (!seen.has(r.model.id)) seen.set(r.model.id, { id: r.model.id, name: r.model.name, color: col.get(r.model.labId), open: r.model.openWeights, lab: labName.get(r.model.labId), labId: r.model.labId });
    for (const id of result.candidateModelIds) add(id);
    for (const id of config.excludeModels ?? []) add(id);
    return [...seen.values()];
  }, [result, config.excludeModels, snapshot, pal]);
  const rankedCount = useMemo(() => new Set(result.ranked.map((r) => r.model.id)).size, [result.ranked]);
  const pickerIds = useMemo(() => pickerModels.map((m) => m.id), [pickerModels]);
  const excludedIds = useMemo(() => hiddenIds(config, pickerIds, result.autoHidden), [config, pickerIds, result.autoHidden]);
  const setVisibility = useCallback((vis: Vis) => setConfig((c) => ({ ...c, ...vis })), []);
  const toggleModel = useCallback((id: string) => setConfig((c) => ({ ...c, ...toggleVisibility(c, id, pickerIds, result.autoHidden) })), [pickerIds, result.autoHidden]);
  const modelPicker = { models: pickerModels, excluded: excludedIds, onToggleModel: toggleModel, onShowAllModels: () => setVisibility(SHOW_ALL), onHideAllModels: () => setVisibility({ excludeModels: pickerIds, onlyModels: undefined }), onShowOnly: (ids: string[]) => setVisibility({ excludeModels: pickerIds.filter((id) => !ids.includes(id)), onlyModels: undefined }) };
  const releaseProps = { releasedAfter: config.releasedAfter, onChangeReleased: (v: string) => patch({ releasedAfter: v }) };
  const highlightState = useMemo(() => ({ items: highlight, set: (h: string[]) => setHighlight(h.slice(0, STAR_CAP)), models: pickerModels, ranked: rankedCount, linkIndices: [{ ...config, highlight: highlight.length ? highlight : undefined }], curated: config.excludeModels !== undefined || config.onlyModels !== undefined }), [highlight, pickerModels, rankedCount, config]);
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
  const pickExplore = useCallback((id: string) => { setExplore(id); const url = new URL(window.location.href); url.searchParams.set("bm", id); window.history.replaceState(window.history.state, "", url); }, []);
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
  // What a creator's embed reads with `priors.rows()`: the leaderboard as it stands under the visitor's settings.
  const embedRows = useMemo<EmbedRow[]>(() => {
    const labs = new Map(snapshot.labs.map((l) => [l.id, l]));
    return rows.map((r) => {
      const lab = labs.get(r.model.labId), o = apiObs.get(r.variant.id);
      return { rank: r.rank, model: r.model.name, modelId: r.model.id, lab: lab?.name ?? r.model.labId, color: lab ? markColor(lab.color, pal, lab.id) : undefined, effort: r.variant.effort, value: r.values[0]?.raw ?? null, score: r.score, ci: o?.ci, costUsd: r.costUsd ?? undefined, released: r.model.releaseDate, url: `/models/${encodeURIComponent(r.model.id)}` };
    });
  }, [rows, snapshot.labs, apiObs, pal]);
  const embedBenchmark = { id: b.id, name: b.name, unit: b.unit, higherIsBetter: b.higherIsBetter !== false, url: b.url };

  return (
    <main className="min-h-screen">
      <SiteHeader current="benchmarks" />
      <CreatorPageProvider page={creator ?? null} benchmark={embedBenchmark} rows={embedRows}><BenchmarkStars><HighlightContext.Provider value={highlightState}><ScoreAxisContext.Provider value={plotRaw ? axis : { ...INDEX_SCORE_AXIS, name: "Score (Priors scale)" }}>
        <div className="max-w-[1100px] mx-auto px-5 sm:px-8 py-10 grid gap-12">
          <BenchmarkHeader b={b} benchmarkId={benchmarkId} quality={quality} relatives={relatives} models={models} results={result.ranked.length} date={snapshot.date} host={host} />

          <CreatorBlocks placement="above" />
          <section className="chart-panel">
            <Rankings anchor="rankings" imageTitle={b.name} format={(r) => { const v = published(r); return v != null ? fmt(b, v) : r.score.toFixed(1); }} title={title("Leaderboard")} ranked={rows} labs={snapshot.labs} showEffort={rankingMode === "all" && !b.effortBasis} limit={25}
              actions={<ChartSettings label="Ranking" efforts={{ value: config.rankingEfforts ?? [...EFFORT_CHOICES], onChange: (rankingEfforts) => patch({ rankingEfforts }), withMode: true }} mode={rankingMode} onChange={(rankingVariants) => patch({ rankingVariants })} {...releaseProps} {...modelPicker} />} />
          </section>

          <CreatorBlocks placement="below" />
          {quality && <QualityPanel view={quality} />}

          {hasCost && <section className="chart-panel">
            <ParetoChart formulaInputs={formulaInputs(snapshot, result.ranked, config.timeSource)} anchor="cost" basis={basis} description={`${b.name} · measured cost per task${basis === "subscription" ? ", then priced by subscription where plan data exists (Real API Pricing, full allowance used)" : ""}`} ranked={plotted} mode={paretoMode} labs={snapshot.labs} height={440} view={paretoView} onView={setParetoView}
              title={title(basis === "subscription" ? "Score vs subscription cost per task" : "Score vs cost per task")}
              actions={(barModels) => <ChartSettings anchor="cost" defaultScale="log" label="Pareto" mode={paretoMode} onChange={(paretoVariants) => patch({ paretoVariants })} view={paretoView} onView={setParetoView} {...releaseProps} {...effortProps} {...modelPicker} {...(barModels ?? {})}
                freeTiers={freeTierSettings(snapshot, config.freeTiers, (freeTiers) => patch({ freeTiers }))} planReading={planReadingSettings(snapshot, config.planReading, (planReading) => patch({ planReading }))} costBasis={plans ? { value: effectiveBasis(config.costBasis), onChange: (next: CostBasis) => patch({ costBasis: next === "subscription" ? undefined : next }) } : undefined} subscriptionPlans={planPicker(snapshot, config, plansPref, (subscriptionPlans) => patch({ subscriptionPlans }))} planResets={planResetsProps(snapshot, config, resetsOn, patch)} />} />
          </section>}

          {series.map((sr) => <section key={sr.id} className="chart-panel grid gap-2">
            {title(sr.label)}
            <p className="cap">As published by {host || "the benchmark"}, one line per run · follows the leaderboard&rsquo;s model and effort settings</p>
            <SeriesChart series={sr} ranked={rows} labs={snapshot.labs} />
          </section>)}

          {(metrics.standard.length > 0 || metrics.details.length > 0) && <section className="grid">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 border-ink pb-2"><h2 className="text-[22px] sm:text-[26px]">More from this benchmark</h2><span className="cap whitespace-nowrap">{metrics.standard.length + metrics.details.length} published measures</span></div>
            {metrics.standard.map((m, i) => <Panel key={m.id} anchor={`metric-${m.id}`} title={m.label} desc={`${m.values.size} results · lower is better`} defaultOpen={i === 0} tools={<StandardTools metric={m} ranked={plotted} labs={snapshot.labs} />}>
              <GalleryChart id={`bench-${m.id}`} anchor={`metric-${m.id}`} title={m.label} chart={metricChartOf(m, b.name)} ranked={plotted} defaultMode="all" labs={snapshot.labs} settings={gallerySettings} inputs={inputs} />
            </Panel>)}
            {exploring && <ExplorePanel details={metrics.details} exploring={exploring} pick={pickExplore} defaultOpen={!metrics.standard.length} ranked={plotted} labs={snapshot.labs}
              chart={<GalleryChart key={exploring.id} id={`bench-explore`} anchor="metric-explore" title={exploring.label} chart={metricChartOf(exploring, b.name)} ranked={plotted} defaultMode="all" labs={snapshot.labs} settings={gallerySettings} inputs={inputs} />} />}
          </section>}

          {metrics.groups.length > 0 && <section className="grid gap-3">
            <div className="flex items-baseline justify-between gap-x-4 border-b hairline pb-2"><h2 className="text-[22px] sm:text-[26px]">Breakdown</h2><span className="cap">darker is better within each column · click a column to sort</span></div>
            <BreakdownTable groups={metrics.groups} ranked={rows} />
          </section>}

          <ResultsTable table={table} b={b} hasCost={hasCost} basis={basis} apiObs={apiObs} ci={ci} harness={harness} standard={metrics.standard} labs={snapshot.labs} />
        </div>
      </ScoreAxisContext.Provider></HighlightContext.Provider></BenchmarkStars></CreatorPageProvider>
      <SiteFooter />
    </main>
  );
}

