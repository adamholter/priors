"use client";
/* eslint-disable react-hooks/immutability -- the image follows the pointer from a frame loop on one mutable object, outside React. */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { ECharts } from "echarts";
import { IconCheck, IconLink, IconX } from "@tabler/icons-react";
import { LIBRARY_CHOICES, PAGE_PRESETS, THEME_CHOICES, themeById } from "@/lib/page-presets";
import { EDITOR_MIN, EDITOR_RATIOS, ratioOf, sizeForRatio, type EditorState, type EditorView } from "@/lib/export-editor";
import { HANDLES, PLACE_DEFAULT, cleanPlace, dragSize, fitCamera, imageSize, settleSize, snapTo, softSize, stepSpring, type Handle, type Insets, type Size, type Spring } from "@/lib/canvas-editor";
import { copyLink } from "@/lib/short-link";
import { FRAME_H, FRAME_W, placeGeometry, type ImagePlace } from "./export-frame";
import { labelScale } from "./label-size";
import { ChartPaletteContext, paletteFor, useChartPalette } from "./echarts";
import { ChartExport } from "./ChartExport";
import type { ScatterView } from "./scatter-option";
import "./canvas-editor.css";

type Place = Required<ImagePlace>;
type Kind = "title" | "plot" | "foot" | "names";
type Sel = { kind: Kind; text?: string } | null;
type Rect = { x: number; y: number; w: number; h: number };
type Snapshot = { size: Size; ratio: string; theme: string; title: string; over: EditorView; place: Place };
type Drag = { px: number; py: number; x0: number; y0: number; moved: boolean; from: Place } & (
  | { type: "image"; handle: Handle; grab: { x: number; y: number }; anchor: { x: number; y: number }; low: { x: number; y: number }; start: Size; keep?: number; alt: boolean; free: boolean }
  | { type: "move"; kind: "title" | "plot" | "foot"; hit: Sel; rect: Rect }
  | { type: "plot"; handle: Handle }
  | { type: "text"; kind: "title" | "foot"; handle: Handle; w0: number }
  | { type: "names"; scale: number }
  | { type: "click"; hit: Sel });

const THEMES = [{ id: "site", name: "Current page" }, ...[...THEME_CHOICES, PAGE_PRESETS.find((p) => p.id === "night")!].map((p) => ({ id: p.id, name: p.name }))], MORE_THEMES = LIBRARY_CHOICES.map((p) => ({ id: p.id, name: p.name }));
const PAD = 32, TOP = 54, ZONES: { id: Handle; label: string }[] = [{ id: "n", label: "top" }, { id: "e", label: "right" }, { id: "s", label: "bottom" }, { id: "w", label: "left" }, { id: "nw", label: "top left" }, { id: "ne", label: "top right" }, { id: "se", label: "bottom right" }, { id: "sw", label: "bottom left" }];
const INSETS: Insets = { top: 62, right: 44, bottom: 128, left: 44 }, CORNERS: Handle[] = ["nw", "ne", "se", "sw"], ALL: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"], clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const spring = (x: number): Spring => ({ x, v: 0 });
const TITLE_RISE = 5 / 6, TITLE_LINE = 13 / 12, FOOT_RISE = 8 / 11, FOOT_LINE = 14 / 11;

/**
 * The screenshot editor: the image is the interface. Its title, chart and footer can be picked up and moved or resized, the model names
 * scaled, and its edges dragged. Everything goes in the editor's state and link, and the PNG draws it from the same geometry.
 */
