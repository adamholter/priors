"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { ECharts } from "echarts";
import { IconArrowBackUp, IconEye, IconEyeOff, IconPlus } from "@tabler/icons-react";
import type { Lab } from "@/data/types";
import { useLightDismiss } from "@/lib/useLightDismiss";
import { PlotSketch } from "./ChartSkeleton";
import { capRows, keyData, type KeyModelRow } from "./chart-key";
import { cornerStyle, emptiestCorner, gridRect, placeGhostNames, pxOf, textWidth, type Box, type Corner } from "./chart-key-geometry";
import { EMPTY_HIDDEN, type ChartHidden } from "./chart-visibility";
import type { useChartVisibility } from "./ChartContextMenu";
import { isHighlighted, type HighlightState } from "./highlight";
import { markColor, type ChartPalette } from "./palette";
import { SANS } from "./theme-tokens";
import type { ScatterPoint, ScatterView } from "./scatter-option";
import { chartLabel } from "@/lib/metrics";
import "./chart-key.css";

/**
 * What a scatter chart says about itself without a caption: which colour is which lab (a key that fades into the emptiest corner
 * when the pointer rests on empty plot, K, or a tap), what the chart leaves out (an eye with a count and a list, one way back per
 * model, a dashed ghost at the true place on hover) and a notice when a removal happens or a copied link arrives with some.
 * ScoreScatter builds one KeyChart per render; the provider works the data out once and every slot reads it.
 */
export type KeyChart = {
  bare: boolean; anchor?: string; exportName: string; labs: Lab[]; pal: ChartPalette; better: "lower" | "higher";
  /** Marks drawn after removals and "only Pareto". */ pts: ScatterPoint[];
  /** Marks inside the zoom window. */ shown: ScatterPoint[];
  /** Every candidate before the default trim. */ chartPoints: ScatterPoint[];
  /** After the default trim, before removals. */ allPoints: ScatterPoint[];
  /** The default trim applies to this chart at all (not time charts, not hand-picked indices). */ canTrim: boolean;
  /** The default trim is on right now. */ trimmed: boolean;
  visibility: ChartVisibility; view: ScatterView; onView?: (view: ScatterView, persist?: boolean) => void;
  hl: HighlightState | null; frontier: ScatterPoint[]; plotW: number; plotH: number;
  chart: RefObject<ECharts | null>; wrap: RefObject<HTMLDivElement | null>;
  labelAt: RefObject<Map<string, { x: number; y: number; align: "left" | "right" }>>;
  hover: ScatterPoint | null; pinned: ScatterPoint | null;
};
type ChartVisibility = ReturnType<typeof useChartVisibility>;

const NONE: string[] = [];
function useKeyModel(c: KeyChart) {
  const { pts, allPoints, chartPoints, canTrim, trimmed, visibility, view, labs, pal, better, hl, frontier, onView } = c;
  const hidden = visibility.hidden, keepKey = (hl?.items ?? NONE).join(","), hlModels = hl?.models, allModels = !!view.allModels, showFrontier = !!view.frontier;
  const data = useMemo(() => keyData({
    pts, allPoints, chartPoints, canTrim, trimmed, allModels, hidden, frontier, showFrontier, labs, pal, better, keep: keepKey ? keepKey.split(",") : NONE,
    nameOf: (id) => hlModels?.find((m) => m.id === id)?.name,
  }), [pts, allPoints, chartPoints, canTrim, trimmed, allModels, hidden, frontier, showFrontier, labs, pal, better, keepKey, hlModels]);
  const leftOut = data.trimmedModels.length + data.removed.length;
  // The list acts 160ms after a click: read what is true then (a second click in that window must not undo the first).
  const liveHl = useRef(hl); useEffect(() => { liveHl.current = hl; });
  const without = (keys: string[]) => (cur: ChartHidden): ChartHidden => ({ models: cur.models.filter((id) => !keys.includes(`m:${id}`)), efforts: cur.efforts.filter((k) => !keys.includes(`e:${k}`)) });
  return {
    ...data, leftOut, allOn: allModels,
    /** A lab's colour on this page's palette: the row it shares on the chart, else the same markColor the chart would use. */
    paint: (labId: string) => data.labRows.find((l) => l.labIds.includes(labId))?.color ?? markColor(labs.find((l) => l.id === labId)?.color, pal, labId),
    /** The toggle between the default trim and every model exists when the trim would hide something. */
    canToggle: canTrim && !!onView && (data.trimmedModels.length > 0 || (allModels && data.defaultOut > 0)),
    setAll: (on: boolean) => onView?.({ ...view, allModels: on || undefined }),
    restore: (keys: string[]) => visibility.restore(without(keys)),
    restoreAll: () => visibility.restore(EMPTY_HIDDEN),
    /** A model the default trim left out stays on the chart once starred (src/lib/chart-focus.ts keeps starred models). */
    bringIn: (id: string) => { const now = liveHl.current; if (now && !isHighlighted(now.items, id)) now.set([...now.items, id]); },
  };
}
type KeyModel = ReturnType<typeof useKeyModel>;

