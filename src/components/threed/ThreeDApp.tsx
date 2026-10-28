"use client";
import Link from "next/link";
import { useCoreSnapshot } from "../use-core-snapshot";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { effectiveBasis } from "@/data/subscription";
import { hasSubscriptionPrices } from "@/data/task-metrics";
import { mergeImports } from "@/lib/import";
import { PRESET_IDS, threeDUrl } from "@/lib/compare-ref";
import { formulaInputs, chartLabel } from "@/lib/metrics";
import { metaFor, placePoints, type Point3 } from "@/lib/three-d";
import { HeaderAccount } from "../AccountMenu";
import { SiteFooter } from "../SiteFooter";
import { SiteNav } from "../SiteNav";
import { SettingsButton } from "../SiteSettings";
import { Wordmark } from "../Wordmark";
import { markColor, useChartPalette } from "../chart/echarts";
import { choiceFromIndex, choiceFromPage, choiceFromPreset, rankSide, type Choice, type Published } from "../compare/choice";
import { loadPage } from "../compare/load-page";
import { SidePicker, type Sources } from "../compare/SidePicker";
import { useMyRankings } from "../my-rankings";
import { useLightDismiss } from "@/lib/useLightDismiss";
import { Scene3D, type LabelMode, type ViewPreset } from "./Scene3D";
import { AxisIcon, CAMERA_ICONS, MeasureIcon, TOGGLE_ICONS } from "./icons";
import "../compare/compare.css";
import "./threed.css";

const VIEWS = {
  perspective: { label: "Perspective", ortho: false, dir: [1, 0.8, 1.25] },
  isometric: { label: "Isometric", ortho: true, dir: [1, 1, 1] },
  front: { label: "Front", ortho: true, dir: [0, 0, 1] },
  side: { label: "Side", ortho: true, dir: [1, 0, 0] },
  top: { label: "Top", ortho: true, dir: [0, 1, 0] },
} as const;
type ViewKey = keyof typeof VIEWS;
const MIN_ROWS = 8;
const short = (label = "") => label.replace(/\s*\(.*\)\s*$/, "");

