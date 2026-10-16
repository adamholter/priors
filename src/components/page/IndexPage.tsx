"use client";
import Link from "next/link";
import { HeaderAccount } from "@/components/AccountMenu";
import type { ProfileTheme, Section } from "../../../convex/validators";
import { MixAssistant } from "../MixAssistant";
import { ThemeToggle } from "../Theme";
import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Snapshot } from "@/data/types";
import { chartVariantMode, computeIndex, selectVariants, type IndexConfig } from "@/engine";
import { effectiveBasis } from "@/data/subscription";
import { costDescription, hasSubscriptionPrices, taskMetricOptions } from "@/data/task-metrics";
import { formulaInputs, pickPoints, speedChart } from "@/lib/metrics";
import { encodeIndices, PAGE_KEY, pageRef, prettyQuery } from "@/lib/url";
import { ShareCards } from "../ShareCards";
import { Wordmark } from "../Wordmark";
import { SiteNav } from "../SiteNav";
import { Rankings } from "../Rankings";
import { ParetoChart } from "../chart/ParetoChart";
import { toOwnerView, useScatterView, type OwnerView, type ScatterView } from "../chart/ScoreScatter";
import { SpeedChart } from "../chart/SpeedChart";
import { BenchmarkTable } from "./BenchmarkTable";
import { MetricGallery } from "./MetricGallery";
import { authEnabled } from "@/app/providers";
import { PageSettings } from "./PageEditor";
import { AddSection, Autosave, InlineText, OwnerProbe, PageTabs, SECTION_KINDS, SectionFrame, type SaveState } from "./PageEdit";
import { findTab, pageLayout, removeIndex, sectionTab, tabKey, tabSections } from "@/lib/page-layout";
import { ChartSettings } from "../chart/ChartSettings";
import { presetOf, presetStyle, resolveAccent, resolvePreset } from "@/lib/page-presets";
import { useTheme } from "../Theme";
import { hiddenIds, toggleVisibility, SHOW_ALL } from "@/lib/model-visibility";
import { anchorOf } from "../chart/ChartLink";
import { ChartPaletteContext, markColor, paletteFor } from "../chart/echarts";
import { HighlightContext } from "../chart/highlight";
import { setHighlightParams } from "@/lib/highlight-link";
import "./page-themes.css";
import { VIA_KEY } from "@/lib/share";

/** Stored shapes come from the Convex validators, so the page and the database can't disagree. */
export type { Section };
export interface Profile {
  _id: string; handle: string; displayName: string; avatarUrl?: string; bannerUrl?: string; bio?: string;
  socials?: { label: string; url: string }[]; indices: IndexConfig[]; sections: Section[];
  theme?: ProfileTheme;
  imports?: { benchmark: Snapshot["benchmarks"][0]; rows: import("@/data/types").RawRow[] }[];
}