type Slot = { chart: KeyChart; model: KeyModel; ghost: string[]; setGhost: (ids: string[]) => void };
const KeyContext = createContext<Slot | null>(null);
const useKey = () => useContext(KeyContext);

export function ChartKeyProvider({ chart, children }: { chart: KeyChart; children: ReactNode }) {
  return chart.bare ? <>{children}</> : <Keyed chart={chart}>{children}</Keyed>;
}
function Keyed({ chart, children }: { chart: KeyChart; children: ReactNode }) {
  const model = useKeyModel(chart), [ghost, set] = useState<string[]>(NONE);
  // Hover in and out fire often; a preview that is already showing (or already empty) changes nothing.
  const setGhost = useCallback((ids: string[]) => set((cur) => (cur.join() === ids.join() ? cur : ids.length ? ids : NONE)), []);
  return <KeyContext.Provider value={{ chart, model, ghost, setGhost }}>{children}<RemovalNotice /></KeyContext.Provider>;
}

/** A lab's colour as a drawn unit: a solid dot, or (left out) a dashed ring. Hollow solid rings already mean "estimated". */
function Dot({ color, size = 8, dashed }: { color: string; size?: number; dashed?: boolean }) {
  const s: CSSProperties = { width: size, height: size, borderRadius: "50%", flex: "none", display: "inline-block", boxSizing: "border-box" };
  return <i aria-hidden="true" style={dashed ? { ...s, border: `1.5px dashed ${color}`, background: "transparent" } : { ...s, background: color }} />;
}