/** `/3d`: one ranking as a 3D chart (score, time per task and cost per task by default) with the best corner marked. */
export function ThreeDApp({ initial, wantMine, axes: axesParam, published }: { initial?: Choice; wantMine: boolean; axes?: string; published: Published[] }) {
  const { snapshot, error, retry } = useCoreSnapshot();
  const { probe, handle, page, builder, builderReady } = useMyRankings();
  const [picked, setPicked] = useState(initial);
  const mineReady = wantMine && handle !== undefined && builderReady && (!handle || page !== undefined);
  const mine = useMemo(() => (page ? choiceFromPage(page, undefined, true) : builder[0] ? choiceFromIndex(builder[0], { title: "You", short: "you", mine: true }) : undefined), [page, builder]);
  const choice = picked ?? (mineReady ? mine ?? (snapshot ? choiceFromPreset(snapshot, "aa") : undefined) : undefined);
  const sources = useMemo<Sources>(() => ({ page: page ?? undefined, builder, published, loadPage, presets: snapshot ? PRESET_IDS.map((id) => choiceFromPreset(snapshot, id)).filter((c): c is Choice => !!c) : [] }), [page, builder, published, snapshot]);

  const [axes, setAxes] = useState<[string, string, string]>(() => { const p = axesParam?.split(".") ?? []; return p.length === 3 ? [p[0], p[1], p[2]] : ["time", "score", "cost"]; });
  const [allEfforts, setAllEfforts] = useState(false);
  const [viewKey, setViewKey] = useState<ViewKey>("perspective");
  const [nonce, setNonce] = useState(0);
  const [labels, setLabels] = useState<LabelMode>("key");
  const [dropLines, setDropLines] = useState(true), [frontier, setFrontier] = useState(true), [spin, setSpin] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);

  const side = useMemo(() => (snapshot && choice ? rankSide(snapshot, choice) : undefined), [snapshot, choice]);
  const snap = useMemo(() => (snapshot && choice?.imports?.length ? mergeImports(snapshot, choice.imports).snapshot : snapshot), [snapshot, choice]);
  const inputs = useMemo(() => (snap && side ? formulaInputs(snap, side.result.ranked, side.result.config.timeSource) : undefined), [snap, side]);
  const subscription = !!snapshot && effectiveBasis(side?.result.config.costBasis, hasSubscriptionPrices(snapshot)) === "subscription";
  const options = useMemo(() => {
    if (!inputs || !side) return [];
    const { variables, of } = inputs.get();
    return variables.filter((v) => metaFor(v.name) && side.result.ranked.filter((r) => of(r)[v.name] != null).length >= MIN_ROWS).map((v) => ({ name: v.name, label: v.name === "cost" && subscription ? "Subscription cost per task ($)" : v.label }));
  }, [inputs, side, subscription]);
  // Axes the data cannot fill fall back to the first measures it can, so the page always opens on something.
  const usable = useMemo(() => {
    const names = options.map((o) => o.name), want = axes.map((a, i) => (names.includes(a) ? a : undefined));
    const spare = ["score", "cost", "time", "speed", "tokens", "latency", "age"].filter((n) => names.includes(n) && !want.includes(n));
    return want.map((a) => a ?? spare.shift() ?? names[0]) as [string, string, string];
  }, [options, axes]);
  const placed = useMemo(() => (inputs && side && options.length >= 3 ? placePoints(side.result.ranked, inputs, usable, allEfforts) : undefined), [inputs, side, options.length, usable, allEfforts]);
  const labelOf = useMemo(() => new Map(options.map((o) => [o.name, o.label])), [options]);
  const titles = useMemo(() => usable.map((a) => short(labelOf.get(a) ?? a ?? "")) as [string, string, string], [usable, labelOf]);

  const pal = useChartPalette();
  const labColors = useMemo(() => new Map((snapshot?.labs ?? []).map((l) => [l.id, markColor(l.color, pal, l.id)])), [snapshot, pal]);
  const colorOf = useCallback((p: Point3) => labColors.get(p.r.model.labId) ?? pal.grey, [labColors, pal]);
  const nameOf = useCallback((p: Point3) => chartLabel(p.r), []);
  const scenePal = useMemo(() => ({ ink: pal.ink, grey: pal.grey, hair: pal.hair, bg: pal.tipBg }), [pal]);
  const view = useMemo<ViewPreset>(() => ({ ortho: VIEWS[viewKey].ortho, dir: [...VIEWS[viewKey].dir] as [number, number, number], nonce }), [viewKey, nonce]);
  const byId = useMemo(() => new Map((placed?.points ?? []).map((p) => [p.id, p])), [placed]);
  const nearest = useMemo(() => [...(placed?.points ?? [])].sort((a, b) => a.gap - b.gap).slice(0, 6), [placed]);
  const inZone = useMemo(() => (placed?.points ?? []).filter((p) => p.inZone).length, [placed]);
  const labelModes: LabelMode[] = ["key", "all", "none"];

  useEffect(() => {
    if (!choice) return;
    const url = new URL(threeDUrl(choice.ref), location.origin);
    if (usable.join(".") !== "time.score.cost") url.searchParams.set("ax", usable.join("."));
    history.replaceState(null, "", url.pathname + url.search.replace(/%40/g, "@").replace(/%7E/gi, "~"));
  }, [choice, usable]);
  const setAxis = (i: number, name: string) => { const next = [...usable] as [string, string, string]; const j = next.indexOf(name); if (j >= 0) next[j] = next[i]; next[i] = name; setAxes(next); };
  const sel = selected ? byId.get(selected) : undefined, tip = hover ? byId.get(hover.id) : undefined;
  const fmt = (p: Point3, i: number) => placed!.axes[i].meta.format(p.raw[i]);
  const loading = !snapshot || (wantMine && !picked && !mineReady);

  return <main className="min-h-dvh">
    {probe}
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-8 py-2 sm:h-14 border-b hairline">
      <div className="flex items-center gap-5"><Wordmark /><span className="max-sm:hidden"><SiteNav /></span></div>
      <span className="ml-auto flex items-center gap-2"><HeaderAccount /><SettingsButton /></span>
      <span className="sm:hidden w-full"><SiteNav /></span>
    </header>
    <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8 grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-[36px] leading-tight">3D</h1><p className="text-[13.5px] text-ink-2 mt-1 max-w-[62ch]">Every model as a point. The better end of each axis is at the far corner, and the green zone is where a model beats the median on all three.</p></div>
        <div className="w-full sm:w-[360px]"><SidePicker tone="a" label="Ranking" value={choice} sources={sources} onPick={(c) => { setPicked(c); setSelected(null); }} /></div>
      </div>
      {loading ? <div role="status" aria-busy={!error} className="grid gap-4"><div className="load-bar h-[480px] w-full" />
        <p className="text-[12px] text-grey">{error ? <>{error} <button type="button" className="underline" onClick={retry}>Retry</button></> : "Loading benchmark data…"}</p></div>
        : !placed ? <p className="text-[14px] text-ink-2">This ranking does not have three measures with enough models to chart. Choose another ranking above.</p>
        : <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="t3d-stage">
            <div className="t3d-bar t3d-bar-top">
              <AxisPanel axes={usable} options={options} onPick={setAxis} onRotate={() => setAxes([usable[2], usable[0], usable[1]])} />
              <div className="t3d-tools" role="group" aria-label="Camera">
                {(Object.keys(VIEWS) as ViewKey[]).map((k) => <button key={k} type="button" className="t3d-tool" aria-pressed={viewKey === k} data-tip={VIEWS[k].label} aria-label={VIEWS[k].label} onClick={() => { setViewKey(k); setNonce((n) => n + 1); }}>{CAMERA_ICONS[k]}</button>)}
              </div>
            </div>
            <div className="t3d-canvas">
              <Scene3D points={placed.points} axes={placed.axes} zone={placed.zone} titles={titles} palette={scenePal} colorOf={colorOf} nameOf={nameOf} view={view} labels={labels} dropLines={dropLines} frontier={frontier} autoRotate={spin} selected={selected} onSelect={setSelected} onHover={setHover} />
              <p className="cap t3d-hint">Drag to orbit · scroll to zoom · right-drag to pan</p>
              {tip && hover && <div role="status" className="t3d-tip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
                <div className="font-semibold">{nameOf(tip)}</div>
                {([0, 1, 2] as const).map((i) => <div key={i} className="flex justify-between gap-4 text-ink-2"><span>{titles[i]}</span><span className="num text-ink">{fmt(tip, i)}</span></div>)}
              </div>}
            </div>
            <div className="t3d-bar t3d-bar-bottom">
              <div className="t3d-tools t3d-tools-bottom" role="group" aria-label="Display">
                <button type="button" className="t3d-tool" aria-pressed={labels !== "none"} data-tip={labels === "key" ? "Key labels (click for all)" : labels === "all" ? "All labels (click for none)" : "No labels (click for key)"} aria-label="Cycle labels" onClick={() => setLabels(labelModes[(labelModes.indexOf(labels) + 1) % 3])}>{TOGGLE_ICONS.labels}</button>
                <button type="button" className="t3d-tool" aria-pressed={dropLines} data-tip="Drop lines" aria-label="Drop lines" onClick={() => setDropLines((v) => !v)}>{TOGGLE_ICONS.drops}</button>
                <button type="button" className="t3d-tool" aria-pressed={frontier} data-tip="Glow the frontier" aria-label="Glow the frontier" onClick={() => setFrontier((v) => !v)}>{TOGGLE_ICONS.glow}</button>
                <button type="button" className="t3d-tool" aria-pressed={allEfforts} data-tip={allEfforts ? "Every effort" : "Best effort per model"} aria-label="Show every effort" onClick={() => setAllEfforts((v) => !v)}><MeasureIcon name="tokens" /></button>
                <button type="button" className="t3d-tool" aria-pressed={spin} data-tip="Auto-rotate" aria-label="Auto-rotate" onClick={() => setSpin((v) => !v)}>{TOGGLE_ICONS.spin}</button>
                <button type="button" className="t3d-tool" data-tip="Reset camera" aria-label="Reset camera" onClick={() => setNonce((n) => n + 1)}>{TOGGLE_ICONS.reset}</button>
              </div>
            </div>
          </div>
          <aside className="grid content-start gap-5 text-[13px]">
            {sel && <section className="grid gap-1.5 rounded-lg border hairline p-4" style={{ background: "var(--white)" }} aria-label="Selected model">
              <div className="flex items-start justify-between gap-2"><h2 className="font-serif text-[20px] leading-tight">{nameOf(sel)}</h2><button type="button" className="text-grey hover:text-ink" aria-label="Clear selection" onClick={() => setSelected(null)}>×</button></div>
              {([0, 1, 2] as const).map((i) => <div key={i} className="flex items-center justify-between text-ink-2"><span className="inline-flex items-center gap-2"><MeasureIcon name={usable[i]} size={15} />{titles[i]}</span><span className="num text-ink">{fmt(sel, i)}</span></div>)}
              <p className="cap">{sel.inZone ? "In the green zone. " : ""}{sel.frontier ? "On the frontier: nothing beats it on all three." : `${sel.gap.toFixed(2)} from the best corner.`}</p>
              <Link href={`/models/${sel.modelId}` as "/models/x"} className="text-indigo hover:underline w-fit">Open the model page</Link>
            </section>}
            <section aria-label="Closest to the best corner">
              <h2 className="font-serif text-[18px] mb-1">Closest to the best corner</h2>
              <p className="cap mb-2 flex items-center gap-2"><i className="t3d-zone-key" aria-hidden="true" />{inZone} of {placed.points.length} beat the median on all three</p>
              <ol className="grid gap-1">{nearest.map((p, i) => <li key={p.id}><button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-hair-2" aria-pressed={selected === p.id} onClick={() => setSelected(selected === p.id ? null : p.id)}>
                <span className="num text-grey w-4">{i + 1}</span><i aria-hidden="true" className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: colorOf(p) }} /><span className="truncate flex-1">{nameOf(p)}</span><span className="num text-ink-2">{p.gap.toFixed(2)}</span>
              </button></li>)}</ol>
              <p className="cap mt-2">Distance in the cube, 0 is the corner itself. Axes are logarithmic where a measure spans orders of magnitude.</p>
            </section>
            <section><p className="cap">{placed.points.length} {allEfforts ? "model variants" : "models"} with all three measures{choice ? ` · ${choice.title === "You" ? choice.sub : `${choice.title}'s ${choice.sub}`}` : ""}</p></section>
          </aside>
        </div>}
    </div>
    <SiteFooter />
  </main>;
}

