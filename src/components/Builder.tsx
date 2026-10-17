"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MixAssistant } from "./MixAssistant";
import { SharedChart } from "./SharedChart";
import { track } from "@/lib/analytics";
import { HighlightContext } from "./chart/highlight";
import { SettingsButton } from "./SiteSettings";
import type { Snapshot } from "@/data/types";
import { chartVariantMode, computeIndex, PAGE_VIEW, defaultConfig, DEFAULT_EFFORTS, EFFORT_CHOICES, filterEfforts, rankingRows as rankingRowsOf, type IndexConfig } from "@/engine";
import { ShareCards } from "./ShareCards";
import { encodeIndex, encodeIndices, decodeIndices, prettyQuery } from "@/lib/url";
import { PRIORS_MIX_COOKIE } from "@/onboarding/defaults";
import { hiddenIds, toggleVisibility, SHOW_ALL, type Vis } from "@/lib/model-visibility";
import { WeightsPanel } from "./WeightsPanel";
import { Rankings } from "./Rankings";
import { ParetoChart } from "./chart/ParetoChart";
import { ChartPaletteContext, useChartPalette, useLabColor } from "./chart/echarts";
import { useBuilderSize } from "./builder-size";
import "./builder.css";
import { useScatterView } from "./chart/ScoreScatter";
import { Wordmark } from "./Wordmark";
import { SiteNav } from "./SiteNav";
import { IndexTabs } from "./IndexTabs";
import { CalculationSettings, type CalculationSettingsHandle } from "./CalculationSettings";
import { ChartSettings } from "./chart/ChartSettings";
import { HeaderAuth } from "./HeaderAuth";
import { mergeImports, type ImportPayload } from "@/lib/import";
import { SourceStatus } from "./SourceStatus";
import { effectiveBasis } from "@/data/subscription";
import { costDescription, hasSubscriptionPrices, taskMetricOptions } from "@/data/task-metrics";
import { formulaInputs } from "@/lib/metrics";
import { MetricGallery } from "./page/MetricGallery";
import { IndexLabActions, type PublishPlacement } from "./lab/IndexLabActions";