/** A line of text that is a control: indigo, underlined on hover, a 40px target on touch. */
function TextAction({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" className="text-indigo text-[13px] hit hover:underline underline-offset-2" onClick={onClick}>{children}</button>;
}

/** "⌘Z" on Apple keyboards, "Ctrl+Z" elsewhere. */
const undoKey = () => (typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘Z" : "Ctrl+Z");

/** Undo for a chart's removals, as an icon. Its slot opens from zero width, so the controls beside it glide instead of jumping. */
export function ChartUndo({ visibility }: { visibility: Pick<ChartVisibility, "canUndo" | "undo"> }) {
  const on = visibility.canUndo;
  return <span className="chart-undo-slot" data-open={on}>
    <button type="button" className="chart-undo hit" tabIndex={on ? 0 : -1} aria-hidden={!on} aria-label="Undo chart removal" aria-keyshortcuts="Control+Z Meta+Z" title={`Undo (${undoKey()})`} onClick={visibility.undo}><IconArrowBackUp size={16} stroke={1.6} aria-hidden="true" /></button>
  </span>;
}

/** Re-render when the chart settles after a layout (resize, new data, zoom): overlays read pixel positions from it. Off while nothing is drawn. */
function useChartTick(chart: RefObject<ECharts | null>, plotW: number, plotH: number, on: boolean) {
  const [, setTick] = useState(0), c = chart.current;
  useEffect(() => {
    if (!c || !on) return;
    const bump = () => setTick((n) => n + 1);
    c.on("finished", bump);
    return () => { if (!c.isDisposed()) c.off("finished", bump); };
  }, [c, on]);
  useEffect(() => {
    if (!on) return;
    const t = window.setTimeout(() => setTick((n) => n + 1), 60);
    return () => window.clearTimeout(t);
  }, [plotW, plotH, on]);
}

const HINT = "priors:chart-key-hint";
const seenHint = () => { try { return sessionStorage.getItem(HINT) === "1"; } catch { return true; } };
const markHint = () => { try { sessionStorage.setItem(HINT, "1"); } catch { /* private window: no hint */ } };

/**
 * When the lab key shows. Never at rest. A mouse that stops on empty plot for 0.4s, the K key (held until K or Escape), a tap on
 * empty plot (4s), and once per browser session the first time the mouse enters the plot so the gesture is learned. It goes at
 * once when the pointer reaches a mark, a button is down, or the pointer leaves. Pointer moves are read once per frame.
 */
function useRestReveal(c: KeyChart) {
  const [rest, setRest] = useState(false), [sticky, setSticky] = useState(false), [touch, setTouch] = useState(false), [hint, setHint] = useState(false);
  const live = useRef({ c, rest }); useEffect(() => { live.current = { c, rest }; });
  useEffect(() => {
    const wrap = c.wrap.current, plot = wrap?.querySelector<HTMLElement>('[role="img"]');
    if (!wrap || !plot || c.bare) return;
    let timer = 0, touchTimer = 0, hintTimer = 0, frame = 0, last: PointerEvent | undefined;
    plot.setAttribute("aria-keyshortcuts", "K");
    const overMark = (e: PointerEvent) => {
      const r = plot.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, now = live.current.c;
      if (x < 0 || y < 0 || x > r.width || y > r.height) return true;
      return now.shown.some((p) => { const at = pxOf(now.chart.current, p); return !!at && Math.hypot(at.x - x, at.y - y) < 14; });
    };
    const hide = () => { window.clearTimeout(timer); window.clearTimeout(hintTimer); setRest(false); setHint(false); };
    const enter = (e: PointerEvent) => { if (e.pointerType === "mouse" && !seenHint()) { markHint(); setHint(true); window.clearTimeout(hintTimer); hintTimer = window.setTimeout(() => setHint(false), 2400); } };
    const look = () => {
      frame = 0;
      if (!last) return;
      if (last.buttons || overMark(last)) { window.clearTimeout(timer); setRest(false); return; }
      if (!live.current.rest) { window.clearTimeout(timer); timer = window.setTimeout(() => setRest(true), 400); }
    };
    const move = (e: PointerEvent) => { if (e.pointerType !== "mouse") return; last = e; if (!frame) frame = requestAnimationFrame(look); };
    const down = (e: PointerEvent) => {
      hide();
      if (e.pointerType === "touch" && !overMark(e)) { setTouch(true); window.clearTimeout(touchTimer); touchTimer = window.setTimeout(() => setTouch(false), 4000); }
    };
    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "k" || e.key === "K") { e.preventDefault(); setSticky((v) => !v); }
      if (e.key === "Escape") { setSticky(false); setTouch(false); hide(); }
    };
    plot.addEventListener("pointerenter", enter); wrap.addEventListener("pointermove", move); wrap.addEventListener("pointerleave", hide); wrap.addEventListener("pointerdown", down);
    plot.addEventListener("keydown", key);
    return () => {
      window.clearTimeout(timer); window.clearTimeout(touchTimer); window.clearTimeout(hintTimer); cancelAnimationFrame(frame);
      plot.removeEventListener("pointerenter", enter); wrap.removeEventListener("pointermove", move); wrap.removeEventListener("pointerleave", hide); wrap.removeEventListener("pointerdown", down); plot.removeEventListener("keydown", key);
      plot.removeAttribute("aria-keyshortcuts");
    };
  }, [c.wrap, c.bare, c.chart]);
  // `sticky` is K: the key is aria-hidden while it is away, so K also has the labs read out through a status line.
  return { visible: sticky || rest || touch || hint, sticky };
}

