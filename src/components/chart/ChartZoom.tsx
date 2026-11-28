"use client";
import type { ECharts } from "echarts";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { MIN_DRAG, lerpBox, logTicks, padBox, pixelBoxToDomain, unionBox, type Range, type Rect, type ZoomBox, type ZoomScale } from "./chart-zoom";
import type { ChartPalette } from "./theme-tokens";

/**
 * Drag-to-zoom on scatter charts: drag a box on the plot and the axes glide to it. Each drag nests a level; the trail under
 * the plot jumps back, and double-click or Escape steps back one. Escape during a drag cancels the box.
 */
type Point = { x: number; y: number };
type Frame = { grid: Rect; x: Range; y: Range; height: number };

/** The plot rectangle and the data range each axis draws right now. */
function readFrame(c: ECharts | null): Frame | null {
  if (!c || c.isDisposed()) return null;
  const grid = ((c as unknown as { getModel: () => unknown }).getModel() as { getComponent: (t: string, i: number) => { coordinateSystem?: { getRect: () => Rect } } | undefined }).getComponent("grid", 0)?.coordinateSystem?.getRect();
  if (!grid) return null;
  try {
    const lo = c.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [grid.x, grid.y + grid.height]) as number[];
    const hi = c.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [grid.x + grid.width, grid.y]) as number[];
    if (![...lo, ...hi].every(Number.isFinite)) return null;
    return { grid: { x: grid.x, y: grid.y, width: grid.width, height: grid.height }, x: [lo[0], hi[0]], y: [lo[1], hi[1]], height: c.getHeight() };
  } catch { return null; }
}

const inPlot = (p: Point, g: Rect) => p.x >= g.x && p.x <= g.x + g.width && p.y >= g.y && p.y <= g.y + g.height;

const TWEEN_MS = 320;
const ease = (t: number) => 1 - (1 - t) ** 3;
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Charts currently zoomed, latest zoom last. Escape steps back the latest one on screen (only the expanded one, if a chart is expanded). */
const zoomedCharts: HTMLElement[] = [];
const forget = (el: HTMLElement) => { const at = zoomedCharts.indexOf(el); if (at >= 0) zoomedCharts.splice(at, 1); };
function escapeTarget() {
  const expanded = document.querySelector(".chart-expanded");
  return zoomedCharts.findLast((el) => { const r = el.getBoundingClientRect(); return (!expanded || el === expanded) && r.bottom > 0 && r.top < window.innerHeight; });
}
/** A field being typed in, or an open menu or dialog, keeps its own Escape. */
const escapeTaken = (target: EventTarget | null) => (target instanceof Element && !!target.closest('input:not([type="range"], [type="checkbox"], [type="radio"]), textarea, select, [contenteditable="true"]'))
  || !!document.querySelector('details[name="chart-settings"][open], .chart-context-menu, [role="menu"], dialog[open], [role="dialog"]:not(dialog, .chart-expanded)');