export function IndexPage({ profile, snapshot, edit, tab: linkedTab, linkedHighlight, lab, onProfileChange }: { profile: Profile; snapshot: Snapshot; edit: boolean; /** The index a link opens on (`hi`: an id or a name slug). */ tab?: string; /** The id of the index whose selection came from the link (`hl`) rather than the saved page. */ linkedHighlight?: string; /** Lab preview: act as the owner, never save. */ lab?: boolean; /** Lab: mirror edits outward so the theme switcher keeps them. */ onProfileChange?: (p: Profile) => void }) {
  const [p, setPState] = useState(profile);
  const [prevProfile, setPrevProfile] = useState(profile);
  if (profile !== prevProfile) { setPrevProfile(profile); setPState(profile); }
  const setP = setPState;
  const results = useMemo(() => new Map(p.indices.map((i) => [i.id, computeIndex(snapshot, { ...i, variants: "all" })])), [snapshot, p.indices]);
  const { dark: siteDark } = useTheme();
  const preset = resolvePreset(p.theme, siteDark);
  // The visitor's light/dark toggle matters only when the theme has both versions and the owner didn't lock one.
  const followsSite = !!presetOf(p.theme).pair && p.theme?.mode !== "fixed";
  const accent = resolveAccent(p.theme, preset);
  const surface = preset.bg;
  // Dark schemes theme every chart: text, grid, marks, tooltips and exports follow the page palette.
  const palette = paletteFor(preset);
  const [origin, setOrigin] = useState("");
  useEffect(() => { const id = requestAnimationFrame(() => setOrigin(window.location.origin)); return () => cancelAnimationFrame(id); }, []);
  const [selected, setSelected] = useState<string | null>(null);
  // A page with several indices shows one at a time; the tab is the index everything below describes.
  const [tab, setTab] = useState(() => findTab(profile.indices, linkedTab)?.id);
  const active = p.indices.find((i) => i.id === tab) ?? p.indices[0];
  // The selection each index shows on a plain link, so a share link only spells out one that differs.
  const [savedHighlights] = useState(() => new Map(profile.indices.filter((i) => i.id !== linkedHighlight).map((i) => [i.id, (i.highlight ?? []).join(",")])));
  const activeResult = active ? results.get(active.id) : undefined;
  const openTab = (id: string) => {
    setTab(id); setSelected(null);
    const url = new URL(window.location.href);
    for (const key of ["hl", "c"]) url.searchParams.delete(key);
    const index = p.indices.find((i) => i.id === id);
    if (!index || index === p.indices[0]) url.searchParams.delete("hi"); else url.searchParams.set("hi", tabKey(p.indices, index));
    url.hash = "";
    window.history.replaceState(null, "", url.toString());
  };
  // The comparison a visitor carries away is with the page's first index, whichever tab is open.
  const firstIndex = p.indices[0];
  const firstResult = firstIndex ? results.get(firstIndex.id) : undefined;
  const topIds = useMemo(() => firstIndex && firstResult ? [...new Set(selectVariants(firstResult.ranked, chartVariantMode(firstIndex, "ranking")).map((r) => r.model.id))].slice(0, 20) : [], [firstIndex, firstResult]);
  const viaNames = useMemo(() => firstIndex && firstResult ? [...new Set(selectVariants(firstResult.ranked, chartVariantMode(firstIndex, "ranking")).map((r) => r.model.name))].slice(0, 5) : [], [firstIndex, firstResult]);
  const topNames = useMemo(() => active && activeResult ? [...new Set(selectVariants(activeResult.ranked, chartVariantMode(active, "ranking")).map((r) => r.model.name))].slice(0, 5) : [], [active, activeResult]);
  const footerMix = useMemo(() => activeResult ? [...activeResult.benchmarks].sort((a, b) => b.share - a.share).map((b) => ({ id: b.benchmark.id, name: b.benchmark.shortName ?? b.benchmark.name, share: b.share })) : [], [activeResult]);
  const [isOwner, setIsOwner] = useState(!!lab);
  const onOwner = useCallback((o: boolean) => setIsOwner(o || !!lab), [lab]);
  // For the owner, each index remembers the page index it came from, so saving from the builder updates that one
  // even after a rename. The key makes the reference good for this tab only (see FromPage); visitors get a plain link.
  const [pageKey] = useState(() => crypto.randomUUID().replace(/-/g, ""));
  const inBuilder = active ? [active, ...p.indices.filter((i) => i.id !== active.id)] : [];
  const builderHref = `/?${prettyQuery(encodeIndices(isOwner && !lab ? inBuilder.map((i) => ({ ...i, page: pageRef(p.handle, i.id, pageKey) })) : inBuilder, true))}`;
  const keepPageKey = () => { try { sessionStorage.setItem(PAGE_KEY, pageKey); } catch { /* storage can be disabled */ } };
  // The link people share: the bare page address unless it has to name another tab or a changed selection.
  const pageUrl = new URL(`${origin || "https://mypriors.com"}/${p.handle}`);
  if (active && active !== p.indices[0]) pageUrl.searchParams.set("hi", tabKey(p.indices, active));
  if (active && savedHighlights.get(active.id) !== (active.highlight ?? []).join(",")) pageUrl.searchParams.set("hl", (active.highlight ?? []).join(","));
  const footerSources = useMemo(() => [...new Set(snapshot.benchmarks.map((b) => b.sourceId))].sort(), [snapshot]);
  // Visitors see whose ranking this is and how to make their own; the owner, just after publishing, sees it went live.
  const [viewer, setViewer] = useState<{ owner: boolean; published: boolean } | null>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      let owner = false;
      try { owner = !!lab || localStorage.getItem("priors:handle") === p.handle; } catch { /* storage can be disabled */ }
      setViewer({ owner, published: owner && new URLSearchParams(window.location.search).get("published") === "1" });
      if (!owner && viaNames.length) try { localStorage.setItem(VIA_KEY, JSON.stringify({ handle: p.handle, name: p.displayName, top: viaNames, ids: topIds })); } catch { /* ignore */ }
    });
    return () => cancelAnimationFrame(id);
  }, [p.handle, p.displayName, viaNames, topIds, lab]);
  // Edit mode: the owner edits the page in place; changes autosave (lab previews never save).
  const [editing, setEditing] = useState(edit && !!lab);
  useEffect(() => { if (edit && isOwner) { const id = requestAnimationFrame(() => setEditing(true)); return () => cancelAnimationFrame(id); } }, [edit, isOwner]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [history, setHistory] = useState<Profile[]>([]);
  const change = useCallback((next: Profile) => { setHistory((h) => [...h.slice(-49), p]); setP(next); onProfileChange?.(next); }, [p, setP, onProfileChange]);
  const undo = useCallback(() => { if (!history.length) return; setP(history[history.length - 1]); setHistory(history.slice(0, -1)); }, [history, setP]);
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey && !(e.target as HTMLElement)?.closest("input,textarea")) { e.preventDefault(); undo(); } };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [editing, undo]);
  // Pages show some sections without saving them (see pageLayout); editing makes them real, movable sections.
  const pageSections = useMemo(() => pageLayout(p.indices, p.sections), [p.sections, p.indices]);
  const shownSections = tabSections(pageSections, p.indices, active?.id);
  const setSections = (sections: Section[]) => change({ ...p, sections });
  const patchSection = (id: string, patch: Partial<Section>) => setSections(pageSections.map((x) => x.id === id ? { ...x, ...patch } : x));
  const moveSection = (from: number, to: number) => { if (from === to || from < 0 || to < 0) return; const next = [...pageSections]; const [m] = next.splice(from, 1); next.splice(to, 0, m); setSections(next); };
  const addSection = (kind: Exclude<Section["kind"], "history">, at: number) => {
    const next = [...pageSections];
    // With several indices a new section belongs to the open tab; on a one-index page text and tables stay page-wide.
    next.splice(at, 0, { id: `${kind}-${crypto.randomUUID().slice(0, 8)}`, kind, ...(kind === "rankings" || kind === "pareto" || kind === "speed" || kind === "gallery" || p.indices.length > 1 ? { indexId: active?.id } : {}), ...(kind === "benchmark" ? { benchmarkId: activeResult?.benchmarks[0]?.benchmark.id } : {}) });
    setSections(next);
  };
  const patchIndex = (id: string, patch: Partial<IndexConfig>) => change({ ...p, indices: p.indices.map((i) => i.id === id ? { ...i, ...patch } : i) });
  const moveIndex = (id: string, by: number) => { const from = p.indices.findIndex((i) => i.id === id), to = from + by; if (from < 0 || to < 0 || to >= p.indices.length) return; const indices = [...p.indices]; indices.splice(to, 0, ...indices.splice(from, 1)); change({ ...p, indices }); };
  const dropIndex = (id: string) => { if (p.indices.length < 2) return; const next = removeIndex(p.indices, pageSections, id); change({ ...p, ...next }); setTab(next.indices[0].id); };
  const heading = (s: Section, fallback: string, className: string) => editing
    ? <h2 className={className}><InlineText editing label="Section title" value={s.title ?? ""} placeholder={fallback} onChange={(title) => patchSection(s.id, { title: title || undefined })} /></h2>
    : <h2 className={className}>{s.title ?? fallback}</h2>;
  // Owner-controlled theme: preset fields become scoped rules, `css` is a raw
  // stylesheet for their page. .page-root scopes everything to this page.
  const themeSerif = p.theme?.serif, themeMono = p.theme?.mono, themeCss = p.theme?.css;
  const customCss = useMemo(() => sanitizeCss([
    themeSerif ? `.page-root h1, .page-root h2, .page-root h3, .page-root .serif { font-family: ${themeSerif}, Newsreader, Georgia, serif; }` : "",
    themeMono ? `.page-root .mono, .page-root .num, .page-root code { font-family: ${themeMono}, "JetBrains Mono", Menlo, monospace; }` : "",
    themeCss ?? "",
  ].filter(Boolean).join("\n")), [themeSerif, themeMono, themeCss]);

  const renderSection = (s: Section): React.ReactNode => {
          const idx = p.indices.find((i) => i.id === sectionTab(s, p.indices));
          const r = idx ? results.get(idx.id) : undefined;
          const title = s.title ?? defaultTitle(s, idx?.name);
          if (s.kind === "text") return <section key={s.id} className="max-w-[68ch]">{(s.title || editing) && heading(s, "Title (optional)", "text-[21px] sm:text-[24px] mb-3")}{editing ? <InlineText editing multiline label="Text" value={s.body ?? ""} placeholder="Write something." className="text-[15.5px] leading-[1.7] w-full" onChange={(body) => patchSection(s.id, { body })} /> : <p className="text-[15.5px] leading-[1.7] text-ink-2 whitespace-pre-wrap">{s.body}</p>}</section>;
          if (s.kind === "links") return <section key={s.id}>{heading(s, title, "text-[21px] sm:text-[24px] mb-3")}{editing ? <InlineText editing multiline label="Links, one per line: label then URL" value={(s.links ?? []).map((l) => `${l.label} ${l.url}`).join("\n")} placeholder="My blog https://example.com" className="text-[14px] w-full" onChange={(v) => patchSection(s.id, { links: parseLinks(v) })} /> : <ul className="grid gap-1.5 text-[14px]">{s.links?.map((l) => <li key={l.url}><a href={l.url} target="_blank" rel="noreferrer" style={{ color: accent }}>{l.label}</a></li>)}</ul>}</section>;
          if (s.kind === "benchmark") return (s.benchmarkId || editing) ? <section key={s.id} className="chart-panel">{heading(s, title, "text-[21px] sm:text-[24px] mb-3")}{editing && <select className="inp mb-3" aria-label="Benchmark" value={s.benchmarkId ?? ""} onChange={(e) => patchSection(s.id, { benchmarkId: e.target.value || undefined })}><option value="">Choose a benchmark</option>{snapshot.benchmarks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}{s.benchmarkId && <BenchmarkTable snapshot={snapshot} benchmarkId={s.benchmarkId} />}</section> : null;
          if (!idx || !r) return null;
          const rankingMode = chartVariantMode(idx, "ranking"), paretoMode = chartVariantMode(idx, "pareto");
          // While editing, index tweaks (effort mode, filters, hidden models, highlights) are page edits; otherwise they stay local to this visit.
          const updateIndex = (patch: Partial<IndexConfig>) => (editing ? change : setP)({ ...p, indices: p.indices.map((i) => i.id === idx.id ? { ...i, ...patch } : i) });
          const pickerModels = (() => {
            const col = new Map(snapshot.labs.map((l) => [l.id, markColor(l.color, palette, l.id)]));
            const seen = new Map<string, { id: string; name: string; color?: string; open?: boolean }>();
            const add = (id: string) => { if (!seen.has(id)) { const m = snapshot.models.find((x) => x.id === id); if (m) seen.set(id, { id, name: m.name, color: col.get(m.labId), open: m.openWeights }); } };
            for (const v of r.ranked) if (!seen.has(v.model.id)) seen.set(v.model.id, { id: v.model.id, name: v.model.name, color: col.get(v.model.labId), open: v.model.openWeights });
            for (const id of r.candidateModelIds) add(id);
            for (const id of idx.excludeModels ?? []) add(id);
            return [...seen.values()];
          })();
          const pickerIds = pickerModels.map((m) => m.id);
          const excludedIds = hiddenIds(idx, pickerIds);
          const toggleModel = (id: string) => updateIndex(toggleVisibility(idx, id, pickerIds));
          const modelPicker = { models: pickerModels, excluded: excludedIds, onToggleModel: toggleModel, onShowAllModels: () => updateIndex(SHOW_ALL), onHideAllModels: () => updateIndex({ excludeModels: pickerIds, onlyModels: undefined }), onShowOnly: (ids: string[]) => updateIndex({ excludeModels: pickerIds.filter((id) => !ids.includes(id)), onlyModels: undefined }) };
          const wrap = (el: React.ReactNode) => <HighlightContext.Provider key={s.id} value={{ items: idx.highlight ?? [], indexId: tabKey(p.indices, idx), set: (h) => {
            updateIndex({ highlight: h.length ? h : undefined });
            window.history.replaceState(null, "", setHighlightParams(new URL(window.location.href), tabKey(p.indices, idx), h).toString());
          }, models: pickerModels }}>{el}</HighlightContext.Provider>;
          if (s.kind === "gallery") return wrap(<section key={s.id} className="chart-panel">{heading(s, title, "text-[21px] sm:text-[24px] mb-1")}{!editing && <p className="cap mb-3">More metrics · expand a row</p>}<MetricGallery layout={s.metrics} editing={editing} onLayout={(metrics) => patchSection(s.id, { metrics })} timeSource={idx.timeSource} onTimeSourceChange={(timeSource) => updateIndex({ timeSource })} ranked={r.ranked} mode={paretoMode} snapshot={snapshot} labs={snapshot.labs} benchmarks={r.benchmarks} config={idx} settings={{ releasedAfter: idx.releasedAfter, onChangeReleased: (v) => updateIndex({ releasedAfter: v }), ...modelPicker }} /></section>);
          const settings = (label: string, mode: "all" | "best", key: "rankingVariants" | "paretoVariants") => <ChartSettings label={label} mode={mode} onChange={(v) => updateIndex({ [key]: v })} releasedAfter={idx.releasedAfter} onChangeReleased={(v) => updateIndex({ releasedAfter: v })} models={pickerModels} excluded={excludedIds} onToggleModel={toggleModel} onShowAllModels={() => updateIndex(SHOW_ALL)} onHideAllModels={() => updateIndex({ excludeModels: pickerIds, onlyModels: undefined })} onShowOnly={modelPicker.onShowOnly} />;
          if (s.kind === "rankings") return wrap(
            <section key={s.id} className="chart-panel">
              <Rankings anchor={anchorOf(title)} title={heading(s, title, "text-[21px] sm:text-[24px]")} actions={settings("Ranking", rankingMode, "rankingVariants")} ranked={selectVariants(r.ranked, rankingMode)} showEffort={rankingMode === "all"} labs={snapshot.labs} limit={25} selected={selected} onSelect={(x) => setSelected(x?.variant.id ?? null)} />
            </section>
          );
          if (s.kind === "pareto") return wrap(<section key={s.id} className="chart-panel"><WithView id={`pareto-${s.id}`} owner={s.view} onOwner={editing ? (view) => patchSection(s.id, { view }) : undefined}>{(paretoView, setParetoView) => <ParetoChart formulaInputs={formulaInputs(snapshot, r.ranked, idx.timeSource)} basis={effectiveBasis(idx.costBasis, hasSubscriptionPrices(snapshot))} description={costDescription(idx.costSource ?? "aa", effectiveBasis(idx.costBasis, hasSubscriptionPrices(snapshot)))} anchor={anchorOf(title)} ranked={r.ranked} mode={paretoMode} labs={snapshot.labs} height={440} view={paretoView} onView={setParetoView} title={heading(s, title, "text-[21px] sm:text-[24px]")} actions={(barModels) => {
            const models = barModels?.models ?? pickerModels, excluded = barModels?.excluded ?? excludedIds;
            const onToggleModel = barModels?.onToggleModel ?? toggleModel;
            const onShowAllModels = barModels?.onShowAllModels ?? (() => updateIndex(SHOW_ALL));
            const onHideAllModels = barModels?.onHideAllModels ?? (() => updateIndex({ excludeModels: pickerIds, onlyModels: undefined }));
            return <ChartSettings anchor={anchorOf(title)} defaultScale={barModels ? barModels.defaultScale : "log"} formula={barModels?.formula} dataSource={{ value: idx.costSource ?? "aa", options: taskMetricOptions(snapshot, "cost"), onChange: (costSource) => updateIndex({ costSource }) }} costBasis={hasSubscriptionPrices(snapshot) ? { value: effectiveBasis(idx.costBasis), onChange: (basis) => updateIndex({ costBasis: basis === "subscription" ? undefined : basis }) } : undefined} label="Pareto" mode={paretoMode} onChange={(v) => updateIndex({ paretoVariants: v })} view={paretoView} onView={setParetoView} releasedAfter={idx.releasedAfter} onChangeReleased={(v) => updateIndex({ releasedAfter: v })} models={models} excluded={excluded} onToggleModel={onToggleModel} onShowAllModels={onShowAllModels} onHideAllModels={onHideAllModels} />;
          }} />}</WithView></section>);
          if (s.kind === "speed") return wrap(<section key={s.id} className="chart-panel"><WithView id={`speed-${s.id}`} owner={s.view} onOwner={editing ? (view) => patchSection(s.id, { view }) : undefined}>{(speedView, setSpeedView) => <SpeedChart onView={setSpeedView} anchor={anchorOf(title)} pts={pickPoints(speedChart, r.ranked, paretoMode)} labs={snapshot.labs} view={speedView} title={heading(s, title, "text-[21px] sm:text-[24px]")} actions={<ChartSettings anchor={anchorOf(title)} label="Speed" mode={paretoMode} onChange={(v) => updateIndex({ paretoVariants: v })} view={speedView} onView={setSpeedView} releasedAfter={idx.releasedAfter} onChangeReleased={(v) => updateIndex({ releasedAfter: v })} {...modelPicker} />} />}</WithView></section>);
          return null;
  };
  return (
    <ChartPaletteContext.Provider value={palette}>
    <div className={`page-root min-h-screen ${editing ? "is-editing" : ""}`} data-dark={preset.dark || undefined} data-family={preset.family ?? "priors"} style={presetStyle(preset, accent) as React.CSSProperties}>
      {customCss && <style>{customCss}</style>}
      {/* Phones: one short row that scrolls away — logo, share, and a menu for the rest. */}
      <header className="flex items-center gap-x-6 gap-y-2 px-4 sm:px-8 h-12 sm:h-auto sm:min-h-14 sm:py-2 border-b hairline sm:sticky top-0 z-10" style={{ background: surface + "E6", backdropFilter: "blur(8px)" }}>
        <Wordmark />
        <span className="text-grey text-[13px] max-sm:hidden">/ {p.handle}</span>
        <span className="max-sm:hidden"><SiteNav /></span>
        <div className="ml-auto hidden sm:flex flex-wrap items-center justify-end gap-3">
          {active && <ShareCards indices={p.indices} active={active} profile={p} pageUrl={pageUrl.toString()} defaultDesign={p.theme?.cardDesign} top={topNames} pageTheme={p.theme?.preset} />}
          <Link href={builderHref as "/"} onClick={keepPageKey} className="btn-quiet">Open in builder</Link>
          {isOwner && <button type="button" className="btn" onClick={() => setEditing(!editing)}>{editing ? "Done editing" : "Edit page"}</button>}
          <HeaderAccount />
          {followsSite && <ThemeToggle />}
        </div>
        <div className="ml-auto flex sm:hidden items-center gap-1">
          {active && <ShareCards compact indices={p.indices} active={active} profile={p} pageUrl={pageUrl.toString()} defaultDesign={p.theme?.cardDesign} top={topNames} pageTheme={p.theme?.preset} />}
          {followsSite && <ThemeToggle />}
          <MobileMenu>
            <Link href={builderHref as "/"} onClick={keepPageKey} className="btn-quiet text-center">Open in builder</Link>
            <Link href="/explore" className="btn-quiet text-center">Explore rankings</Link>
            <Link href="/rank" className="btn-quiet text-center">Rank models</Link>
            {isOwner && <button type="button" className="btn text-center" onClick={() => setEditing(!editing)}>{editing ? "Done editing" : "Edit page"}</button>}
          </MobileMenu>
        </div>
      </header>
      {authEnabled && !lab && <OwnerProbe handle={p.handle} onOwner={onOwner} />}
      {editing && !lab && <Autosave profile={p} onState={setSaveState} />}
      {editing && <div className="edit-bar" role="region" aria-label="Editing your page">
        <span className="edit-bar-title">Editing your page</span>
        <span className="edit-bar-status" role="status">{lab ? "Lab preview · not saved" : saveState === "saving" ? "Saving…" : saveState === "dirty" ? "Unsaved changes" : saveState === "error" ? "Couldn’t save. Retrying on your next change." : "All changes saved"}</span>
        <button type="button" className="btn-quiet" disabled={!history.length} onClick={undo}>Undo</button>
        <button type="button" className="btn-quiet" onClick={() => setSettingsOpen(true)}>Theme & settings</button>
        <button type="button" className="btn" onClick={() => { setEditing(false); setSettingsOpen(false); }}>Done</button>
      </div>}
      <PageSettings profile={p} set={(patch) => change({ ...p, ...patch })} open={editing && settingsOpen} onClose={() => setSettingsOpen(false)} lab={lab} />

      {viewer && !viewer.owner && !edit && <div className="border-b hairline px-4 sm:px-8 py-2.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[13px]" style={{ background: surface }}>
        <span className="text-ink-2">This is <span className="text-ink">{p.displayName}</span>’s ranking of AI models. What’s yours?</span>
        <Link href="/rank" className="btn !py-1 !text-[12.5px]">Rank models · 1 min</Link>
      </div>}
      {viewer?.published && <div className="border-b hairline px-4 sm:px-8 py-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[13px]" style={{ background: surface }} role="status">
        <span><span className="text-ink">Your page is live</span> <span className="text-ink-2">at mypriors.com/{p.handle} and listed on Explore.</span></span>
        {active && <ShareCards indices={p.indices} active={active} profile={p} pageUrl={pageUrl.toString()} defaultDesign={p.theme?.cardDesign} top={topNames} pageTheme={p.theme?.preset} />}
        <Link href={`/${p.handle}?edit=1` as "/"} className="btn-quiet">Customize page</Link>
        <Link href="/explore" className="btn-quiet">See Explore</Link>
      </div>}
      {p.bannerUrl && <div className="page-banner-frame"><img src={p.bannerUrl} alt="" className="page-banner" /></div>}
      <main className={`max-w-[1100px] mx-auto px-5 sm:px-8 grid gap-10 sm:gap-14 ${p.bannerUrl ? "pb-12" : "py-8 sm:py-12"}`}>
        <section className={`flex items-start gap-4 sm:gap-5 ${p.bannerUrl ? "-mt-8 sm:-mt-10" : ""}`}>
          {p.avatarUrl ? <img src={p.avatarUrl} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shrink-0" style={{ boxShadow: `0 0 0 4px ${surface}` }} /> : <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-hair-2 grid place-items-center serif text-3xl text-ink-2 shrink-0" style={{ boxShadow: `0 0 0 4px ${surface}` }}>{p.displayName[0]}</div>}
          <div className={`grid gap-1 sm:gap-1.5 min-w-0 ${p.bannerUrl ? "pt-9 sm:pt-11" : ""}`}>
            <h1 className="text-[28px] sm:text-[34px] leading-tight">{editing ? <InlineText editing label="Your name" value={p.displayName} onChange={(displayName) => change({ ...p, displayName })} /> : p.displayName}</h1>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[13px] text-ink-2">
              <span className="mono text-grey">mypriors.com/{p.handle}</span>
              {p.socials?.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="hover:text-ink" style={{ color: accent }}>{s.label}</a>)}
            </div>
            {editing ? <InlineText editing multiline label="Bio" value={p.bio ?? ""} placeholder="A sentence or two about how you pick models." className="text-[15px] text-ink-2 w-[min(62ch,78vw)] mt-1" onChange={(bio) => change({ ...p, bio: bio || undefined })} /> : p.bio && <p className="text-[15px] text-ink-2 max-w-[62ch] mt-1">{p.bio}</p>}
          </div>
        </section>

        {p.indices.length > 1 && active && <PageTabs indices={p.indices} activeId={active.id} accent={accent} editing={editing} onSelect={openTab} onRename={(id, name) => patchIndex(id, { name })} onMove={moveIndex} onRemove={dropIndex} />}

        {shownSections.filter((s) => editing || !s.hidden).map((s, i, list) => {
          const el = renderSection(s);
          if (!editing) return el;
          const at = pageSections.indexOf(s);
          return <Fragment key={s.id}>
            <AddSection onAdd={(kind) => addSection(kind, at)} />
            <SectionFrame section={s} index={i} count={list.length} label={SECTION_KINDS.find((k) => k.kind === s.kind)?.label ?? s.kind}
              onMove={(to) => moveSection(at, pageSections.indexOf(list[to]))} onDrop={(from) => moveSection(pageSections.indexOf(list[from]), at)}
              onPatch={(change) => patchSection(s.id, change)} onRemove={() => setSections(pageSections.filter((x) => x.id !== s.id))}>
              {el ?? <p className="cap py-6">Nothing to show for this section yet.</p>}
            </SectionFrame>
          </Fragment>;
        })}
        {editing && <AddSection onAdd={(kind) => addSection(kind, pageSections.length)} />}

        {/* Bottom padding clears the fixed assistant composer so nothing here sits under it. */}
        <footer className="border-t hairline pt-8 pb-28 grid gap-6">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div className="grid gap-1 min-w-0">
              <p className="text-[16px] text-ink">{viewer?.owner ? "Try a different take" : "What would your ranking look like?"}</p>
              <p className="text-[13px] text-ink-2 max-w-[56ch]">Rank a few models head to head and Priors finds the benchmark mix that agrees with you. About a minute, no sign-in.</p>
            </div>
            <Link href="/rank" className="btn shrink-0">Build your own</Link>
          </div>
          {footerMix.length > 0 && <div className="grid gap-2 min-w-0">
            <p className="cap">{active?.name ?? "This index"} · {footerMix.length} benchmark{footerMix.length === 1 ? "" : "s"}</p>
            <ul className="flex flex-wrap gap-1.5">{footerMix.map((b) => <li key={b.id} className="text-[12px] border hairline rounded-sm px-2 py-0.5 text-ink-2"><span className="text-ink">{b.name}</span> <span className="num">{Math.round(b.share)}%</span></li>)}</ul>
          </div>}
          <details className="text-[12px] text-grey">
            <summary className="cursor-pointer hover:text-ink w-fit">Data as of {snapshot.date} · {footerSources.length} sources</summary>
            <p className="mt-2 leading-relaxed max-w-[110ch]">{footerSources.join(" · ")}</p>
          </details>
        </footer>
      </main>
      {active && <MixAssistant config={active} date={snapshot.date} handle={p.handle} onApply={(next) => setP({ ...p, indices: p.indices.map((x) => x.id === next.id ? next : x) })} />}
    </div>
    </ChartPaletteContext.Provider>
  );
}