/** The lab key. The corner is chosen when it appears and held while it stays, so it never slides around under the pointer. */
function CornerKey({ c, model }: { c: KeyChart; model: KeyModel }) {
  const { visible: on, sticky } = useRestReveal(c);
  const rows = capRows(model.labRows), visible = on && rows.length > 1;
  useChartTick(c.chart, c.plotW, c.plotH, visible);
  const [corner, setCorner] = useState<Corner>("tl"), [was, setWas] = useState(false);
  if (visible !== was) {
    setWas(visible);
    if (visible) setCorner(emptiestCorner(c.shown.flatMap((p) => pxOf(c.chart.current, p) ?? []), gridRect(c.chart.current), 132, rows.length * 18 + 12, c.hover || c.pinned ? ["br"] : []));
  }
  if (rows.length < 2) return null;
  const el = c.chart.current;
  return <>
    <div className="chart-key" data-on={visible} aria-hidden={!visible} style={visible || was ? cornerStyle(gridRect(el), el?.getWidth() ?? 0, el?.getHeight() ?? 0, corner) : undefined}>
      {rows.map((r) => <div key={r.id} className="chart-key-row"><Dot color={r.color} /><span className="chart-key-text">{r.name}</span></div>)}
    </div>
    <span className="sr-only" role="status">{sticky ? `Labs on the chart: ${rows.map((r) => r.name).join(", ")}` : ""}</span>
  </>;
}

/**
 * Previews on the plot: a drawn model gets a 2px ink ring (every effort), a model the chart leaves out gets a dashed ghost ring at
 * the place it would draw. A ghost is named when it is the one previewed, or when its name clears everything else.
 * Pointer events off, so nothing under it stops working.
 */
function GhostLayer({ c, model, ids }: { c: KeyChart; model: KeyModel; ids: string[] }) {
  useChartTick(c.chart, c.plotW, c.plotH, true);
  const el = c.chart.current, g = gridRect(el);
  if (!el || !g) return null;
  const by = new Map<string, { m: KeyModelRow; drawn: boolean }>();
  for (const m of model.on) by.set(m.id, { m, drawn: true });
  for (const m of model.trimmedModels) by.set(m.id, { m, drawn: false });
  for (const r of model.removed) if (r.model && !by.has(r.model.id)) by.set(r.model.id, { m: r.model, drawn: false });
  const W = el.getWidth(), shown = ids.map((id) => by.get(id)).filter((v): v is { m: KeyModelRow; drawn: boolean } => !!v), size = 11.5;
  const ghosts = shown.filter((v) => !v.drawn).flatMap(({ m }) => {
    const at = pxOf(el, m.best); if (!at) return [];
    return [{ m, id: m.id, name: m.name, score: m.best.r.score, x: Math.min(Math.max(at.x, g.x + 6), g.x + g.width - 6), y: Math.min(Math.max(at.y, g.y + 6), g.y + g.height - 6), col: model.paint(m.labId) }];
  });
  // Everything a name must stay clear of: drawn marks and the chart's own labels.
  const solid: Box[] = [];
  for (const p of c.shown) { const at = pxOf(el, p); if (at) solid.push({ x: at.x - 6, y: at.y - 6, w: 12, h: 12 }); }
  const byId = new Map(c.shown.map((p) => [p.r.variant.id, p]));
  for (const [id, at] of c.labelAt.current) { const p = byId.get(id); if (!p) continue; const w = textWidth(chartLabel(p.r), size); solid.push({ x: at.align === "left" ? at.x - 2 : at.x - w - 2, y: at.y - 8, w: w + 4, h: 16 }); }
  const names = placeGhostNames(ghosts, solid, g, W, size, shown.length === 1);
  return <svg aria-hidden="true" className="absolute inset-0 z-[4] pointer-events-none" width="100%" height="100%">
    {shown.filter((v) => v.drawn).flatMap(({ m }) => m.points.map((p) => { const at = pxOf(el, p); return at && <circle key={p.r.variant.id} cx={at.x} cy={at.y} r={8} fill="none" stroke={c.pal.ink} strokeWidth={2} className="chart-ghost-ring" />; }))}
    {ghosts.map((gh) => <circle key={gh.id} className="chart-ghost-mark" cx={gh.x} cy={gh.y} r={5.5} fill={c.pal.bg} fillOpacity={0.8} stroke={gh.col} strokeWidth={1.2} strokeDasharray="2.2 2" />)}
    {ghosts.flatMap((gh) => { const n = names.get(gh.id); return n ? [<text key={`n-${gh.id}`} className="chart-ghost-mark" x={n.x} y={n.y + 4} textAnchor={n.flip ? "end" : "start"} fontSize={size} fill={c.pal.ink2} stroke={c.pal.bg} strokeWidth={3} paintOrder="stroke" style={{ fontFamily: c.pal.fonts?.sans ?? SANS }}>{gh.name}</text>] : []; })}
  </svg>;
}

