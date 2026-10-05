"use client";
import Link from "next/link";
import type { ProfileTheme, Section } from "../../../convex/validators";
import { MixAssistant } from "../MixAssistant";
import { ThemeToggle } from "../Theme";
import { useEffect, useMemo, useState } from "react";
import type { Snapshot } from "@/data/types";
import { chartVariantMode, computeIndex, selectVariants, type IndexConfig } from "@/engine";
import { taskMetricOptions, taskMetricDescription } from "@/data/task-metrics";
import { pickPoints, speedChart } from "@/lib/metrics";
import { encodeIndices } from "@/lib/url";
import { ShareCards } from "../ShareCards";
import { Wordmark } from "../Wordmark";
import { Rankings } from "../Rankings";
import { ParetoChart } from "../chart/ParetoChart";
import { useScatterView } from "../chart/ScoreScatter";
import { SpeedChart } from "../chart/SpeedChart";
import { BenchmarkTable } from "./BenchmarkTable";
import { DatePicker } from "../DatePicker";
import { MetricGallery } from "./MetricGallery";
import { authEnabled } from "@/app/providers";
import { PageEditor } from "./PageEditor";
import { ChartSettings } from "../chart/ChartSettings";
import { presetOf, presetStyle, resolveAccent, resolvePreset } from "@/lib/page-presets";
import { useTheme } from "../Theme";
import { hiddenIds, toggleVisibility, SHOW_ALL } from "@/lib/model-visibility";
import { anchorOf } from "../chart/ChartLink";
import { ChartPaletteContext, markColor, paletteFor } from "../chart/echarts";
import { HighlightContext } from "../chart/highlight";
import { setHighlightParams } from "@/lib/highlight-link";

/** Stored shapes come from the Convex validators, so the page and the database can't disagree. */
export type { Section };
export interface Profile {
  _id: string; handle: string; displayName: string; avatarUrl?: string; bannerUrl?: string; bio?: string;
  socials?: { label: string; url: string }[]; indices: IndexConfig[]; sections: Section[];
  theme?: ProfileTheme;
  imports?: { benchmark: Snapshot["benchmarks"][0]; rows: import("@/data/types").RawRow[] }[];
}