export default function CanvasEditor({ name, initial, base, showScale, onClose, link, plot, defaultScale = "linear", controls = "scatter", labBar, report }: {
  name: string; initial: EditorState; base: ScatterView; showScale: boolean; onClose: () => void; defaultScale?: "log" | "linear"; controls?: "scatter" | "rows"; labBar?: ReactNode;
  link?: (state: EditorState) => string; report: (state: EditorState) => void;
  plot: (view: ScatterView, height: number, chartRef: { current: ECharts | null }, shot: { width: number; svg: { current: (() => string | undefined) | null } }) => ReactNode;
}) {
  "use no memo";
  const dialog = useRef<HTMLDialogElement>(null), stage = useRef<HTMLDivElement>(null), world = useRef<HTMLDivElement>(null), card = useRef<HTMLDivElement>(null), plotEl = useRef<HTMLDivElement>(null), inner = useRef<HTMLDivElement>(null), titleEl = useRef<HTMLDivElement>(null), footEl = useRef<HTMLDivElement>(null);
  const frameEl = useRef<HTMLDivElement>(null), tagEl = useRef<HTMLDivElement>(null), selEl = useRef<HTMLDivElement>(null), hoverEl = useRef<HTMLDivElement>(null), gx = useRef<HTMLDivElement>(null), gy = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null), provided = useRef<(() => string | undefined) | null>(null);
  const getSvg = () => provided.current?.() ?? chartRef.current?.renderToSVGString();
  const [size, setSize] = useState<Size>(() => settleSize(initial, initial.ratio)), [place, setPlace] = useState<Place>(() => ({ ...PLACE_DEFAULT, ...initial.place }));
  const [drawn, setDrawn] = useState<Size>(() => ({ w: size.w + place.pw, h: size.h + place.ph }));
  const [ratio, setRatio] = useState(initial.ratio ?? "free"), [theme, setTheme] = useState(initial.theme ?? "site"), [title, setTitle] = useState(initial.title ?? ""), [over, setOver] = useState<EditorView>(initial.view ?? {});
  const [sel, setSel] = useState<Sel>(null), [editing, setEditing] = useState(false), [copied, setCopied] = useState(false), [dragging, setDragging] = useState(false);
  const site = useChartPalette(), preset = theme === "site" ? undefined : themeById(theme), pal = preset ? paletteFor(preset) : site;
  const view: ScatterView = { ...base };
  for (const [k, v] of Object.entries(over)) if (v !== undefined) (view as unknown as Record<string, unknown>)[k] = v;
  const heading = title.trim() || name, cleanedPlace = cleanPlace(place), placeKey = JSON.stringify(cleanedPlace);
  const state = useCallback((): EditorState => ({ ...size, ratio, theme: theme === "site" ? undefined : theme, title: title.trim() || undefined, heading: title.trim() || name, place: cleanedPlace,
    view: { scale: showScale ? view.scale : undefined, frontier: !!view.frontier, links: !!view.links, guides: view.guides !== false, density: view.density, labelScale: view.labelScale, allModels: view.allModels || undefined, paretoOnly: view.paretoOnly || undefined } }),
    [size, ratio, theme, title, name, showScale, placeKey, view.scale, view.frontier, view.links, view.guides, view.density, view.labelScale, view.allModels, view.paretoOnly]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { report(state()); }, [report, state]);
  useEffect(() => { const d = dialog.current; if (d && !d.open) d.showModal(); stage.current?.focus({ preventScroll: true }); }, []);

  const [m] = useState(() => ({ w: spring(size.w), h: spring(size.h), target: { ...size }, drawn: { ...drawn }, committing: false, pos: { x: 0, y: 0 }, L: { ...place }, cam: { x: spring(0), y: spring(0), s: spring(1) }, placed: false, drag: null as Drag | null, snap: "free", ratio: initial.ratio ?? "free", sel: null as Sel, hover: null as Sel, raf: 0, last: 0, reduced: false, chart: null as null | { grid?: Rect; names: string[] }, guide: { x: undefined as number | undefined, y: undefined as number | undefined } }));
  const [history] = useState<{ past: Snapshot[]; future: Snapshot[]; now: Snapshot }>(() => ({ past: [], future: [], now: { size, ratio, theme, title, over, place } }));
  useLayoutEffect(() => { m.sel = sel; kick(); });
  const snapshot = (): Snapshot => ({ size: { ...m.target }, ratio: m.ratio, theme, title, over, place: { ...m.L } });
  const remember = (next: Snapshot = snapshot()) => { if (JSON.stringify(next) === JSON.stringify(history.now)) return; history.past.push(history.now); if (history.past.length > 100) history.past.shift(); history.future = []; history.now = next; };
  const restore = (s: Snapshot) => { history.now = s; m.target = { ...s.size }; m.L = { ...s.place }; m.ratio = s.ratio; m.chart = null; setSize(s.size); setPlace(s.place); setRatio(s.ratio); setTheme(s.theme); setTitle(s.title); setOver(s.over); kick(); };
  const set = (patch: EditorView) => { const next = { ...over, ...patch }; setOver(next); m.chart = null; remember({ ...snapshot(), over: next }); };
  const setL = (patch: Partial<Place>) => { Object.assign(m.L, patch); setPlace({ ...m.L }); remember(); kick(); };
  const pickRatio = (id: string) => { const r = ratioOf(id); m.ratio = id; setRatio(id); if (r) { m.target = sizeForRatio(m.target.w, r); setSize({ ...m.target }); } remember(); kick(); };
  const pickTheme = (id: string) => { setTheme(id); remember({ ...snapshot(), theme: id }); };

  const fit = () => { const st = stage.current; return fitCamera(imageSize(m.target), { w: st?.clientWidth ?? 800, h: st?.clientHeight ?? 600 }, INSETS); };
  const point = (e: { clientX: number; clientY: number }) => { const b = stage.current!.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
  const imgW = () => m.w.x + FRAME_W, imgH = () => m.h.x + FRAME_H;
  /** The parts of the image, in image pixels. */
  const partRect = (k: "title" | "plot" | "foot"): Rect => {
    const g = placeGeometry(m.w.x + m.L.pw, m.h.x + m.L.ph, m.L);
    if (k === "plot") return { x: g.plot.x, y: g.plot.y, w: m.w.x + m.L.pw, h: m.h.x + m.L.ph };
    if (k === "title") return { x: g.title.x, y: g.title.y - g.title.size * TITLE_RISE, w: titleEl.current?.offsetWidth ?? 100, h: g.title.size * TITLE_LINE };
    return { x: g.foot.x, y: imgH() - 16 + m.L.fy - g.foot.size * FOOT_RISE, w: footEl.current?.offsetWidth ?? 80, h: g.foot.size * FOOT_LINE };
  };
  const toScreen = (r: Rect): Rect => { const s = m.cam.s.x; return { x: m.cam.x.x + (m.pos.x + r.x) * s, y: m.cam.y.x + (m.pos.y + r.y) * s, w: r.w * s, h: r.h * s }; };
  const inside = (p: { x: number; y: number }, r: Rect, pad = 0) => p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;
  const chartInfo = () => { if (m.chart) return m.chart; const c = chartRef.current; if (!c) return null; try { const series = (c.getOption() as { series?: { id?: string; data?: { name?: string }[] }[] }).series ?? [], rect = (c as unknown as { getModel(): { getComponent(t: string): { coordinateSystem?: { getRect(): { x: number; y: number; width: number; height: number } } } | undefined } }).getModel().getComponent("grid")?.coordinateSystem?.getRect(); m.chart = { grid: rect ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height } : undefined, names: (series.find((s) => s.id === "marks")?.data ?? []).flatMap((d) => d.name ? [d.name] : []) }; } catch { return null; } return m.chart; };
  const nameLabels = () => { const b = stage.current!.getBoundingClientRect(), info = chartInfo(), out: { text: string; r: Rect }[] = []; for (const el of plotEl.current?.querySelectorAll<SVGTextElement>("svg text") ?? []) { const t = el.textContent?.trim(), c = el.getBoundingClientRect(); if (!t || !c.width || (info?.names.length && !info.names.some((n) => n === t || n.startsWith(t) || t.startsWith(n)))) continue; out.push({ text: t, r: { x: c.left - b.left, y: c.top - b.top, w: c.width, h: c.height } }); } return out; };
  function hit(p: { x: number; y: number }): Sel | "image" | null {
    if (!inside(p, toScreen({ x: 0, y: 0, w: imgW(), h: imgH() }))) return null;
    if (inside(p, toScreen(partRect("title")), 4)) return { kind: "title" }; if (inside(p, toScreen(partRect("foot")), 4)) return { kind: "foot" };
    if (!inside(p, toScreen(partRect("plot")))) return "image";
    const l = nameLabels().find((x) => inside(p, x.r, 3)); return l ? { kind: "names", text: l.text } : { kind: "plot" };
  }
  const selRect = (t: NonNullable<Sel>): Rect => { if (t.kind !== "names") { const r = toScreen(partRect(t.kind)); return t.kind === "plot" ? r : { x: r.x - 4, y: r.y - 2, w: r.w + 8, h: r.h + 4 }; } const l = nameLabels(), a = l.find((x) => x.text === t.text) ?? l[0]; return a ? { x: a.r.x - 4, y: a.r.y - 2, w: a.r.w + 8, h: a.r.h + 4 } : toScreen(partRect("plot")); };
  const put = (el: HTMLElement | null, r: Rect | null) => { if (!el) return; el.dataset.on = r ? "1" : "0"; if (r) { el.style.transform = `translate3d(${r.x}px,${r.y}px,0)`; el.style.width = `${r.w}px`; el.style.height = `${r.h}px`; } };

  function dragFrame(d: Extract<Drag, { type: "image" }>, st: HTMLElement) {
    const [dx, dy] = HANDLES[d.handle], edge = 30; if ((dx > 0 && d.px > st.clientWidth - edge) || (dx < 0 && d.px < edge) || (dy > 0 && d.py > st.clientHeight - edge) || (dy < 0 && d.py < edge)) { m.cam.s.x = Math.max(.15, m.cam.s.x * .988); m.cam.s.v = 0; }
    const s = m.cam.s.x, k = d.alt ? 2 : 1, raw = { w: dx ? dx * (d.px + d.grab.x - d.anchor.x) / s * k : d.start.w, h: dy ? dy * (d.py + d.grab.y - d.anchor.y) / s * k : d.start.h };
    const { size: shaped, ratio: next } = dragSize(raw, d.handle, { ratio: m.ratio === "free" ? undefined : m.ratio, keep: d.keep, free: d.free }), soft = softSize(shaped);
    if (next !== m.snap) { m.snap = next; if (next !== "free" && !m.reduced) tagEl.current?.animate([{ scale: 1 }, { scale: 1.14 }, { scale: 1 }], { duration: 180, easing: "ease-out" }); }
    m.w.x = soft.w; m.h.x = soft.h; m.w.v = m.h.v = 0; const low = (a: number, l: number, dir: number, len: number) => d.alt ? a - len * s / 2 : dir > 0 ? a : dir < 0 ? a - len * s : l;
    m.pos.x = (low(d.anchor.x, d.low.x, dx, soft.w) - m.cam.x.x) / s - PAD; m.pos.y = (low(d.anchor.y, d.low.y, dy, soft.h) - m.cam.y.x) / s - TOP;
    const img = imageSize(settleSize(soft, next)); showTag(`${img.w} × ${img.h}${next !== "free" ? `  ${next}` : ""}`, d, st);
  }
  const showTag = (text: string, d: { px: number; py: number }, st: HTMLElement) => { const t = tagEl.current; if (t) { t.textContent = text; t.style.transform = `translate3d(${clamp(d.px + 14, 8, st.clientWidth - 140)}px,${clamp(d.py + 16, 8, st.clientHeight - 32)}px,0)`; } };
  /** Guides an edge can catch: the image's middle and margins, and the other parts' edges. */
  const guideLines = (skip: string) => { const W = imgW(), H = imgH(), xs = [PAD, W / 2, W - PAD], ys = [PAD, H / 2, H - PAD]; for (const k of ["title", "plot", "foot"] as const) if (k !== skip) { const r = partRect(k); xs.push(r.x, r.x + r.w); ys.push(r.y, r.y + r.h); } return { xs, ys }; };
  function dragPart(d: Drag, st: HTMLElement) {
    const s = m.cam.s.x, dx = (d.px - d.x0) / s, dy = (d.py - d.y0) / s, reach = 6 / s; m.guide = { x: undefined, y: undefined };
    if (d.type === "move") {
      const g = guideLines(d.kind), r = d.rect, sx = snapTo([r.x + dx, r.x + dx + r.w / 2, r.x + dx + r.w], g.xs, reach), sy = snapTo([r.y + dy, r.y + dy + r.h / 2, r.y + dy + r.h], g.ys, reach); m.guide = { x: sx.line, y: sy.line };
      const mx = clamp(dx + sx.shift, 24 - r.w - r.x, imgW() - 24 - r.x), my = clamp(dy + sy.shift, 16 - r.h - r.y, imgH() - 16 - r.y), key = d.kind === "title" ? ["tx", "ty"] as const : d.kind === "plot" ? ["px", "py"] as const : ["fx", "fy"] as const; m.L[key[0]] = d.from[key[0]] + mx; m.L[key[1]] = d.from[key[1]] + my;
    } else if (d.type === "plot") {
      const [hx, hy] = HANDLES[d.handle], g = guideLines("plot"), f = d.from, x0 = PAD + f.px, y0 = TOP + f.py, w0 = m.w.x + f.pw, h0 = m.h.x + f.ph; let ex = hx > 0 ? x0 + w0 + dx : x0 + dx, ey = hy > 0 ? y0 + h0 + dy : y0 + dy;
      if (hx) { const c = snapTo([ex], g.xs, reach); ex += c.shift; m.guide.x = c.line; } if (hy) { const c = snapTo([ey], g.ys, reach); ey += c.shift; m.guide.y = c.line; }
      const w = hx > 0 ? Math.max(EDITOR_MIN.w, ex - x0) : hx < 0 ? Math.max(EDITOR_MIN.w, x0 + w0 - ex) : w0, h = hy > 0 ? Math.max(EDITOR_MIN.h, ey - y0) : hy < 0 ? Math.max(EDITOR_MIN.h, y0 + h0 - ey) : h0;
      m.L.pw = w - m.w.x; m.L.ph = h - m.h.x; if (hx < 0) m.L.px = f.px + w0 - w; if (hy < 0) m.L.py = f.py + h0 - h; showTag(`${Math.round(w)} × ${Math.round(h)}`, d, st);
    } else if (d.type === "text") {
      const [hx, hy] = HANDLES[d.handle], sizeKey = d.kind === "title" ? "ts" : "fs", min = d.kind === "title" ? 12 : 8, max = d.kind === "title" ? 110 : 40, f = d.from, s0 = f[sizeKey], next = Math.round(clamp(s0 * Math.max(.1, (d.w0 + hx * dx) / d.w0), min, max)), k = next / s0;
      if (hx < 0) { if (d.kind === "title") m.L.tx = f.tx + d.w0 * (1 - k); else m.L.fx = f.fx + d.w0 * (1 - k); }
      if (d.kind === "title") { const top = (n: number, y: number) => y + (n - 24) * 14 / 24 - n * TITLE_RISE, line = (n: number) => n * TITLE_LINE, want = hy > 0 ? top(s0, f.ty) : top(s0, f.ty) + line(s0) - line(next); m.L.ts = next; m.L.ty = f.ty + want - top(next, f.ty); } else { const line = (n: number) => n * FOOT_LINE, rise = (n: number) => n * FOOT_RISE, want = hy > 0 ? -rise(s0) : -rise(s0) + line(s0) - line(next); m.L.fs = next; m.L.fy = f.fy + want + rise(next); }
      showTag(`${next}px`, d, st);
    }
  }
  function frame(now: number) {
    m.raf = 0; const st = stage.current; if (!st || !card.current || !world.current) return; const dt = Math.min(1 / 30, m.last ? (now - m.last) / 1000 : 1 / 60); m.last = now; let moving = false, d = m.drag;
    const go = (p: Spring, t: number, k: number, c: number, rest: number) => { if (m.reduced) { p.x = t; p.v = 0; } else if (!stepSpring(p, t, dt, k, c, rest)) moving = true; };
    if (!m.placed) { const f = fit(); m.cam.x.x = f.x; m.cam.y.x = f.y; m.cam.s.x = f.s; m.placed = true; }
    if (d?.type === "image") { moving = true; dragFrame(d, st); } else { go(m.w, m.target.w, 320, 27, .05); go(m.h, m.target.h, 320, 27, .05); const f = fit(); go(m.cam.x, f.x, 240, 28, .05); go(m.cam.y, f.y, 240, 28, .05); go(m.cam.s, f.s, 240, 28, .0005); if (d?.moved) { dragPart(d, st); d = m.drag; moving = true; } }
    const s = m.cam.s.x, L = m.L, W = imgW(), H = imgH(), pw = m.w.x + L.pw, ph = m.h.x + L.ph, g = placeGeometry(pw, ph, L), sx = pw / m.drawn.w, sy = ph / m.drawn.h, c = card.current.style;
    world.current.style.transform = `translate3d(${m.cam.x.x}px,${m.cam.y.x}px,0) scale(${s})`; c.left = `${m.pos.x}px`; c.top = `${m.pos.y}px`; c.width = `${W}px`; c.height = `${H}px`;
    if (plotEl.current) { plotEl.current.style.left = `${g.plot.x}px`; plotEl.current.style.top = `${g.plot.y}px`; }
    if (inner.current) inner.current.style.transform = Math.abs(sx - 1) < .001 && Math.abs(sy - 1) < .001 ? "" : `scale(${sx},${sy})`;
    if (titleEl.current) { const t = titleEl.current.style; t.left = `${g.title.x}px`; t.top = `${g.title.y - g.title.size * TITLE_RISE}px`; t.fontSize = `${g.title.size}px`; t.lineHeight = `${g.title.size * TITLE_LINE}px`; }
    if (footEl.current) { const t = footEl.current.style, y = H - 16 + L.fy; t.left = `${g.foot.x}px`; t.top = `${y - g.foot.size * FOOT_RISE}px`; t.fontSize = `${g.foot.size}px`; t.lineHeight = `${g.foot.size * FOOT_LINE}px`; }
    put(frameEl.current, toScreen({ x: 0, y: 0, w: W, h: H }));
    put(selEl.current, m.sel ? selRect(m.sel) : null); const hv = m.hover && !d && (m.hover.kind !== m.sel?.kind) ? m.hover : null; put(hoverEl.current, hv ? selRect(hv) : null);
    const top = toScreen({ x: 0, y: 0, w: W, h: H }), gxOn = d && m.guide.x != null, gyOn = d && m.guide.y != null; put(gx.current, gxOn ? { x: m.cam.x.x + (m.pos.x + m.guide.x!) * s, y: top.y, w: 1, h: top.h } : null); put(gy.current, gyOn ? { x: top.x, y: m.cam.y.x + (m.pos.y + m.guide.y!) * s, w: top.w, h: 1 } : null);
    const want = { w: Math.max(EDITOR_MIN.w, Math.round(settleSize({ w: m.w.x, h: m.h.x }, d?.type === "image" ? m.snap : m.ratio).w + L.pw)), h: Math.max(EDITOR_MIN.h, Math.round(settleSize({ w: m.w.x, h: m.h.x }, d?.type === "image" ? m.snap : m.ratio).h + L.ph)) };
    if (!m.committing && (Math.abs(want.w - m.drawn.w) >= 2 || Math.abs(want.h - m.drawn.h) >= 2 || (!moving && (want.w !== m.drawn.w || want.h !== m.drawn.h)))) { m.committing = true; m.chart = null; setDrawn(want); }
    if (moving || m.committing) m.raf = requestAnimationFrame(frame); else m.last = 0;
  }
  function kick() { if (!m.raf) { m.last = 0; m.raf = requestAnimationFrame(frame); } }
  useLayoutEffect(() => { m.drawn = { ...drawn }; m.committing = false; kick(); const t = setTimeout(() => { m.chart = null; kick(); }, 420); return () => clearTimeout(t); }, [drawn]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { m.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches; const st = stage.current; if (!st) return; const ro = new ResizeObserver(() => kick()); ro.observe(st); return () => { ro.disconnect(); cancelAnimationFrame(m.raf); m.raf = 0; }; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const begin = (e: React.PointerEvent, d: Drag, live = true) => { e.preventDefault(); e.stopPropagation(); stage.current?.setPointerCapture(e.pointerId); stage.current?.focus({ preventScroll: true }); m.drag = d; if (live) setDragging(true); kick(); };
  const base0 = (e: React.PointerEvent) => { const p = point(e); return { px: p.x, py: p.y, x0: p.x, y0: p.y, moved: false, from: { ...m.L } }; };
  const startImage = (e: React.PointerEvent, handle: Handle) => { const s = m.cam.s.x, [dx, dy] = HANDLES[handle], b = base0(e), r = { x: m.cam.x.x + (m.pos.x + PAD) * s, y: m.cam.y.x + (m.pos.y + TOP) * s, w: m.w.x * s, h: m.h.x * s }, img = imageSize({ w: m.w.x, h: m.h.x }); m.snap = m.ratio; begin(e, { ...b, moved: true, type: "image", handle, grab: { x: (dx > 0 ? r.x + r.w : r.x) - b.px, y: (dy > 0 ? r.y + r.h : r.y) - b.py }, anchor: { x: e.altKey ? r.x + r.w / 2 : dx > 0 ? r.x : r.x + r.w, y: e.altKey ? r.y + r.h / 2 : dy > 0 ? r.y : r.y + r.h }, low: { x: r.x, y: r.y }, start: { w: m.w.x, h: m.h.x }, keep: e.shiftKey ? img.w / img.h : undefined, alt: e.altKey, free: e.metaKey || e.ctrlKey }); };
  const startHandle = (e: React.PointerEvent, h: Handle) => { const k = sel?.kind, b = { ...base0(e), moved: true }; if (k === "plot") begin(e, { ...b, type: "plot", handle: h }); else if (k === "title" || k === "foot") begin(e, { ...b, type: "text", kind: k, handle: h, w0: partRect(k).w }); else if (k === "names") begin(e, { ...b, type: "names", scale: labelScale(view.labelScale) }); };
  const onDown = (e: React.PointerEvent) => { if (e.button || (e.target as HTMLElement).closest("button,select,input,label,[data-ui]")) return; const b = base0(e), t = hit({ x: b.px, y: b.py }); if (t && t !== "image" && t.kind !== "names") begin(e, { ...b, type: "move", kind: t.kind, hit: t, rect: partRect(t.kind) }, false); else begin(e, { ...b, type: "click", hit: t === "image" ? null : t }, false); };
  const onMove = (e: React.PointerEvent) => {
    const p = point(e), d = m.drag; if (!d) { if (e.pointerType === "mouse" && !(e.target as HTMLElement).closest("button,select,input,label,[data-ui]")) { const t = hit(p), h = t && t !== "image" ? t : null; if (h?.kind !== m.hover?.kind || h?.text !== m.hover?.text) { m.hover = h; if (stage.current) stage.current.dataset.hover = h?.kind ?? ""; kick(); } } return; }
    d.px = p.x; d.py = p.y; if (d.type === "names") { const v = Math.round(clamp(d.scale + ((p.x - d.x0) + (p.y - d.y0)) / 170, .75, 1.75) * 20) / 20; if (v !== over.labelScale) { setOver((o) => ({ ...o, labelScale: v })); m.chart = null; showTag(`${Math.round(v * 100)}%`, d, stage.current!); } }
    if (d.type === "move" && !d.moved && Math.hypot(p.x - d.x0, p.y - d.y0) >= 4) { d.moved = true; setSel(d.hit); setEditing(false); setDragging(true); } kick();
  };
  const onUp = () => {
    const d = m.drag; if (!d) return; m.drag = null; m.guide = { x: undefined, y: undefined }; setDragging(false);
    if (d.type === "image") { const s = m.cam.s.x; m.cam.x.x += m.pos.x * s; m.cam.y.x += m.pos.y * s; m.pos = { x: 0, y: 0 }; m.ratio = m.snap; setRatio(m.snap); m.target = settleSize({ w: m.w.x, h: m.h.x }, m.snap); setSize({ ...m.target }); remember(); }
    else if (d.type === "move" && !d.moved || d.type === "click") { const was = m.sel, t = d.hit; setSel(t); setEditing(t?.kind === "title" && was?.kind === "title"); }
    else { setPlace({ ...m.L }); remember(); } kick();
  };
  const onKey = (e: React.KeyboardEvent) => {
    const el = e.target as HTMLElement, k = e.key.toLowerCase(), typing = el.matches("input[type=text],select"); if ((e.metaKey || e.ctrlKey) && k === "z" && !typing) { e.preventDefault(); const from = e.shiftKey ? history.future : history.past, to = e.shiftKey ? history.past : history.future, s = from.pop(); if (s) { to.push(history.now); restore(s); } return; }
    if (typing || !e.key.startsWith("Arrow")) return; const n = e.shiftKey ? 10 : 1, x = e.key === "ArrowRight" ? n : e.key === "ArrowLeft" ? -n : 0, y = e.key === "ArrowDown" ? n : e.key === "ArrowUp" ? -n : 0, kind = sel?.kind;
    if (kind === "title") { e.preventDefault(); setL({ tx: m.L.tx + x, ty: m.L.ty + y }); } else if (kind === "foot") { e.preventDefault(); setL({ fx: m.L.fx + x, fy: m.L.fy + y }); } else if (kind === "plot") { e.preventDefault(); setL({ px: m.L.px + x, py: m.L.py + y }); }
    else if (el.dataset.zone) { e.preventDefault(); m.target = settleSize({ w: m.target.w + x, h: m.target.h + y }, m.ratio); setSize({ ...m.target }); remember(); kick(); }
  };
  const copy = async () => { if (!link) return; const url = link(state()); try { await copyLink(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { window.history.replaceState(null, "", url); } };

  const kind = sel?.kind, scatter = controls === "scatter", size100 = Math.round(labelScale(view.labelScale) * 100), scaleNow = view.scale ?? defaultScale;
  const check = (label: string, on: boolean, patch: (v: boolean) => EditorView) => <label className="xs-check"><input type="checkbox" checked={on} onChange={(e) => set(patch(e.target.checked))} />{label}</label>;
  const NameSize = <label className="xs-field">Name size<input type="range" aria-valuetext={`${size100}%`} min={75} max={175} step={5} value={size100} onChange={(e) => set({ labelScale: Number(e.target.value) / 100 })} /></label>;
  const NamesShown = scatter && <label className="xs-field">Names shown<input type="range" aria-valuetext={`${Math.round(view.density * 100)}%`} min={0} max={1} step={.05} value={view.density} onChange={(e) => set({ density: Number(e.target.value) })} /></label>;
  const reset = (patch: Partial<Place>) => <button type="button" className="xs-reset" onClick={() => setL(patch)}>Reset</button>;
  const textSize = (key: "ts" | "fs", min: number, max: number) => <label className="xs-field">Size<input type="range" aria-valuetext={`${place[key]}px`} min={min} max={max} value={place[key]} onChange={(e) => { const v = Number(e.target.value); m.L[key] = v; setPlace({ ...m.L }); kick(); }} onPointerUp={() => remember()} onKeyUp={() => remember()} /></label>;
  const bar = kind === "title" ? <><b>Title</b><input className="xs-text" type="text" aria-label="Title" value={title} placeholder={name} maxLength={120} onChange={(e) => setTitle(e.target.value)} onBlur={() => remember()} />{textSize("ts", 12, 110)}{reset({ tx: 0, ty: 0, ts: 24 })}</>
    : kind === "foot" ? <><b>Footer</b>{textSize("fs", 8, 40)}{reset({ fx: 0, fy: 0, fs: 11 })}</>
    : kind === "names" ? <><b>Model names</b>{NameSize}{NamesShown}</>
    : <>{kind === "plot" && <><b>Chart</b>{reset({ px: 0, py: 0, pw: 0, ph: 0 })}<span className="xs-rule" /></>}
      <label className="xs-field">Theme<select value={theme} onChange={(e) => pickTheme(e.target.value)}>{THEMES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}<optgroup label="More themes">{MORE_THEMES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup></select></label>
      {scatter && <>{check("Frontier", !!view.frontier, (v) => ({ frontier: v }))}{check("Effort lines", !!view.links, (v) => ({ links: v }))}{check("Guides", view.guides !== false, (v) => ({ guides: v }))}{showScale && <div className="seg xs-seg" role="group" aria-label="Scale">{(["log", "linear"] as const).map((s) => <button key={s} type="button" aria-pressed={scaleNow === s} onClick={() => set({ scale: s })}>{s === "log" ? "Log" : "Linear"}</button>)}</div>}</>}{NameSize}{NamesShown}</>;
  const handles = kind === "plot" ? ALL : kind === "title" || kind === "foot" ? (editing ? [] : CORNERS) : kind === "names" ? (["se"] as Handle[]) : [];

  return <dialog ref={dialog} className="xe xs" data-dragging={dragging ? "" : undefined} aria-label={`Edit ${name} screenshot`} onClose={onClose} onCancel={(e) => { if (editing) { e.preventDefault(); setEditing(false); stage.current?.focus(); } else if (sel) { e.preventDefault(); setSel(null); } }} onKeyDown={onKey}>
    <div ref={stage} className="xs-stage" tabIndex={-1} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <div ref={world} className="xs-world"><ChartPaletteContext.Provider value={pal}><div ref={card} className="xs-card" style={{ background: pal.bg, color: pal.ink }}>
        <div ref={plotEl} className="xs-plot" data-testid="xe-box"><div ref={inner} className="xs-inner" style={{ width: drawn.w, height: drawn.h }}>{plot(view, drawn.h, chartRef, { width: drawn.w, svg: provided })}</div></div>
        <div ref={titleEl} className="xs-title" style={{ fontFamily: "Newsreader, Georgia, serif" }}>{editing ? <input autoFocus data-ui aria-label="Title" value={title} placeholder={name} maxLength={120} size={Math.max(6, heading.length + 1)} onChange={(e) => setTitle(e.target.value)} onFocus={(e) => e.target.select()} onBlur={() => { setEditing(false); remember(); }} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); stage.current?.focus(); } }} /> : heading}</div>
        <div ref={footEl} className="xs-foot" style={{ color: pal.grey }}>mypriors.com</div>
      </div></ChartPaletteContext.Provider></div>
      <div ref={frameEl} className="xs-frame">{ZONES.map((z) => <button key={z.id} type="button" data-zone={z.id} aria-label={`Resize image from ${z.label}`} onPointerDown={(e) => startImage(e, z.id)} />)}</div>
      <div ref={gx} className="xs-guide" /><div ref={gy} className="xs-guide" /><div ref={hoverEl} className="xs-hover" />
      <div ref={selEl} className="xs-sel" data-kind={kind}>{handles.map((h) => <button key={h} type="button" data-ui data-handle={h} aria-label={`Resize ${kind} from ${h}`} onPointerDown={(e) => startHandle(e, h)} />)}</div>
      <div ref={tagEl} className="xs-tag" aria-hidden="true" />
      {labBar && <div className="xs-lab">{labBar}</div>}
      <div className="xs-actions"><ChartPaletteContext.Provider value={pal}><ChartExport name={name} title={heading} frame trim={false} place={cleanedPlace} getSvg={getSvg} /></ChartPaletteContext.Provider>{link && <button type="button" className="xe-copy" onClick={copy}>{copied ? <IconCheck size={14} aria-hidden="true" /> : <IconLink size={14} aria-hidden="true" />}{copied ? "Copied" : "Copy link"}</button>}<button type="button" className="xs-close" onClick={onClose} aria-label="Close editor"><IconX size={17} aria-hidden="true" /></button></div>
      <div className="xs-under" data-ui><div className="xs-shapes" role="group" aria-label="Image shape">{EDITOR_RATIOS.map((r) => <button key={r.id} type="button" aria-pressed={ratio === r.id} onClick={() => pickRatio(r.id)}><i style={r.r ? { width: r.r >= 1 ? 18 : 18 * r.r, height: r.r >= 1 ? 18 / r.r : 18 } : undefined} data-free={r.r ? undefined : ""} />{r.label}</button>)}</div><div className="xs-bar">{bar}</div></div>
    </div>
  </dialog>;
}