/** The lab key and the previews, over the plot. */
export function ChartKeyPlot() {
  const k = useKey();
  if (!k) return null;
  return <div className="absolute inset-0 z-[4] pointer-events-none"><CornerKey c={k.chart} model={k.model} />{k.ghost.length > 0 && <GhostLayer c={k.chart} model={k.model} ids={k.ghost} />}</div>;
}

/** What the chart leaves out: an eye with a count, a list with one restore or add per model, and the way back. */
function EyeMenuBody({ k }: { k: Slot }) {
  const { model, setGhost } = k, root = useRef<HTMLDetailsElement>(null), trigger = useRef<HTMLElement>(null);
  const [leaving, setLeaving] = useState<string[]>([]), [dx, setDx] = useState(0);
  // The list hangs from the icon's right edge. On a phone that icon can sit near the left edge (or the toolbar wraps): slide the list right until it clears the screen edge, never past the right one.
  const place = useCallback(() => {
    const r = root.current?.getBoundingClientRect(), vw = document.documentElement.clientWidth;
    if (r) setDx(Math.max(0, Math.min(8 - (r.right - Math.min(240, vw * 0.85)), vw - 8 - r.right)));
  }, []);
  const dismiss = useCallback((reason: "outside" | "escape") => { if (!root.current?.open) return; root.current.open = false; setGhost(NONE); if (reason === "escape") trigger.current?.focus(); }, [setGhost]);
  useLightDismiss(root, dismiss);
  const all = model.allOn && model.canToggle;
  const going = useRef(new Set<string>());
  const go = (key: string, fn: () => void) => {
    if (going.current.has(key)) return;
    going.current.add(key); setLeaving((l) => [...l, key]);
    window.setTimeout(() => { fn(); going.current.delete(key); setLeaving((l) => l.filter((x) => x !== key)); }, 160);
  };
  const row = ({ key, id, name, labId, kind, onGo }: { key: string; id: string; name: string; labId: string; kind: "removed" | "trimmed"; onGo: () => void }) =>
    <div key={key} className="chart-left-row" data-leaving={leaving.includes(key) || undefined} onPointerEnter={() => setGhost([id])} onPointerLeave={() => setGhost(NONE)}>
      <div className="chart-left-row-in"><Dot dashed color={model.paint(labId)} /><span className="truncate" title={name}>{name}</span>
        <button type="button" className="chart-left-btn hit" aria-label={`${kind === "removed" ? "Restore" : "Show"} ${name}`} onFocus={() => setGhost([id])} onBlur={() => setGhost(NONE)} onClick={() => go(key, onGo)}>{kind === "removed" ? <IconArrowBackUp size={16} stroke={1.6} aria-hidden="true" /> : <IconPlus size={16} stroke={1.6} aria-hidden="true" />}</button></div>
    </div>;
  const label = all ? "All models shown" : `${model.leftOut} ${model.leftOut === 1 ? "model" : "models"} left out of the chart`;
  return <details ref={root} data-chart-left-out className="relative shrink-0" name="chart-settings" onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) place(); else setGhost(NONE); }}>
    <summary ref={trigger} aria-label={label} title={all ? label : "Left out of the chart"} className="chart-eye list-none [&::-webkit-details-marker]:hidden cursor-pointer p-1.5 rounded-sm hover:text-ink focus-visible:outline-indigo text-grey inline-flex items-center gap-1 hit">
      {all ? <IconEye size={16} stroke={1.6} aria-hidden="true" /> : <><IconEyeOff size={16} stroke={1.6} aria-hidden="true" /><span key={model.leftOut} className="cap chart-eye-count">{model.leftOut}</span></>}
    </summary>
    <div className={`chart-settings-menu chart-left-out absolute right-0 top-full mt-1 w-60 max-w-[85vw] max-h-[60dvh] overflow-y-auto overscroll-contain border hairline rounded-sm bg-white p-1.5 z-20 shadow-sm`} style={dx ? { translate: `${dx}px` } : undefined}>
      {model.removed.map((r) => row({ key: r.key, id: r.modelId, name: r.label, labId: r.labId ?? "", kind: "removed", onGo: () => model.restore([r.key]) }))}
      {model.trimmedModels.map((m) => row({ key: m.id, id: m.id, name: m.name, labId: m.labId, kind: "trimmed", onGo: () => model.bringIn(m.id) }))}
      {(all || model.canToggle || model.removed.length > 0) && <div className={`flex px-1.5 ${model.leftOut ? "mt-1 pt-1.5 border-t hairline" : ""}`}>
        {!all && <TextAction onClick={() => { if (model.canToggle) model.setAll(true); if (model.removed.length) model.restoreAll(); }}>Show all</TextAction>}
        {all && <TextAction onClick={() => { model.setAll(false); if (root.current) root.current.open = false; }}>Current models only</TextAction>}
      </div>}
    </div>
  </details>;
}
function EyeMenu({ k }: { k: Slot }) {
  return k.model.leftOut === 0 && !(k.model.allOn && k.model.canToggle) ? null : <EyeMenuBody k={k} />;
}