const ROLES = ["Across", "Up", "Depth"] as const;
interface Option { name: string; label: string }

/** The three axes as a card of rows; each opens a list of measures with a glyph and which end is better. */
function AxisPanel({ axes, options, onPick, onRotate }: { axes: [string, string, string]; options: Option[]; onPick: (i: number, name: string) => void; onRotate: () => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(null), []);
  useLightDismiss(root, close);
  return <div ref={root} className="t3d-axes" role="group" aria-label="Axes">
    {ROLES.map((role, i) => {
      const name = axes[i], current = options.find((o) => o.name === name);
      return <div key={role} className="t3d-axis">
        <button type="button" aria-haspopup="listbox" aria-expanded={open === i} aria-label={`${role} axis: ${current ? short(current.label) : name}. Change`} onClick={() => setOpen(open === i ? null : i)}>
          <span className="t3d-glyph"><AxisIcon axis={i as 0 | 1 | 2} /></span>
          <span className="t3d-axis-name"><small>{role}</small><span>{short(current?.label ?? name)}</span></span>
          <span className="text-grey">{TOGGLE_ICONS.chevron}</span>
        </button>
        {open === i && <div className="t3d-menu" role="listbox" aria-label={`${role} axis`}>
          {options.map((o) => <button key={o.name} type="button" role="option" aria-selected={o.name === name} aria-current={o.name === name} className="t3d-opt" onClick={() => { onPick(i, o.name); setOpen(null); }}>
            <span className="t3d-glyph"><MeasureIcon name={o.name} /></span><span>{short(o.label)}</span><small>{metaFor(o.name).better === "lower" ? "lower is better" : "higher is better"}</small>
          </button>)}
        </div>}
      </div>;
    })}
    <button type="button" className="t3d-tool t3d-rotate" onClick={onRotate} data-tip="Rotate the axes" aria-label="Rotate the axes">{TOGGLE_ICONS.rotate}</button>
  </div>;
}