export function IndexPage({ profile, snapshot, dates, edit }: { profile: Profile; snapshot: Snapshot; dates: string[]; edit: boolean }) {
  const [p, setPState] = useState(profile);
  const [prevProfile, setPrevProfile] = useState(profile);
  if (profile !== prevProfile) { setPrevProfile(profile); setPState(profile); }
  const setP = setPState;
  const results = useMemo(() => new Map(p.indices.map((i) => [i.id, computeIndex(snapshot, { ...i, variants: "all" })])), [snapshot, p.indices]);
  const { dark: siteDark } = useTheme();
  const preset = resolvePreset(p.theme, siteDark);
  const followsSite = presetOf(p.theme).id === "bone";
  const accent = resolveAccent(p.theme, preset);
  const surface = preset.bg;
  // Dark schemes theme every chart: text, grid, marks, tooltips and exports follow the page palette.
  const palette = paletteFor(preset);
  const [origin, setOrigin] = useState("");
  useEffect(() => { const id = requestAnimationFrame(() => setOrigin(window.location.origin)); return () => cancelAnimationFrame(id); }, []);
  const builderHref = `/?${encodeIndices(p.indices).toString()}`;
  const pageUrl = new URL(`${origin || "https://mypriors.com"}/${p.handle}`);
  if (p.indices[0]) setHighlightParams(pageUrl, p.indices[0].id, p.indices[0].highlight ?? []);
  const [selected, setSelected] = useState<string | null>(null);
  const [paretoView, setParetoView] = useScatterView("page-pareto");
  const [speedView, setSpeedView] = useScatterView("page-speed");
  // Owner-controlled theme: preset fields become scoped rules, `css` is a raw
  // stylesheet for their page. .page-root scopes everything to this page.
  const themeSerif = p.theme?.serif, themeMono = p.theme?.mono, themeCss = p.theme?.css;
  const customCss = useMemo(() => sanitizeCss([
    themeSerif ? `.page-root h1, .page-root h2, .page-root h3, .page-root .serif { font-family: ${themeSerif}, Newsreader, Georgia, serif; }` : "",
    themeMono ? `.page-root .mono, .page-root .num, .page-root code { font-family: ${themeMono}, "JetBrains Mono", Menlo, monospace; }` : "",
    themeCss ?? "",
  ].filter(Boolean).join("\n")), [themeSerif, themeMono, themeCss]);

  return (
    <ChartPaletteContext.Provider value={palette}>
    <div className="page-root min-h-screen" data-dark={preset.dark || undefined} style={presetStyle(preset, accent) as React.CSSProperties}>
      {customCss && <style>{customCss}</style>}
      {/* Phones: one short row that scrolls away — logo, share, and a menu for the rest. */}
      <header className="flex items-center gap-x-6 gap-y-2 px-4 sm:px-8 h-12 sm:h-auto sm:min-h-14 sm:py-2 border-b hairline sm:sticky top-0 z-10" style={{ background: surface + "E6", backdropFilter: "blur(8px)" }}>
        <Wordmark />
        <span className="text-grey text-[13px] max-sm:hidden">/ {p.handle}</span>
        <div className="ml-auto hidden sm:flex flex-wrap items-center justify-end gap-3">
          <DatePicker current={snapshot.date} dates={dates} />
          {p.indices[0] && <ShareCards indices={p.indices} active={p.indices[0]} date={snapshot.date} profile={p} pageUrl={pageUrl.toString()} defaultDesign={p.theme?.cardDesign} />}
          <Link href={builderHref as "/"} className="btn-quiet">Open in builder</Link>
          {authEnabled && <PageEditor profile={p} onChange={setP} snapshot={snapshot} editing={edit} />}
          {followsSite && <ThemeToggle />}
        </div>
        <div className="ml-auto flex sm:hidden items-center gap-1">
          {p.indices[0] && <ShareCards compact indices={p.indices} active={p.indices[0]} date={snapshot.date} profile={p} pageUrl={pageUrl.toString()} defaultDesign={p.theme?.cardDesign} />}
          {followsSite && <ThemeToggle />}
          <MobileMenu>
            <DatePicker current={snapshot.date} dates={dates} />
            <Link href={builderHref as "/"} className="btn-quiet text-center">Open in builder</Link>
            {authEnabled && <PageEditor profile={p} onChange={setP} snapshot={snapshot} editing={false} />}
          </MobileMenu>
        </div>
      </header>

      {p.bannerUrl && <div className="page-banner-frame"><img src={p.bannerUrl} alt="" className="page-banner" /></div>}
      <main className={`max-w-[1100px] mx-auto px-5 sm:px-8 grid gap-10 sm:gap-14 ${p.bannerUrl ? "pb-12" : "py-8 sm:py-12"}`}>
        <section className={`flex items-start gap-4 sm:gap-5 ${p.bannerUrl ? "-mt-8 sm:-mt-10" : ""}`}>
          {p.avatarUrl ? <img src={p.avatarUrl} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shrink-0" style={{ boxShadow: `0 0 0 4px ${surface}` }} /> : <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-hair-2 grid place-items-center serif text-3xl text-ink-2 shrink-0" style={{ boxShadow: `0 0 0 4px ${surface}` }}>{p.displayName[0]}</div>}
          <div className={`grid gap-1 sm:gap-1.5 min-w-0 ${p.bannerUrl ? "pt-9 sm:pt-11" : ""}`}>
            <h1 className="text-[28px] sm:text-[34px] leading-tight">{p.displayName}</h1>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[13px] text-ink-2">
              <span className="mono text-grey">mypriors.com/{p.handle}</span>
              {p.socials?.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="hover:text-ink" style={{ color: accent }}>{s.label}</a>)}
            </div>
            {p.bio && <p className="text-[15px] text-ink-2 max-w-[62ch] mt-1">{p.bio}</p>}
          </div>
        </section>

        {(p.sections.some((s) => s.kind === "gallery") ? p.sections : [...p.sections, { id: "gallery-auto", kind: "gallery" as const, indexId: p.indices[0]?.id }]).filter((s) => !s.hidden).map((s) => {
          const idx = (s.indexId ? p.indices.find((i) => i.id === s.indexId) : undefined) ?? (s.kind === "gallery" ? p.indices[0] : undefined);
          const r = idx ? results.get(idx.id) : undefined;
          const title = s.title ?? defaultTitle(s, idx?.name);
          if (s.kind === "text") return <section key={s.id} className="max-w-[68ch]">{s.title && <h2 className="text-[21px] sm:text-[24px] mb-3">{s.title}</h2>}<p className="text-[15.5px] leading-[1.7] text-ink-2 whitespace-pre-wrap">{s.body}</p></section>;
          if (s.kind === "links") return <section key={s.id}>{title && <h2 className="text-[21px] sm:text-[24px] mb-3">{title}</h2>}<ul className="grid gap-1.5 text-[14px]">{s.links?.map((l) => <li key={l.url}><a href={l.url} target="_blank" rel="noreferrer" style={{ color: accent }}>{l.label}</a></li>)}</ul></section>;
          if (s.kind === "benchmark" && s.benchmarkId) return <section key={s.id} className="chart-panel"><h2 className="text-[21px] sm:text-[24px] mb-3">{title}</h2><BenchmarkTable snapshot={snapshot} benchmarkId={s.benchmarkId} /></section>;
          if (!idx || !r) return null;
          const rankingMode = chartVariantMode(idx, "ranking"), paretoMode = chartVariantMode(idx, "pareto");
          const updateIndex = (patch: Partial<IndexConfig>) => setP({ ...p, indices: p.indices.map((i) => i.id === idx.id ? { ...i, ...patch } : i) });
          const pickerModels = (() => {
            const col = new Map(snapshot.labs.map((l) => [l.id, markColor(l.color, palette, l.id)]));
            const seen = new Map<string, { id: string; name: string; color?: string }>();
            const add = (id: string) => { if (!seen.has(id)) { const m = snapshot.models.find((x) => x.id === id); if (m) seen.set(id, { id, name: m.name, color: col.get(m.labId) }); } };
            for (const v of r.ranked) if (!seen.has(v.model.id)) seen.set(v.model.id, { id: v.model.id, name: v.model.name, color: col.get(v.model.labId) });
            for (const id of r.candidateModelIds) add(id);
            for (const id of idx.excludeModels ?? []) add(id);
            return [...seen.values()];
          })();
          const pickerIds = pickerModels.map((m) => m.id);
          const excludedIds = hiddenIds(idx, pickerIds);
          const toggleModel = (id: string) => updateIndex(toggleVisibility(idx, id, pickerIds));
          const modelPicker = { models: pickerModels, excluded: excludedIds, onToggleModel: toggleModel, onShowAllModels: () => updateIndex(SHOW_ALL), onHideAllModels: () => updateIndex({ excludeModels: pickerIds, onlyModels: undefined }) };
          const wrap = (el: React.ReactNode) => <HighlightContext.Provider key={s.id} value={{ items: idx.highlight ?? [], indexId: idx.id, set: (h) => {
            updateIndex({ highlight: h.length ? h : undefined });
            window.history.replaceState(null, "", setHighlightParams(new URL(window.location.href), idx.id, h).toString());
          }, models: pickerModels }}>{el}</HighlightContext.Provider>;
          if (s.kind === "gallery") return wrap(<section key={s.id} className="chart-panel"><h2 className="text-[21px] sm:text-[24px] mb-1">{title}</h2><p className="cap mb-3">More metrics · expand a row</p><MetricGallery timeSource={idx.timeSource} onTimeSourceChange={(timeSource) => updateIndex({ timeSource })} ranked={r.ranked} mode={paretoMode} snapshot={snapshot} labs={snapshot.labs} settings={{ releasedAfter: idx.releasedAfter, onChangeReleased: (v) => updateIndex({ releasedAfter: v }), ...modelPicker }} /></section>);
          const settings = (label: string, mode: "all" | "best", key: "rankingVariants" | "paretoVariants") => <ChartSettings label={label} mode={mode} onChange={(v) => updateIndex({ [key]: v })} releasedAfter={idx.releasedAfter} onChangeReleased={(v) => updateIndex({ releasedAfter: v })} models={pickerModels} excluded={excludedIds} onToggleModel={toggleModel} onShowAllModels={() => updateIndex(SHOW_ALL)} onHideAllModels={() => updateIndex({ excludeModels: pickerIds, onlyModels: undefined })} />;
          if (s.kind === "rankings") return wrap(
            <section key={s.id} className="chart-panel">
              <Rankings anchor={anchorOf(title)} title={<h2 className="text-[21px] sm:text-[24px]">{title}</h2>} actions={settings("Ranking", rankingMode, "rankingVariants")} ranked={selectVariants(r.ranked, rankingMode)} showEffort={rankingMode === "all"} labs={snapshot.labs} limit={25} selected={selected} onSelect={(x) => setSelected(x?.variant.id ?? null)} />
            </section>
          );
          if (s.kind === "pareto") return wrap(<section key={s.id} className="chart-panel"><ParetoChart description={taskMetricDescription(idx.costSource ?? "aa", "cost")} anchor={anchorOf(title)} ranked={r.ranked} mode={paretoMode} labs={snapshot.labs} height={440} view={paretoView} onView={setParetoView} title={<h2 className="text-[21px] sm:text-[24px]">{title}</h2>} actions={<ChartSettings defaultScale="log" dataSource={{ value: idx.costSource ?? "aa", options: taskMetricOptions(snapshot, "cost"), onChange: (costSource) => updateIndex({ costSource }) }} label="Pareto" mode={paretoMode} onChange={(v) => updateIndex({ paretoVariants: v })} view={paretoView} onView={setParetoView} releasedAfter={idx.releasedAfter} onChangeReleased={(v) => updateIndex({ releasedAfter: v })} models={pickerModels} excluded={excludedIds} onToggleModel={toggleModel} onShowAllModels={() => updateIndex(SHOW_ALL)} onHideAllModels={() => updateIndex({ excludeModels: pickerIds, onlyModels: undefined })} />} /></section>);
          if (s.kind === "speed") return wrap(<section key={s.id} className="chart-panel"><SpeedChart anchor={anchorOf(title)} pts={pickPoints(speedChart, r.ranked, paretoMode)} labs={snapshot.labs} view={speedView} title={<h2 className="text-[21px] sm:text-[24px]">{title}</h2>} actions={<ChartSettings label="Speed" mode={paretoMode} onChange={(v) => updateIndex({ paretoVariants: v })} view={speedView} onView={setSpeedView} releasedAfter={idx.releasedAfter} onChangeReleased={(v) => updateIndex({ releasedAfter: v })} {...modelPicker} />} /></section>);
          if (s.kind === "history") return <section key={s.id}><h2 className="text-[21px] sm:text-[24px] mb-2">{title}</h2><p className="cap">Use the date picker above to view this page as of any earlier snapshot.</p></section>;
          return null;
        })}

        <footer className="border-t hairline pt-6 flex items-baseline justify-between text-[12.5px] text-grey">
          <span>Data as of {snapshot.date}. Sources: {[...new Set(snapshot.benchmarks.map((b) => b.sourceId))].join(", ")}.</span>
          <Link href="/" className="hover:text-ink">Build your own</Link>
        </footer>
      </main>
      {p.indices[0] && <MixAssistant config={p.indices[0]} date={snapshot.date} handle={p.handle} onApply={(next) => setP({ ...p, indices: p.indices.map((x) => x.id === next.id ? next : x) })} />}
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
    <div className={`${open ? "grid" : "hidden"} absolute right-0 top-full mt-1.5 w-56 gap-2 p-3 bg-white border hairline rounded-md shadow-[0_18px_40px_-18px_var(--shadow)] z-30 [&>*]:w-full`} role="menu">{children}</div>
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
    case "history": return `${indexName ?? "Frontier"} over time`;
    case "gallery": return "More metrics";
    case "benchmark": return "Benchmark";
    case "links": return "Links";
    default: return "";
  }
}