/** The chart toolbar's two controls for what is left out: the eye, and Undo. */
export function ChartKeyToolbar() {
  const k = useKey();
  return k && <><EyeMenu k={k} /><ChartUndo visibility={k.chart.visibility} /></>;
}

const openEye = (wrap: RefObject<HTMLDivElement | null>) => { const d = wrap.current?.querySelector<HTMLDetailsElement>("details[data-chart-left-out]"); if (d) { d.open = true; d.querySelector("summary")?.focus(); } };
/** Click the chart's own settings gear (a person who wants to choose models by hand). */
const openSettings = (wrap: RefObject<HTMLDivElement | null>) => wrap.current?.querySelector<HTMLElement>("summary[aria-label$=' settings']")?.click();

/** The empty plot: a dashed frontier sketch where the data would be, one short line and one way back. An opaque layer hides the chart's own ghost ticks. */
export function ChartKeyEmpty({ empty }: { empty: boolean }) {
  const k = useKey();
  if (!empty) return null;
  // Nothing in the data at all (not a view the person emptied): say so, there is nothing to bring back.
  if (!k || !k.chart.chartPoints.length) return <p className="cap absolute inset-0 grid place-items-center">No model in this view has this metric.</p>;
  const { wrap } = k.chart;
  return <div className="chart-empty absolute inset-0 z-[6] grid place-items-center pointer-events-none">
    <PlotSketch still />
    <div className="chart-empty-in relative flex flex-col items-center gap-0.5 pointer-events-auto">
      <span className="text-[13px] text-grey">No models shown</span>
      {k.model.leftOut > 0 ? <TextAction onClick={() => openEye(wrap)}>Show models</TextAction> : <TextAction onClick={() => openSettings(wrap)}>Choose models</TextAction>}
    </div>
  </div>;
}

/**
 * How to read the chart, drawn with the chart's own marks instead of described: the labs, then each device that is on the plot
 * right now. Sits in the info popover (a grid), first in its order, so the methodology prose follows it.
 */