export function useChartZoom({ handle, host, scale, bare, pal }: { handle: RefObject<ECharts | null>; host: RefObject<HTMLDivElement | null>; scale: ZoomScale; bare?: boolean; pal: ChartPalette }) {
  const enabled = !bare;
  const [stack, setStack] = useState<ZoomBox[]>([]);
  // While animating, the axes are driven directly and the marks drawn are those of both windows, so nothing pops in or out.
  const [hold, setHold] = useState<{ axis: ZoomBox; filter: ZoomBox | null } | null>(null);
  const [drag, setDrag] = useState<{ a: Point; b: Point; grid: Rect } | null>(null);
  const [armed, setArmed] = useState<Point | null>(null);
  const [run, setRun] = useState(0);
  const current = stack.at(-1) ?? null;
  const filter = hold ? hold.filter : current;
  const range = useMemo(() => hold ? hold.axis : current ? padBox(current, scale) : null, [hold, current, scale]);
  const home = useRef<ZoomBox | null>(null), tween = useRef<{ from: ZoomBox; to: ZoomBox } | null>(null);
  const live = useRef({ stack, scale });
  useLayoutEffect(() => { live.current = { stack, scale }; });

  const go = (next: ZoomBox[]) => {
    const { stack: now, scale: s } = live.current, frame = readFrame(handle.current), el = host.current;
    const was = now.at(-1) ?? null, target = next.at(-1) ?? null;
    if (el) { forget(el); if (next.length) zoomedCharts.push(el); }
    if (!was && frame) home.current = { x: frame.x, y: frame.y };
    const to = target ? padBox(target, s) : home.current;
    if (!frame || !to || reducedMotion()) { setStack(next); setHold(null); return; }
    tween.current = { from: { x: frame.x, y: frame.y }, to };
    setStack(next); setHold({ axis: { x: frame.x, y: frame.y }, filter: was && target ? unionBox(was, target) : null });
    setRun((n) => n + 1);
  };

  // The animation: after the held option has been drawn (the chart applies options on the next frame), step the axes, then let go.
  useEffect(() => {
    if (!run || !tween.current) return;
    const { from, to } = tween.current, s = live.current.scale;
    let frame = 0, start = 0;
    const step = (now: number) => {
      const c = handle.current; if (!c || c.isDisposed()) return;
      if (!start) start = now;
      const t = Math.min(1, (now - start) / TWEEN_MS), b = lerpBox(from, to, ease(t), s);
      const ticks = s === "log" ? logTicks(b.x[0], b.x[1]) : undefined;
      c.setOption({ animation: false, xAxis: { min: b.x[0], max: b.x[1], ...(ticks ? { axisTick: { customValues: ticks }, axisLabel: { customValues: ticks } } : {}) }, yAxis: { min: b.y[0], max: b.y[1] } }, { lazyUpdate: false });
      if (t < 1) frame = requestAnimationFrame(step); else { tween.current = null; setHold(null); }
    };
    frame = requestAnimationFrame(() => { frame = requestAnimationFrame(step); });
    return () => cancelAnimationFrame(frame);
  }, [run, handle]);

  const zoomIn = (box: ZoomBox) => go([...stack, box]);
  const back = () => go(stack.slice(0, -1));
  const reset = () => go([]);
  const toLevel = (n: number) => go(stack.slice(0, n));
  // The gesture listeners stay attached across renders and reach the current handlers through this.
  const act = useRef({ zoomIn, back });
  useLayoutEffect(() => { act.current = { zoomIn, back }; });

  useEffect(() => {
    const el = host.current; if (!enabled || !el) return;
    let start: (Point & { id: number; touch: boolean; frame: Frame }) | null = null;
    let active = false, ready = false, timer = 0, swallow = 0, cancelled = false;
    // Chart pixels: the plot rectangle and the overlay are both measured from the chart's own box.
    const local = (e: PointerEvent | MouseEvent): Point => { const r = (handle.current?.getDom() ?? el).getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const stop = () => {
      window.clearTimeout(timer); start = null; active = false; ready = false; setArmed(null); setDrag(null);
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", stop);
    };
    function move(e: PointerEvent) {
      if (!start || e.pointerId !== start.id) return;
      const p = local(e);
      if (!active) {
        const d = Math.max(Math.abs(p.x - start.x), Math.abs(p.y - start.y));
        // A finger that moves before the hold is up is scrolling the page.
        if (start.touch && !ready) { if (d > 8) stop(); return; }
        if (d < MIN_DRAG) return;
        active = true; setArmed(null);
      }
      setDrag({ a: { x: start.x, y: start.y }, b: p, grid: start.frame.grid });
    }
    function up(e: PointerEvent) {
      if (!start || e.pointerId !== start.id) return;
      const s = start, was = active, p = local(e);
      stop();
      if (!was) return;
      // The click that follows a drag must not pin a mark or close the card.
      swallow = performance.now();
      const box = pixelBoxToDomain(s, p, s.frame.grid, s.frame.x, s.frame.y, live.current.scale);
      if (box) act.current.zoomIn(box);
    }
    const down = (e: PointerEvent) => {
      const c = handle.current; cancelled = false;
      if (e.button !== 0 || !c || !(e.target instanceof Node) || !c.getDom().contains(e.target)) return;
      const frame = readFrame(c); if (!frame) return;
      const p = local(e); if (!inPlot(p, frame.grid)) return;
      const touch = e.pointerType === "touch";
      start = { ...p, id: e.pointerId, touch, frame };
      if (touch) timer = window.setTimeout(() => { if (start && !active) { ready = true; setArmed({ x: start.x, y: start.y }); navigator.vibrate?.(8); } }, 260);
      window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", stop);
    };
    // Once a touch drag is armed (or drawing), the page must not scroll under it.
    const touchmove = (e: TouchEvent) => { if (start && (ready || active)) e.preventDefault(); };
    const click = (e: MouseEvent) => { if (cancelled || performance.now() - swallow < 400) { cancelled = false; e.stopPropagation(); e.preventDefault(); } };
    // A long press that has not started drawing still opens the chart's menu.
    const menu = (e: MouseEvent) => { if (!start) return; if (active) { e.stopPropagation(); e.preventDefault(); } else stop(); };
    const dbl = (e: MouseEvent) => {
      const c = handle.current; if (!c || !(e.target instanceof Node) || !c.getDom().contains(e.target) || !live.current.stack.length) return;
      act.current.back();
    };
    // Runs before the expanded chart's own Escape, so a zoomed chart steps back first and the next press closes it.
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const drawing = !!start && (active || ready);
      if (start) stop();
      if (drawing) cancelled = true; // The button is still down: its release must not count as a click on the chart.
      else if (live.current.stack.length && !escapeTaken(e.target) && escapeTarget() === el) act.current.back();
      else return;
      e.preventDefault(); e.stopImmediatePropagation();
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("touchmove", touchmove, { passive: false });
    el.addEventListener("click", click, true);
    el.addEventListener("contextmenu", menu, true);
    el.addEventListener("dblclick", dbl);
    window.addEventListener("keydown", key, true);
    return () => {
      stop(); forget(el);
      el.removeEventListener("pointerdown", down); el.removeEventListener("touchmove", touchmove); el.removeEventListener("click", click, true);
      el.removeEventListener("contextmenu", menu, true); el.removeEventListener("dblclick", dbl); window.removeEventListener("keydown", key, true);
    };
  }, [enabled, host, handle]);

  /** The rubber band while dragging, and the hold ring for a finger. */
  const overlay: ReactNode = drag || armed ? (() => {
    const tint: CSSProperties = { position: "absolute", pointerEvents: "none", zIndex: 6, border: `1px solid ${pal.ink}`, background: `color-mix(in srgb, ${pal.ink} 8%, transparent)`, borderRadius: 2 };
    if (armed && !drag) return <div aria-hidden="true" style={{ ...tint, left: armed.x - 14, top: armed.y - 14, width: 28, height: 28, borderRadius: 14 }} />;
    const { a, b, grid: g } = drag!, cx = (v: number) => Math.min(g.x + g.width, Math.max(g.x, v)), cy = (v: number) => Math.min(g.y + g.height, Math.max(g.y, v));
    const x0 = Math.min(cx(a.x), cx(b.x)), x1 = Math.max(cx(a.x), cx(b.x)), y0 = Math.min(cy(a.y), cy(b.y)), y1 = Math.max(cy(a.y), cy(b.y));
    return <div aria-hidden="true" data-zoom-band="" style={{ ...tint, left: x0, top: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) }} />;
  })() : null;

  // The trail sits in the zoom line under the plot (ScoreScatter), not in the toolbar: the header is full (title, stars, key, share), so a
  // trail there had no room at laptop widths, and a line under the chart never wraps the toolbar or moves the chart.
  const level = (i: number) => {
    const word = i ? `Zoom ${i}` : "All";
    return i === stack.length ? <span className="text-ink" aria-current="step">{word}</span> : <button type="button" className="hover:text-ink" onClick={() => toLevel(i)}>{word}</button>;
  };
  const controls: ReactNode = enabled && !!stack.length && <nav aria-label="Zoom levels" title="Esc steps back" className="cap flex flex-wrap items-center gap-x-1">
    {level(0)}{stack.map((_, n) => <span key={n} className="flex items-center gap-1"><span aria-hidden="true">›</span>{level(n + 1)}</span>)}
  </nav>;

  // Where a drag can start, the chart takes text selection and the long-press callout out of the way.
  const surface: CSSProperties | undefined = enabled ? { userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" } : undefined;
  return { enabled, filter, range, zoomed: !!current, box: current, dragging: !!drag, overlay, controls, surface, reset };
}