/** Three-dots menu. Content stays mounted while closed so the editor keeps its state and drawer. */
function MobileMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent | KeyboardEvent) => { if (e instanceof KeyboardEvent ? e.key === "Escape" : !(e.target as HTMLElement).closest(".mobile-menu, .page-editor, dialog")) setOpen(false); };
    addEventListener("pointerdown", close); addEventListener("keydown", close);
    return () => { removeEventListener("pointerdown", close); removeEventListener("keydown", close); };
  }, [open]);
  return <div className="mobile-menu relative">
    <button type="button" className="icon-btn" aria-label="More" aria-expanded={open} onClick={() => setOpen(!open)}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg></button>
    <div className={`${open ? "grid" : "hidden"} absolute right-0 top-full mt-1.5 w-56 gap-2 p-3 bg-white border hairline rounded-md shadow-[0_18px_40px_-18px_var(--shadow)] z-30 [&>*]:w-full`} role="menu" onClick={(e) => { if ((e.target as HTMLElement).closest("a,button")) setOpen(false); }}>{children}</div>
  </div>;
}

/** Owner CSS: their page, their rules — but block style-tag breakout and JS URLs. */
function sanitizeCss(css: string) {
  return css.replace(/<\//g, "<\\/").replace(/expression\s*\(|javascript\s*:/gi, "blocked").slice(0, 10_000);
}

function defaultTitle(s: Section, indexName?: string) {
  switch (s.kind) {
    case "rankings": return indexName ?? "Rankings";
    case "pareto": return `${indexName ?? "Score"} vs cost per task`;
    case "speed": return `${indexName ?? "Score"} vs speed`;
    case "gallery": return "More metrics";
    case "benchmark": return "Benchmark";
    case "links": return "Links";
    default: return "";
  }
}

/** Per-section chart view: the owner's default for visitors, edited in place while the owner edits. */
function WithView({ id, owner, onOwner, children }: { id: string; owner?: OwnerView; onOwner?: (v: OwnerView) => void; children: (view: ScatterView, setView: (v: ScatterView) => void) => ReactNode }) {
  const [view, setView] = useScatterView(`page-${id}`, "scatter", true, owner, onOwner ? (v) => onOwner(toOwnerView(v)) : undefined);
  return <>{children(view, setView)}</>;
}

/** "Label URL" per line; a bare URL is its own label. */
function parseLinks(text: string) {
  return text.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => { const parts = line.split(/\s+/); const url = parts.pop()!; return { label: parts.join(" ") || url, url }; });
}