export function ChartKeyReading() {
  const k = useKey();
  if (!k) return null;
  const { chart: { pal, view, pts, frontier, hl }, model } = k;
  const lab = model.labRows[0]?.color ?? pal.ink2, many = model.on.some((m) => m.points.length > 1);
  const free = pts.some((p) => p.free), est = pts.some((p) => p.r.scoreEstimate), hasFrontier = view.frontier && frontier.length > 1, tags = !!hl?.items.length;
  const swatch = (children: ReactNode) => <svg width="30" height="18" viewBox="0 0 30 18" aria-hidden="true" className="shrink-0">{children}</svg>;
  const rows: { key: string; art: ReactNode; text: string }[] = [];
  if (hasFrontier) rows.push({ key: "frontier", text: "Best score at each price", art: swatch(<><line x1="7" y1="12.5" x2="23" y2="5.5" stroke={pal.ink} strokeWidth="1.5" /><circle cx="7" cy="12.5" r="4" fill={lab} stroke={pal.ink} strokeWidth="1.5" /><circle cx="23" cy="5.5" r="4" fill={lab} stroke={pal.ink} strokeWidth="1.5" /></>) });
  if (view.links && many) rows.push({ key: "links", text: "One model’s efforts", art: swatch(<><line x1="7" y1="12.5" x2="23" y2="5.5" stroke={lab} strokeWidth="1" opacity=".6" /><circle cx="7" cy="12.5" r="3.4" fill={lab} stroke={pal.bg} strokeWidth="1.2" /><circle cx="23" cy="5.5" r="3.4" fill={lab} stroke={pal.bg} strokeWidth="1.2" /></>) });
  if (est) rows.push({ key: "est", text: "Estimated score", art: swatch(<circle cx="15" cy="9" r="4" fill={pal.bg} stroke={lab} strokeWidth="1.6" />) });
  if (free) rows.push({ key: "free", text: "Free", art: swatch(<line x1="15" y1="1" x2="15" y2="17" stroke={pal.grey} strokeWidth="1" strokeDasharray="3 2.5" />) });
  if (tags) rows.push({ key: "tag", text: "Effort level", art: swatch(<text x="15" y="12.5" textAnchor="middle" fontSize="9" fill={pal.grey} fontFamily="var(--font-mono), monospace">LOW</text>) });
  const labs = model.labRows.length > 1;
  if (!labs && !rows.length) return null;
  return <span className="chart-reading grid gap-2 pb-2.5 border-b hairline" style={{ order: -1 }}>
    {labs && <span className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-x-3 gap-y-1.5 text-[12.5px] text-ink">{model.labRows.map((l) => <span key={l.id} className="inline-flex items-center gap-1.5 min-w-0"><Dot color={l.color} size={9} /><span className="truncate">{l.name}</span></span>)}</span>}
    {rows.length > 0 && <span className="grid gap-1">{rows.map((r) => <span key={r.key} className="flex items-center gap-2">{r.art}<span>{r.text}</span></span>)}</span>}
  </span>;
}

const arrived = new Set<string>();
type Notice = { id: string; kind: "hid" | "link"; label: string };
const labelOf = (m: KeyModel) => (m.removed.length === 1 ? m.removed[0].label : `${m.removed.length} models`);

/**
 * One quiet notice per removal, in the removal toast's own look (RemovalToast.tsx); and once per chart, on arrival, when the link
 * itself hides models. The arrival is decided from what the first render holds and queued with a timer nothing cancels, so React's
 * double run of effects in development cannot swallow it.
 */
function RemovalNotice() {
  const k = useKey(), [toast, setToast] = useState<Notice | null>(null);
  const seen = useRef<Set<string> | null>(null), keys = k?.model.removed.map((r) => r.key).join("|") ?? "";
  const live = useRef(k); useEffect(() => { live.current = k; });
  useEffect(() => {
    const now = live.current;
    if (!now) return;
    const m = now.model, keySet = new Set(m.removed.map((r) => r.key)), prev = seen.current;
    seen.current = keySet;
    const queue = (n: Notice) => { window.setTimeout(() => setToast(n), 0); };
    if (prev === null) {
      const a = now.chart.anchor ?? now.chart.exportName;
      if (keySet.size && !arrived.has(a)) { arrived.add(a); queue({ id: `link-${keys}`, kind: "link", label: labelOf(m) }); }
      return;
    }
    const added = m.removed.filter((r) => !prev.has(r.key));
    if (added.length) queue({ id: `hid-${keys}`, kind: "hid", label: added.length === 1 ? added[0].label : `${added.length} models` });
    // A removal taken back some other way (Cmd Z, the list) takes its own notice away, and so does the last hidden model of a link.
    else if (keySet.size < prev.size) window.setTimeout(() => setToast((t) => (t?.kind === "hid" || !keySet.size ? null : t)), 0);
  }, [keys]);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 8000);
    return () => window.clearTimeout(t);
  }, [toast]);
  if (!toast || !k || typeof document === "undefined") return null;
  // Portalled to the body so an expanded chart's transform cannot move it.
  return createPortal(<div className="assistant-toast chart-key-toast flex items-center gap-3" role="status" aria-live="polite">
    <span>{toast.kind === "hid" ? "Hid" : "This link hides"} <b className="font-medium">{toast.label}</b>.</span>
    {toast.kind === "hid"
      ? <><button type="button" className="text-control text-indigo" onClick={() => { k.chart.visibility.undo(); setToast(null); }}>Undo</button><span className="cap" aria-hidden="true">{undoKey()}</span></>
      : <button type="button" className="text-control text-indigo" onClick={() => { k.model.restoreAll(); setToast(null); }}>Show</button>}
  </div>, document.body);
}