export function Builder({ snapshot: base, initialIndices, labPlacement }: { snapshot: Snapshot; initialIndices: IndexConfig[]; labPlacement?: PublishPlacement }) {
  // Benchmarks imported in this browser (via /import without an account) are merged client-side.
  const calculations = useRef<CalculationSettingsHandle>(null);
  const [local, setLocal] = useState<ImportPayload[]>([]);
  useEffect(() => { const id = requestAnimationFrame(() => { try { setLocal(JSON.parse(localStorage.getItem("priors:imports") ?? "[]")); } catch { /* ignore */ } }); return () => cancelAnimationFrame(id); }, []);
  const [live, setLive] = useState({ base, snapshot: base });
  const sourceSnapshot = live.base === base ? live.snapshot : base;
  const receiveSnapshot = useCallback((s: Snapshot) => setLive({ base, snapshot: s }), [base]);
  const snapshot = useMemo(() => mergeImports(sourceSnapshot, local).snapshot, [sourceSnapshot, local]);
  // URL is the source of truth for anonymous builds; multiple `i` params = multiple indices.
  const [indices, setIndices] = useState<IndexConfig[]>(() => (initialIndices.length ? initialIndices : [defaultConfig(base)]));
  // Restore the last edited indices when the URL carries none, and persist
  // edits so returning to /builder picks up where you left off.
  useEffect(() => {
    if (labPlacement || initialIndices.length) return;
    const id = requestAnimationFrame(() => {
      try { const saved = localStorage.getItem("priors:indices"); if (saved) { const list = decodeIndices(JSON.parse(saved) as string[]); if (list.length) setIndices(list); } } catch { /* ignore */ }
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [activeId, setActiveId] = useState(indices[0].id);
  const active = indices.find((i) => i.id === activeId) ?? indices[0];
  const result = useMemo(() => computeIndex(snapshot, { ...active, variants: "all" }, PAGE_VIEW), [snapshot, active]);
  const rankingMode = chartVariantMode(active, "ranking"), paretoMode = chartVariantMode(active, "pareto");
  const rankingRows = useMemo(() => rankingRowsOf(result.ranked, active), [result, active]);
  // Settings-gear model picker: ranked models first (rank order), then the rest
  // of the candidate pool, then any excluded ids resolved from the catalog so
  // they can be re-checked.
  const labColor = useLabColor();
  const basePalette = useChartPalette(), size = useBuilderSize();
  const palette = useMemo(() => ({ ...basePalette, size }), [basePalette, size]);
  const pickerModels = useMemo(() => {
    const col = new Map(snapshot.labs.map((l) => [l.id, labColor(l.id, l.color)]));
    const seen = new Map<string, { id: string; name: string; color?: string; open?: boolean }>();
    const add = (id: string) => { if (!seen.has(id)) { const m = snapshot.models.find((x) => x.id === id); if (m) seen.set(id, { id, name: m.name, color: col.get(m.labId), open: m.openWeights }); } };
    for (const r of result.ranked) if (!seen.has(r.model.id)) seen.set(r.model.id, { id: r.model.id, name: r.model.name, color: col.get(r.model.labId), open: r.model.openWeights });
    for (const id of result.candidateModelIds) add(id);
    for (const id of active.excludeModels ?? []) add(id);
    return [...seen.values()];
  }, [result, active.excludeModels, snapshot, labColor]);
  const pickerIds = useMemo(() => pickerModels.map((m) => m.id), [pickerModels]);
  const excludedIds = useMemo(() => hiddenIds(active, pickerIds, result.autoHidden), [active, pickerIds, result.autoHidden]);
  const setVisibility = useCallback((vis: Vis) => setIndices((list) => list.map((i) => i.id === activeId ? { ...i, ...vis } : i)), [activeId]);
  const toggleModel = useCallback((id: string) => setIndices((list) => list.map((i) => {
    if (i.id !== activeId) return i;
    return { ...i, ...toggleVisibility(i, id, pickerIds, result.autoHidden) };
  })), [activeId, pickerIds, result.autoHidden]);
  // Legacy allowlists are converted when the user changes model visibility.
  const modelPicker = { models: pickerModels, excluded: excludedIds, onToggleModel: toggleModel, onShowAllModels: () => setVisibility(SHOW_ALL), onHideAllModels: () => setVisibility({ excludeModels: pickerIds, onlyModels: undefined }), onShowOnly: (ids: string[]) => setVisibility({ excludeModels: pickerIds.filter((id) => !ids.includes(id)), onlyModels: undefined }) };
  const [paretoView, setParetoView] = useScatterView("pareto");
  const topNames = useMemo(() => [...new Set(rankingRows.map((r) => r.model.name))].slice(0, 3), [rankingRows]);
  // After a few real edits, one gentle hint beside Share. Never a pop-up, never twice.
  const [shareHint, setShareHint] = useState(false);
  const edits = useRef({ count: 0, first: active });
  useEffect(() => {
    if (labPlacement || active === edits.current.first || ++edits.current.count !== 4) return;
    const id = requestAnimationFrame(() => { try { if (!localStorage.getItem("priors:share-hint")) { localStorage.setItem("priors:share-hint", "1"); setShareHint(true); } } catch { /* ignore */ } });
    return () => cancelAnimationFrame(id);
  }, [active, labPlacement]);
  useEffect(() => {
    if (!shareHint) return;
    const off = setTimeout(() => setShareHint(false), 9000);
    return () => clearTimeout(off);
  }, [shareHint]);
  // One event per settled edit, not one per slider tick.
  useEffect(() => {
    if (labPlacement || active === edits.current.first) return;
    const t = setTimeout(() => track("index_changed", { benchmarks: Object.values(active.weights).filter((w) => w > 0).length }), 3000);
    return () => clearTimeout(t);
  }, [active, labPlacement]);
  const effortProps = { efforts: { value: active.efforts ?? DEFAULT_EFFORTS, onChange: (efforts: string[]) => update({ ...active, efforts }) } };
  const metricRanked = useMemo(() => filterEfforts(result.ranked, active.efforts), [result.ranked, active.efforts]);
  const releaseProps = { releasedAfter: active.releasedAfter, onChangeReleased: (v: string) => update({ ...active, releasedAfter: v }) };

  // write URL (debounced) when indices change
  const t = useRef<number | null>(null);
  useEffect(() => {
    if (t.current) window.clearTimeout(t.current);
    t.current = window.setTimeout(() => {
      const p = encodeIndices([active, ...indices.filter((i) => i.id !== active.id)], true); const url = new URL(window.location.href);
      url.searchParams.delete("i");
      p.getAll("i").forEach((value) => url.searchParams.append("i", value));
      url.searchParams.delete("date");
      url.search = prettyQuery(url.searchParams);
      window.history.replaceState(null, "", url.toString());
      if (!labPlacement) try {
        localStorage.setItem("priors:indices", JSON.stringify(p.getAll("i")));
        const encoded = encodeIndex({ ...active, onlyModels: undefined, excludeModels: undefined });
        if (encoded.length <= 2048) document.cookie = `${PRIORS_MIX_COOKIE}=${encodeURIComponent(encoded)}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
      } catch { /* ignore */ }
    }, 150);
    return () => { if (t.current) window.clearTimeout(t.current); };
  }, [indices, active, labPlacement]);

  const update = useCallback((c: IndexConfig) => setIndices((list) => list.map((i) => (i.id === c.id ? c : i))), []);
  const highlightState = useMemo(() => ({ items: active.highlight ?? [], set: (h: string[]) => update({ ...active, highlight: h.length ? h : undefined }), models: pickerModels, linkIndices: [active, ...indices.filter((i) => i.id !== active.id)] }), [active, indices, update, pickerModels]);
  // The + copies the index you are viewing (weights, filters, highlights), so a variation never starts from a blank mix.
  const add = () => {
    const id = `i${Date.now().toString(36)}`;
    const base = active.name.replace(/ copy( \d+)?$/, ""), taken = new Set(indices.map((i) => i.name));
    let name = `${base} copy`;
    for (let n = 2; taken.has(name); n++) name = `${base} copy ${n}`;
    setIndices((l) => [...l, { ...structuredClone(active), id, name }]);
    setActiveId(id);
    return { id, name };
  };
  const remove = (id: string) => { setIndices((l) => { const n = l.filter((i) => i.id !== id); if (!n.length) n.push(defaultConfig(snapshot)); if (activeId === id) setActiveId(n[0].id); return n; }); };

  return (
    <ChartPaletteContext.Provider value={palette}>
    <div className="builder min-h-dvh">
      <header className="builder-header grid grid-cols-[auto_minmax(0,1fr)_auto] lg:flex items-center gap-x-4 gap-y-2 px-4 sm:px-8 py-2 lg:py-0 lg:h-14 border-b hairline lg:sticky top-0 bg-bone z-40">
        <div className="shrink-0 flex items-center gap-5"><Wordmark transitionTypes={["nav-back"]} /><span className="max-sm:hidden"><SiteNav /></span></div>
        <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <IndexTabs indices={indices} activeId={active.id} onSelect={setActiveId} onRename={(id, name) => update({ ...indices.find((i) => i.id === id)!, name })} onAdd={add} onRemove={remove} />
        </div>
        <div className="col-span-3 row-start-2 lg:w-auto lg:ml-auto flex flex-wrap items-center gap-2 shrink-0">
          <span className="sm:hidden mr-auto"><SiteNav /></span>
          <span className="cap">Data as of {snapshot.date}</span>
          {!labPlacement && <><ShareCards indices={indices} active={active} top={topNames} hint={shareHint} onOpen={() => setShareHint(false)} /><HeaderAuth indices={indices} /></>}
        </div>
        <div className="col-start-3 row-start-1 shrink-0"><SettingsButton /></div>
      </header>

      <HighlightContext.Provider value={highlightState}>
      <main className={`builder-main grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-10 px-4 sm:px-8 pt-5 lg:pt-8 pb-8 max-w-[1500px] items-start ${labPlacement && labPlacement !== "rail" ? "[&>aside]:order-2 [&>section]:order-1 lg:[&>aside]:order-1 lg:[&>section]:order-2" : ""}`}>
        <aside aria-label="Index controls" className="builder-aside relative z-30 flex flex-col gap-5 min-h-0 lg:sticky lg:top-[88px] lg:h-[calc(100dvh-120px)]">
          {labPlacement === "rail" && <IndexLabActions active={active} date={snapshot.date} top={topNames} placement="rail" />}
          <section aria-label="Benchmarks and eligibility" className="min-h-0 min-w-0 lg:flex-1 lg:overflow-y-auto lg:overflow-x-hidden lg:overscroll-contain pr-2 pb-2">
            <h2 className="text-[22px] mb-1">Your mix</h2>
            <p className="cap mb-4">{result.benchmarks.length} benchmarks · {new Set(result.ranked.map((r) => r.model.id)).size} models</p>
            <WeightsPanel snapshot={snapshot} config={active} result={result} onChange={update} />
            <CalculationSettings ref={calculations} config={active} result={result} snapshot={snapshot} onChange={update}>
              <SourceStatus snapshot={sourceSnapshot} onSnapshot={receiveSnapshot} />
            </CalculationSettings>
          </section>
        </aside>

        {/* Keep the assistant clearance inside this column so the sidebar stays below the header at the page bottom. */}
        <section className="builder-charts grid gap-10 min-w-0 content-start pb-20 [&>div]:min-w-0">
          <div className="builder-rank">
            <Rankings anchor="rankings" limit={labPlacement ? 10 : undefined} title={<h2 className="text-[26px]">{active.name}</h2>} actions={<ChartSettings label="Ranking" efforts={{ value: active.rankingEfforts ?? [...EFFORT_CHOICES], onChange: (rankingEfforts) => update({ ...active, rankingEfforts }), withMode: true }} mode={rankingMode} onChange={(rankingVariants) => update({ ...active, rankingVariants })} {...releaseProps} {...modelPicker} />} onSelect={(r) => { if (r) calculations.current?.inspect(r.variant.id); }} ranked={rankingRows} labs={snapshot.labs} showEffort={rankingMode === "all"} />
          </div>
          {labPlacement === "inline" && <IndexLabActions active={active} date={snapshot.date} top={topNames} placement="inline" />}
          <div className="builder-cost">
            <ParetoChart formulaInputs={formulaInputs(snapshot, result.ranked, active.timeSource)} basis={effectiveBasis(active.costBasis, hasSubscriptionPrices(snapshot))} description={costDescription(active.costSource ?? "aa", effectiveBasis(active.costBasis, hasSubscriptionPrices(snapshot)))} anchor="cost" ranked={metricRanked} mode={paretoMode} labs={snapshot.labs} view={paretoView} onView={setParetoView} title={<h2 className="text-[22px]">{effectiveBasis(active.costBasis, hasSubscriptionPrices(snapshot)) === "subscription" ? "Score vs subscription cost per task" : "Score vs cost per task"}</h2>}
              actions={(barModels) => <ChartSettings anchor="cost" defaultScale="log" dataSource={{ value: active.costSource ?? "aa", options: taskMetricOptions(snapshot, "cost"), onChange: (costSource) => update({ ...active, costSource }) }} costBasis={hasSubscriptionPrices(snapshot) ? { value: effectiveBasis(active.costBasis), onChange: (basis) => update({ ...active, costBasis: basis === "subscription" ? undefined : basis }) } : undefined} label="Pareto" mode={paretoMode} onChange={(paretoVariants) => update({ ...active, paretoVariants })} view={paretoView} onView={setParetoView} {...releaseProps} {...effortProps} {...modelPicker} {...(barModels ?? {})} />} />
          </div>
          <div className="builder-more">
            <h2 className="text-[22px] mb-1">More metrics</h2>
            <MetricGallery timeSource={active.timeSource} onTimeSourceChange={(timeSource) => update({ ...active, timeSource })} ranked={metricRanked} mode={paretoMode} snapshot={snapshot} labs={snapshot.labs} benchmarks={result.benchmarks} config={active} settings={{ ...releaseProps, ...effortProps, ...modelPicker }} />
          </div>
        </section>
      </main>
      </HighlightContext.Provider>
      {labPlacement === "dock" && <IndexLabActions active={active} date={snapshot.date} top={topNames} placement="dock" />}
      {!labPlacement && <SharedChart highlight={active.highlight} onHighlight={(items) => update({ ...active, highlight: items.length ? items : undefined })} />}
      {!labPlacement && <MixAssistant config={active} onApply={update} date={snapshot.date} />}
    </div>
    </ChartPaletteContext.Provider>
  );
}
