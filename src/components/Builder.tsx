"use client";
import { planResetNote, planResetRows } from "@/data/plan-resets";
import { setPlanResetsPref, usePlanResetsOn, withResetsPref } from "@/lib/plan-resets-pref";
import { planPicker, useSubscriptionPlansPref, withPlansPref } from "@/lib/subscription-plans-pref";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MixAssistant } from "./MixAssistant";
import { SharedChart } from "./SharedChart";
import { track } from "@/lib/analytics";
import { HighlightContext } from "./chart/highlight";
import { SettingsButton } from "./SiteSettings";
import type { Snapshot } from "@/data/types";
import { chartVariantMode, computeIndex, PAGE_VIEW, DEFAULT_EFFORTS, EFFORT_CHOICES, filterEfforts, rankingRows as rankingRowsOf, type IndexConfig } from "@/engine";
import { ShareCards } from "./ShareCards";
import { encodeIndex, encodeIndices, decodeIndices, prettyQuery } from "@/lib/url";
import { aaIndexMix, PRIORS_MIX_COOKIE } from "@/onboarding/defaults";
import { compositeParts, latestAAIndex } from "@/data/aa-index";
import { benchmarkPath } from "@/lib/benchmark-slug";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { hiddenIds, toggleVisibility, SHOW_ALL, type Vis } from "@/lib/model-visibility";
import { WeightsPanel } from "./WeightsPanel";
import { Rankings } from "./Rankings";
import { ParetoChart } from "./chart/ParetoChart";
import { ChartPaletteContext, useChartPalette, useLabColor } from "./chart/echarts";
import { useBuilderSize } from "./builder-size";
import "./builder.css";
import { useScatterView } from "./chart/ScoreScatter";
import { Wordmark } from "./Wordmark";
import { SiteFooter } from "./SiteFooter";
import { SiteNav } from "./SiteNav";
import { IndexTabs } from "./IndexTabs";
import { REFERENCE_ID, REFERENCE_LABEL, indexNote, isAAWeights, isPristineDefault, restorable, withoutPristineDefault } from "@/lib/default-index";
import { CalculationSettings } from "./CalculationSettings";
import { ChartSettings } from "./chart/ChartSettings";
import { HeaderAuth } from "./HeaderAuth";
import { mergeImports } from "@/lib/import-merge";
import type { ImportPayload } from "@/lib/import";
import { SourceStatus } from "./SourceStatus";
import { effectiveBasis, planReadingSettings } from "@/data/subscription";
import { costDescription, hasSubscriptionPrices, taskMetricOptions } from "@/data/task-metrics";
import { formulaInputs } from "@/lib/metrics";
import { MetricGallery } from "./page/MetricGallery";
import { speedTierSettings, withSpeedTiers } from "@/data/speed-tiers";
import { freeTierSettings } from "@/data/free-tier";
import { threeDUrl } from "@/lib/compare-ref";
import { useTripleD } from "@/lib/use-triple-d";
import { useUndoable } from "@/lib/undoable";
import { useRemovalToast } from "./RemovalToast";
import { useNewModels } from "@/lib/seen-models";
import { usePhone } from "./builder-size";
import { leaving } from "./nav-progress";
import { VersionNotices, type BuilderNotices } from "./VersionNotices";
import { ownSavedIndices, upgradeIndex } from "@/lib/version-notices";

/** In the builder, version notices also cover the signed-in user's own page. */
const OWN_PAGE = {};
const restorableOwn = (list: IndexConfig[] | null) => list && restorable(list);

export function Builder({ snapshot: base, initialIndices }: { snapshot: Snapshot; initialIndices: IndexConfig[] }) {
  // Benchmarks imported in this browser (via /import without an account) are merged client-side.
  const router = useRouter();
  const [local, setLocal] = useState<ImportPayload[]>([]);
  useEffect(() => { const id = requestAnimationFrame(() => { try { setLocal(JSON.parse(localStorage.getItem("priors:imports") ?? "[]")); } catch { /* ignore */ } }); return () => cancelAnimationFrame(id); }, []);
  const [live, setLive] = useState({ base, snapshot: base });
  const sourceSnapshot = live.base === base ? live.snapshot : base;
  const receiveSnapshot = useCallback((s: Snapshot) => setLive({ base, snapshot: s }), [base]);
  const snapshot = useMemo(() => mergeImports(sourceSnapshot, local).snapshot, [sourceSnapshot, local]);
  // URL is the source of truth for anonymous builds; multiple `i` params = multiple indices.
  const { value: indices, set: setIndices, load: loadIndices, undo, canUndo } = useUndoable<IndexConfig[]>(() => (initialIndices.length ? withoutPristineDefault(initialIndices) : [aaIndexMix(base)]));
  // Restore the last edited indices when the URL carries none, and persist
  // edits so returning to /builder picks up where you left off.
  useEffect(() => {
    if (initialIndices.length) return;
    const id = requestAnimationFrame(() => {
      try { const saved = localStorage.getItem("priors:indices"); if (saved) { const list = restorable(decodeIndices(JSON.parse(saved) as string[])); if (list.length) loadIndices(list); } } catch { /* ignore */ }
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Version notices are about the visitor's own saved indices, read before this visit's first save replaces them.
  // A link that carries other indices (someone else's, or a fit fresh from the onboarding) gets none; neither does a first visit.
  const [own, setOwn] = useState<IndexConfig[] | null>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try { setOwn(restorableOwn(ownSavedIndices(JSON.parse(localStorage.getItem("priors:indices") ?? "[]") as string[], new URL(window.location.href).searchParams.getAll("i")))); } catch { /* storage blocked: no notices */ }
    });
    return () => cancelAnimationFrame(id);
  }, []);
  const notices = useMemo<BuilderNotices | null>(() => own && { indices: own, apply: (upgrades) => setIndices((list) => list.map((i) => upgrades.has(i.name) ? upgradeIndex(i, upgrades.get(i.name)!) : i)) }, [own, setIndices]);
  const [activeId, setActiveId] = useState(indices[0].id);
  const active = indices.find((i) => i.id === activeId) ?? indices[0];
  const benchName = useCallback((id: string) => snapshot.benchmarks.find((b) => b.id === id)?.name ?? id, [snapshot]);
  const { toast: removalToast, undo: undoEdit } = useRemovalToast(active, benchName, undo);
  useTripleD(active ? threeDUrl({ kind: "index", config: active }) : null);
  const resetsOn = usePlanResetsOn(), plansPref = useSubscriptionPlansPref();
  const result = useMemo(() => computeIndex(snapshot, { ...withPlansPref(withResetsPref(active, resetsOn), plansPref), variants: "all" }, PAGE_VIEW), [snapshot, active, resetsOn, plansPref]);
  const rankingMode = chartVariantMode(active, "ranking"), paretoMode = chartVariantMode(active, "pareto");
  const rankingRows = useMemo(() => rankingRowsOf(result.ranked, active), [result, active]);
  // The mix is the secondary thing: closed on AA's index, open once the weights are the visitor's own or they ask for it.
  const [mixChoice, setMixChoice] = useState<boolean | null>(null);
  const mixOpen = mixChoice ?? !isAAWeights(active);
  const pristine = indices.length === 1 && isPristineDefault(active);
  const openMix = () => { setMixChoice(true); if (window.matchMedia("(max-width: 1023.98px)").matches) requestAnimationFrame(() => document.getElementById("mix")?.scrollIntoView({ behavior: "smooth" })); };
  // AA's composite is one number, so Strengths draws the evaluations behind it.
  const strengths = useMemo(() => {
    const parts = compositeParts(snapshot, active.weights);
    if (!parts) return undefined;
    const config = { ...active, weights: parts, strictness: 100 }, r = computeIndex(snapshot, { ...withPlansPref(withResetsPref(config, resetsOn), plansPref), variants: "all" }, PAGE_VIEW);
    return { ranked: filterEfforts(r.ranked, active.efforts), benchmarks: r.benchmarks, config };
  }, [snapshot, active, resetsOn, plansPref]);
  // Settings-gear model picker: ranked models first (rank order), then the rest
  // of the candidate pool, then any excluded ids resolved from the catalog so
  // they can be re-checked.
  const labColor = useLabColor();
  const basePalette = useChartPalette(), size = useBuilderSize();
  const palette = useMemo(() => ({ ...basePalette, size }), [basePalette, size]);
  const pickerModels = useMemo(() => {
    const col = new Map(snapshot.labs.map((l) => [l.id, labColor(l.id, l.color)])), labName = new Map(snapshot.labs.map((l) => [l.id, l.name]));
    const seen = new Map<string, { id: string; name: string; color?: string; open?: boolean; lab?: string }>();
    const add = (id: string) => { if (!seen.has(id)) { const m = snapshot.models.find((x) => x.id === id); if (m) seen.set(id, { id, name: m.name, color: col.get(m.labId), open: m.openWeights, lab: labName.get(m.labId) }); } };
    for (const r of result.ranked) if (!seen.has(r.model.id)) seen.set(r.model.id, { id: r.model.id, name: r.model.name, color: col.get(r.model.labId), open: r.model.openWeights, lab: labName.get(r.model.labId) });
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
    if (active === edits.current.first || ++edits.current.count !== 4) return;
    const id = requestAnimationFrame(() => { try { if (!localStorage.getItem("priors:share-hint")) { localStorage.setItem("priors:share-hint", "1"); setShareHint(true); } } catch { /* ignore */ } });
    return () => cancelAnimationFrame(id);
  }, [active]);
  useEffect(() => {
    if (!shareHint) return;
    const off = setTimeout(() => setShareHint(false), 9000);
    return () => clearTimeout(off);
  }, [shareHint]);
  // One event per settled edit, not one per slider tick.
  useEffect(() => {
    if (active === edits.current.first) return;
    const t = setTimeout(() => track("index_changed", { benchmarks: Object.values(active.weights).filter((w) => w > 0).length }), 3000);
    return () => clearTimeout(t);
  }, [active]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey && !(e.target as HTMLElement)?.closest("input:not([type=range]),textarea,[contenteditable=true]")) { e.preventDefault(); undoEdit(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undoEdit]);
  const effortProps = { efforts: { value: active.efforts ?? DEFAULT_EFFORTS, onChange: (efforts: string[]) => update({ ...active, efforts }) } };
  const metricRanked = useMemo(() => filterEfforts(result.ranked, active.efforts), [result.ranked, active.efforts]);
  const metricEstimated = useMemo(() => filterEfforts(result.estimated, active.efforts), [result.estimated, active.efforts]);
  const tierPlans = withPlansPref(active, plansPref).subscriptionPlans;
  const costRanked = useMemo(() => withSpeedTiers(metricRanked, snapshot, active.speedTiers, tierPlans, { chart: "cost" }), [metricRanked, snapshot, active.speedTiers, tierPlans]);
  const speedRanked = useMemo(() => withSpeedTiers(metricRanked, snapshot, active.speedTiers, tierPlans, { chart: "speed" }), [metricRanked, snapshot, active.speedTiers, tierPlans]);
  const speedTiers = speedTierSettings(snapshot, active.speedTiers, (next) => update({ ...active, speedTiers: next }));
  const releaseProps = { releasedAfter: active.releasedAfter, onChangeReleased: (v: string) => update({ ...active, releasedAfter: v }) };

  // write URL (debounced) when indices change
  const t = useRef<number | null>(null);
  useEffect(() => {
    if (t.current) window.clearTimeout(t.current);
    t.current = window.setTimeout(() => {
      const p = encodeIndices([active, ...indices.filter((i) => i.id !== active.id)], true); const url = new URL(window.location.href);
      // The untouched default needs no state: the address stays mypriors.com, and a later visit gets whatever index is newest then.
      const plain = indices.length === 1 && isPristineDefault(active);
      url.searchParams.delete("i");
      if (!plain) p.getAll("i").forEach((value) => url.searchParams.append("i", value));
      url.searchParams.delete("date");
      url.search = prettyQuery(url.searchParams);
      if (!leaving()) window.history.replaceState(null, "", url.toString());
      try {
        if (plain) { localStorage.removeItem("priors:indices"); return; }
        localStorage.setItem("priors:indices", JSON.stringify(p.getAll("i")));
        const encoded = encodeIndex({ ...active, onlyModels: undefined, excludeModels: undefined });
        if (encoded.length <= 2048) document.cookie = `${PRIORS_MIX_COOKIE}=${encodeURIComponent(encoded)}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
      } catch { /* ignore */ }
    }, 150);
    return () => { if (t.current) window.clearTimeout(t.current); };
  }, [indices, active]);

  const update = useCallback((c: IndexConfig) => setIndices((list) => list.map((i) => (i.id === c.id ? c : i))), [setIndices]);
  const phone = usePhone(), fresh = useNewModels(snapshot.models);
  const mixEmpty = !Object.values(active.weights).some((w) => w > 0);
  const highlightState = useMemo(() => ({ items: active.highlight ?? [], set: (h: string[]) => update({ ...active, highlight: h.length ? h : undefined }), models: pickerModels, linkIndices: [active, ...indices.filter((i) => i.id !== active.id)], curated: active.excludeModels !== undefined || active.onlyModels !== undefined }), [active, indices, update, pickerModels]);
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
  // AA's index is one click away, as a reference to compare against, but not a tab nobody asked for.
  const addReference = () => { setIndices((l) => (l.some((i) => i.id === REFERENCE_ID) ? l : [...l, { ...aaIndexMix(snapshot), id: REFERENCE_ID }])); setActiveId(REFERENCE_ID); };
  const remove = (id: string) => { setIndices((l) => { const n = l.filter((i) => i.id !== id); if (!n.length) n.push(aaIndexMix(snapshot)); if (activeId === id) setActiveId(n[0].id); return n; }); };

  return (
    <ChartPaletteContext.Provider value={palette}>
    <div className="builder min-h-dvh">
      <header className="builder-header grid grid-cols-[auto_minmax(0,1fr)_auto] lg:flex items-center gap-x-4 gap-y-2 px-4 sm:px-8 py-2 lg:py-0 lg:h-14 border-b hairline lg:sticky top-0 bg-bone z-40">
        <div className="shrink-0 flex items-center gap-5"><Wordmark transitionTypes={["nav-back"]} /><span className="max-sm:hidden"><SiteNav current="builder" /></span></div>
        <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(mixOpen || indices.length > 1) && <IndexTabs indices={indices} activeId={active.id} onSelect={setActiveId} onRename={(id, name) => update({ ...indices.find((i) => i.id === id)!, name })} onAdd={add} onRemove={remove} />}
        </div>
        <div className="col-span-3 row-start-2 lg:w-auto lg:ml-auto flex flex-wrap items-center gap-2 shrink-0">
          <span className="sm:hidden mr-auto"><SiteNav current="builder" /></span>
          <span className="ml-auto flex items-center gap-2"><ShareCards indices={indices} active={active} top={topNames} hint={shareHint} onOpen={() => setShareHint(false)} /><HeaderAuth indices={indices} canPublish={!pristine} /></span>
        </div>
        <div className="col-start-3 row-start-1 shrink-0"><SettingsButton /></div>
      </header>

      <HighlightContext.Provider value={highlightState}>
      <main className={`builder-main grid grid-cols-1 ${mixOpen ? "lg:grid-cols-[360px_minmax(0,1fr)]" : "mix-closed"} gap-10 px-4 sm:px-8 pt-5 lg:pt-8 pb-8 max-w-[1500px] items-start`}>
        {/* Stays mounted while closed: the calculation settings hold the check for newer data. */}
        <aside id="mix" aria-label="Index controls" className={mixOpen ? "builder-aside scroll-mt-4 relative z-30 flex flex-col gap-5 min-h-0 lg:sticky lg:top-[88px] lg:h-[calc(100dvh-120px)]" : "contents"}>
          <section aria-label="Benchmarks and eligibility" className={mixOpen ? "min-h-0 min-w-0 lg:flex-1 lg:overflow-y-auto lg:overflow-x-hidden lg:overscroll-contain pr-2 pb-2" : "contents"}>
            {mixOpen && <>
            <div className="flex items-baseline justify-between gap-3 mb-1"><h2 className="text-[22px]">Your mix</h2><span className="flex items-baseline gap-3 text-[12px]"><button type="button" className="hit text-ink-2 hover:text-ink" onClick={() => setMixChoice(false)}>Hide</button>{canUndo && <button type="button" className="hit text-indigo hover:underline" onClick={undoEdit}>Undo</button>}{!mixEmpty && <button type="button" className="hit text-ink-2 hover:text-ink" onClick={() => update({ ...active, weights: {}, required: [], optional: undefined })}>Clear all</button>}</span></div>
            <p className="cap mb-1">{result.benchmarks.length} benchmark{result.benchmarks.length === 1 ? "" : "s"} · {new Set(result.ranked.map((r) => r.model.id)).size} models<span className="sm:hidden"> · data as of {snapshot.date}</span></p>
            {indices.length === 1 && !isAAWeights(active) && <button type="button" onClick={addReference} className="cap block underline underline-offset-2 mb-1">{REFERENCE_LABEL}</button>}
            {!isAAWeights(active) && indexNote(active, "yours") ? <p className="cap mb-4 text-ink-2">{indexNote(active, "yours")}</p> : <div className="mb-4" />}
            <WeightsPanel snapshot={snapshot} config={active} result={result} onChange={update} />
            <p className="cap mt-3">Or <Link href="/rank" className="underline underline-offset-2 hover:text-ink" transitionTypes={["nav-forward"]}>rank a few models</Link> and let Priors fit the weights.</p>
            </>}
            <CalculationSettings trigger={mixOpen} config={active} result={result} snapshot={snapshot} onChange={update}>
              <SourceStatus snapshot={sourceSnapshot} onSnapshot={receiveSnapshot} />
            </CalculationSettings>
          </section>
        </aside>

        {/* Keep the assistant clearance inside this column so the sidebar stays below the header at the page bottom. */}
        <section className="builder-charts grid gap-10 min-w-0 content-start pb-20 [&>div]:min-w-0">
          <div className="builder-rank">
            <Rankings anchor="rankings" imageTitle={active.name} fresh={fresh} empty={mixEmpty ? "Your mix is empty. Add a benchmark to rank models." : undefined} limit={phone ? 10 : 20} title={<h1 className="text-[26px] leading-tight">{active.name}</h1>} subtitle={<>
              <p className="cap">{isAAWeights(active) ? <>Scores as published by <Link href={benchmarkPath(latestAAIndex(snapshot)?.id ?? "") as "/"} className="underline underline-offset-2 hover:text-ink" transitionTypes={["nav-forward"]}>Artificial Analysis</Link></> : "Ranked by your mix"} · <span className="whitespace-nowrap">data as of {snapshot.date}</span></p>
              {!mixOpen && <p className="cap mt-1">Want your own ranking? <Link href="/rank" className="underline underline-offset-2 hover:text-ink" transitionTypes={["nav-forward"]}>Rank models</Link> or <button type="button" className="underline underline-offset-2 hover:text-ink" onClick={openMix}>change the mix</button>.</p>}</>} actions={<ChartSettings label="Ranking" efforts={{ value: active.rankingEfforts ?? [...EFFORT_CHOICES], onChange: (rankingEfforts) => update({ ...active, rankingEfforts }), withMode: true }} mode={rankingMode} onChange={(rankingVariants) => update({ ...active, rankingVariants })} {...releaseProps} {...modelPicker} />} onSelect={(r) => { if (r) router.push(`/models/${r.model.id}${isAAWeights(active) ? "?r=aa" : ""}` as "/", { transitionTypes: ["nav-forward"] }); }} ranked={rankingRows} labs={snapshot.labs} showEffort={rankingMode === "all"} />
          </div>
          <div className="builder-cost">
            <ParetoChart formulaInputs={formulaInputs(snapshot, result.ranked, active.timeSource)} basis={effectiveBasis(active.costBasis, hasSubscriptionPrices(snapshot))} description={costDescription(active.costSource ?? "aa", effectiveBasis(active.costBasis, hasSubscriptionPrices(snapshot)))} anchor="cost" ranked={costRanked} mode={paretoMode} labs={snapshot.labs} view={paretoView} onView={setParetoView} height={phone ? undefined : 620} title={<h2 className="text-[22px]">{effectiveBasis(active.costBasis, hasSubscriptionPrices(snapshot)) === "subscription" ? "Score vs subscription cost per task" : "Score vs cost per task"}</h2>}
              actions={(barModels) => <ChartSettings anchor="cost" defaultScale="log" dataSource={{ value: active.costSource ?? "aa", options: taskMetricOptions(snapshot, "cost"), onChange: (costSource) => update({ ...active, costSource }) }} costBasis={hasSubscriptionPrices(snapshot) ? { value: effectiveBasis(active.costBasis), onChange: (basis) => update({ ...active, costBasis: basis === "subscription" ? undefined : basis }) } : undefined} subscriptionPlans={planPicker(snapshot, active, plansPref, (subscriptionPlans) => update({ ...active, subscriptionPlans }))} planResets={{ value: withResetsPref(active, resetsOn).planResets === true, onChange: (on) => { setPlanResetsPref(on); update({ ...active, planResets: on ? true : undefined }); }, note: planResetNote(snapshot), rows: planResetRows(snapshot) }} freeTiers={freeTierSettings(snapshot, active.freeTiers, (freeTiers) => update({ ...active, freeTiers }))} planReading={planReadingSettings(snapshot, active.planReading, (planReading) => update({ ...active, planReading }))} speedTiers={speedTiers} label="Pareto" mode={paretoMode} onChange={(paretoVariants) => update({ ...active, paretoVariants })} view={paretoView} onView={setParetoView} {...releaseProps} {...effortProps} {...modelPicker} {...(barModels ?? {})} />} />
          </div>
          <div className="builder-more">
            <h2 className="text-[22px] mb-1">More metrics</h2>
            <MetricGallery tiers={{ ranked: speedRanked, settings: speedTiers }} timeSource={active.timeSource} onTimeSourceChange={(timeSource) => update({ ...active, timeSource })} ranked={metricRanked} estimated={metricEstimated} mode={paretoMode} snapshot={snapshot} labs={snapshot.labs} benchmarks={result.benchmarks} config={active} strengths={strengths} settings={{ ...releaseProps, ...effortProps, ...modelPicker }} />
          </div>
        </section>
        {removalToast}
      </main>
      <SiteFooter />
      </HighlightContext.Provider>
      <SharedChart highlight={active.highlight} onHighlight={(items) => update({ ...active, highlight: items.length ? items : undefined })} />
      <MixAssistant config={active} onApply={update} date={snapshot.date} />
      {notices && <VersionNotices benchmarks={snapshot.benchmarks} builder={notices} page={OWN_PAGE} />}
    </div>
    </ChartPaletteContext.Provider>
  );
}
