"use client";
import { useEffect, useRef } from "react";
import type { Lab } from "../../data/types";
import { modelLabel } from "../../lib/metrics";
import { MONO_STATIC, SANS_STATIC, markColor, markFill, markSize, textSize, type ChartPalette, type MarkFill } from "./theme-tokens";
import type { ScatterPoint } from "./scatter-option";

export interface ScaleMorphProps {
  fromScale: "log" | "linear";
  toScale: "log" | "linear";
  pts: ScatterPoint[];
  /** Pareto frontier marks, any order (sorted by x here). */
  frontier: ScatterPoint[];
  labs: Lab[];
  pal: ChartPalette;
  better: "lower" | "higher";
  xName: string;
  formatX: (x: number) => string;
  showLinks: boolean;
  showFrontier: boolean;
  /** Variant ids that carry a name label, in priority order (pickLabels). */
  labeledIds: Set<string>;
  width: number;
  height: number;
  /** The plot rectangle inside the canvas, in CSS pixels. */
  grid: { x: number; y: number; width: number; height: number };
  yMin: number;
  yMax: number;
  /** Domain bounds of the log axis (data units). */
  xMinLog: number;
  xMaxLog: number;
  /** Domain bounds of the linear axis (data units). */
  xMinLin: number;
  xMaxLin: number;
  /** Optional: where ECharts draws each mark on the starting scale (variant id to CSS px). t = 0 lands on these. */
  fromPixels?: Map<string, [number, number]>;
  /** Optional: where ECharts draws each mark on the ending scale (variant id to CSS px). t = 1 lands on these. */
  toPixels?: Map<string, [number, number]>;
  /** Called once, after the final frame is painted. The parent unmounts the layer here. */
  onDone: () => void;
}

const DURATION_MS = 900;
/** Fraction of the run over which the handoff to the ECharts pixels blends in at each end. */
const EDGE = 0.06;
const EPS = 1e-6;
/** Box-Cox linearity below this is the log transform itself. */
const LOG_EPS = 1e-4;
const LABEL_GAP = 6;

interface Pos { x: number; y: number }
interface Box { l: number; r: number; t: number; b: number }
interface Tick { v: number; alpha: number; x: number; text: string }

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Continuous Box-Cox: p = 1 is linear (v - 1), p = 0 is log. Clamped so zero-valued domain ends stay finite. */
function boxCox(v: number, p: number): number {
  const x = Math.max(EPS, v);
  return p < LOG_EPS ? Math.log(x) : (x ** p - 1) / p;
}

/** Canvas can't resolve CSS var() stacks, so keep the named families and fall back to the static stacks. */
function canvasStack(stack: string | undefined, fallback: string): string {
  const named = stack?.replace(/var\([^)]*\)\s*,?\s*/g, "").trim();
  return named || fallback;
}

/** Nice linear ticks (1, 2, 2.5, 5 times a power of ten) that land inside [lo, hi]. */
function linearTicks(lo: number, hi: number, count: number): number[] {
  const span = hi - lo;
  if (!(span > 0)) return [];
  const raw = span / count, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Number(v.toPrecision(12)));
  return out;
}

/** Log ticks at 1, 2 and 5 times each power of ten inside [lo, hi]. */
function logTicks(lo: number, hi: number): number[] {
  if (!(lo > 0) || !(hi > lo)) return [];
  const out: number[] = [];
  for (let k = Math.floor(Math.log10(lo)); k <= Math.ceil(Math.log10(hi)); k++) {
    for (const m of [1, 2, 5]) {
      const v = m * 10 ** k;
      if (v >= lo && v <= hi) out.push(v);
    }
  }
  return out;
}

const overlaps = (a: Box, b: Box, gap: number) => a.l < b.r + gap && b.l < a.r + gap && a.t < b.b + gap && b.t < a.b + gap;

/**
 * Canvas overlay for the Log <-> Linear switch. ECharts snaps its x axis, so this layer paints the same plot
 * on an opaque cover and glides every mark, link, frontier vertex and gridline through a Box-Cox transform
 * (p = 1 linear, p = 0 log) for 900ms. It keeps object permanence: each dot travels from where it was to where it is.
 */
export default function ScaleMorphLayer(props: ScaleMorphProps) {
  const { fromScale, toScale, pts, frontier, labs, pal, xName, formatX, showLinks, showFrontier, labeledIds, width, height, grid, yMin, yMax, xMinLog, xMaxLog, xMinLin, xMaxLin, fromPixels, toPixels } = props;
  const ref = useRef<HTMLCanvasElement>(null);
  // The parent often passes a fresh callback each render; it must not restart the animation.
  const doneRef = useRef(props.onDone);
  useEffect(() => {
    doneRef.current = props.onDone;
  }, [props.onDone]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      doneRef.current();
      return;
    }
    const cv = ref.current, ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(width * dpr); cv.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const t0 = textSize(pal), m = markSize(pal);
    const sans = canvasStack(pal.fonts?.sans, SANS_STATIC), mono = canvasStack(pal.fonts?.mono, MONO_STATIC);
    const colorOf = new Map(labs.map((l) => [l.id, markColor(l.color, pal, l.id)]));
    const colorFor = (p: ScatterPoint) => colorOf.get(p.r.model.labId) ?? pal.grey;
    const frontierIds = new Set(frontier.map((p) => p.r.variant.id));
    const frontierSorted = [...frontier].sort((a, b) => a.x - b.x);
    const byId = new Map(pts.map((p) => [p.r.variant.id, p]));
    const byModel = new Map<string, ScatterPoint[]>();
    for (const p of pts) (byModel.get(p.r.model.id) ?? byModel.set(p.r.model.id, []).get(p.r.model.id)!).push(p);
    const linkGroups = showLinks ? [...byModel.values()].filter((g) => g.length > 1).map((g) => [...g].sort((a, b) => a.x - b.x)) : [];
    const p0 = fromScale === "linear" ? 1 : 0, p1 = 1 - p0;
    const gridBottom = grid.y + grid.height, gridRight = grid.x + grid.width;
    const yAt = (score: number) => grid.y + grid.height * (1 - (score - yMin) / (yMax - yMin || 1));
    const yTicks = linearTicks(yMin, yMax, 5).filter((v) => v >= yMin && v <= yMax);
    const formatY = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
    const valuesFor = (scale: "log" | "linear", lo: number, hi: number) => (scale === "log" ? logTicks(lo, hi) : linearTicks(lo, hi, 6));
    const fromTickValues = valuesFor(fromScale, fromScale === "log" ? xMinLog : xMinLin, fromScale === "log" ? xMaxLog : xMaxLin);
    const toTickValues = valuesFor(toScale, toScale === "log" ? xMinLog : xMinLin, toScale === "log" ? xMaxLog : xMaxLin);

    const render = (t: number) => {
      const e = easeInOutCubic(t), p = p0 + (p1 - p0) * e;
      // Domain ends blend arithmetically, so they are exact at p = 0 (log) and p = 1 (linear).
      const lo = mix(xMinLog, xMinLin, p), hi = mix(xMaxLog, xMaxLin, p);
      const bcLo = boxCox(lo, p), span = Math.max(1e-9, boxCox(hi, p) - bcLo);
      const xAt = (v: number) => grid.x + ((boxCox(v, p) - bcLo) / span) * grid.width;
      // Handoff: near t = 0 pull each mark onto its ECharts start pixel, near t = 1 onto its end pixel.
      const e0 = clamp01(1 - t / EDGE), e1 = clamp01(1 - (1 - t) / EDGE);
      const place = (id: string, x: number, y: number): Pos => {
        let px = x, py = y;
        const f = fromPixels?.get(id);
        if (f && e0 > 0) { px = mix(px, f[0], e0); py = mix(py, f[1], e0); }
        const g = toPixels?.get(id);
        if (g && e1 > 0) { px = mix(px, g[0], e1); py = mix(py, g[1], e1); }
        return { x: px, y: py };
      };
      const pos = new Map<string, Pos>();
      for (const pt of pts) pos.set(pt.r.variant.id, place(pt.r.variant.id, xAt(pt.x), yAt(pt.r.score)));

      // Background cover: the ECharts chart underneath is hidden for the whole run.
      ctx.globalAlpha = 1;
      ctx.fillStyle = pal.bg;
      ctx.fillRect(0, 0, width, height);

      // Gridlines and x ticks. Fixed native tick sets glide and crossfade cleanly without generating phantom sub-domain ticks.
      const xTicks: Tick[] = [
        ...fromTickValues.map((v) => ({ v, alpha: 1 - e, x: xAt(v), text: formatX(v) })),
        ...toTickValues.map((v) => ({ v, alpha: e, x: xAt(v), text: formatX(v) })),
      ].filter((k) => k.x >= grid.x - 0.5 && k.x <= gridRight + 0.5).sort((a, b) => b.alpha - a.alpha);

      ctx.font = `${11 * t0}px ${mono}`;
      ctx.textBaseline = "middle";
      if (pal.style?.gridOff !== true) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = pal.hair;
        ctx.setLineDash(pal.style?.grid === "dotted" ? [1, 3] : []);
        for (const v of yTicks) {
          const y = Math.round(yAt(v)) + 0.5;
          ctx.beginPath(); ctx.moveTo(grid.x, y); ctx.lineTo(gridRight, y); ctx.stroke();
        }
        for (const k of xTicks) {
          if (k.alpha < 0.01) continue;
          ctx.globalAlpha = k.alpha;
          const x = Math.round(k.x) + 0.5;
          ctx.beginPath(); ctx.moveTo(x, grid.y); ctx.lineTo(x, gridBottom); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
      }
      // x-axis baseline.
      ctx.strokeStyle = pal.grey;
      ctx.globalAlpha = 0.45;
      ctx.beginPath(); ctx.moveTo(grid.x, Math.round(gridBottom) + 0.5); ctx.lineTo(gridRight, Math.round(gridBottom) + 0.5); ctx.stroke();
      ctx.globalAlpha = 1;

      // Y tick numbers, right-aligned at the plot edge.
      ctx.fillStyle = pal.grey;
      ctx.textAlign = "right";
      for (const v of yTicks) ctx.fillText(formatY(v), grid.x - 8, yAt(v));

      // X tick labels, placed greedily from the strongest tick down with generous clearance so labels never collide.
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const placed: Box[] = [];
      for (const k of xTicks) {
        if (k.alpha < 0.08) continue;
        const w = ctx.measureText(k.text).width;
        const box: Box = { l: k.x - w / 2, r: k.x + w / 2, t: gridBottom + LABEL_GAP, b: gridBottom + LABEL_GAP + 13 };
        if (placed.some((o) => overlaps(o, box, 20))) continue;
        placed.push(box);
        ctx.globalAlpha = k.alpha;
        ctx.fillText(k.text, k.x, box.t);
      }
      ctx.globalAlpha = 1;

      // X-axis title at the right end of the axis, as ECharts places it.
      ctx.font = `${11 * t0}px ${sans}`;
      ctx.textAlign = "right";
      ctx.fillText(xName, gridRight, gridBottom + 26 * t0);

      // Effort links between same-model variants.
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (const group of linkGroups) {
        const c = colorFor(group[0]);
        ctx.strokeStyle = c;
        ctx.globalAlpha = pal.dark ? 0.45 : 0.35;
        ctx.lineWidth = 1;
        ctx.beginPath();
        group.forEach((q, i) => { const a = pos.get(q.r.variant.id)!; if (i) ctx.lineTo(a.x, a.y); else ctx.moveTo(a.x, a.y); });
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Pareto frontier: the same vertices as the marks, so the curve flexes with them.
      if (showFrontier && frontierSorted.length > 1) {
        const dotted = pal.style?.frontier === "dotted";
        ctx.strokeStyle = pal.style?.frontierColor ?? pal.ink;
        ctx.lineWidth = dotted ? 1.6 : 1.4;
        ctx.setLineDash(dotted ? [2, 3] : []);
        ctx.beginPath();
        frontierSorted.forEach((q, i) => { const a = pos.get(q.r.variant.id)!; if (i) ctx.lineTo(a.x, a.y); else ctx.moveTo(a.x, a.y); });
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Marks: off-frontier first so frontier dots sit on top, as ScoreScatter draws them.
      const ordered = [...pts].sort((a, b) => Number(frontierIds.has(a.r.variant.id)) - Number(frontierIds.has(b.r.variant.id)));
      for (const pt of ordered) {
        const id = pt.r.variant.id, a = pos.get(id)!, onFrontier = frontierIds.has(id), est = !!pt.r.scoreEstimate;
        const c = colorFor(pt), radius = ((onFrontier ? 11 : 9) * m) / 2;
        ctx.beginPath(); ctx.arc(a.x, a.y, radius, 0, Math.PI * 2);
        // An estimated score draws as a ring: placed, not measured.
        ctx.fillStyle = est ? pal.bg : fillFor(ctx, c, pal, a.x, a.y, radius);
        ctx.fill();
        ctx.lineWidth = est ? 1.6 : 1.5;
        ctx.strokeStyle = est ? c : onFrontier ? pal.ink : pal.bg;
        ctx.stroke();
      }

      // Labels in priority order. A label takes its right slot, else its left one, and is dropped if both collide.
      ctx.font = `${11.5 * t0}px ${sans}`;
      ctx.textBaseline = "middle";
      const labelBoxes: Box[] = [];
      for (const id of labeledIds) {
        const pt = byId.get(id);
        if (!pt) continue;
        const a = pos.get(id)!, text = modelLabel(pt.r), w = ctx.measureText(text).width, h = 11.5 * t0 * 1.2;
        const radius = ((frontierIds.has(id) ? 11 : 9) * m) / 2, offset = radius + 7;
        const right: Box = { l: a.x + offset, r: a.x + offset + w, t: a.y - h / 2, b: a.y + h / 2 };
        const left: Box = { l: a.x - offset - w, r: a.x - offset, t: right.t, b: right.b };
        const pick = [right, left].find((b) => b.l >= 2 && b.r <= width - 4 && !labelBoxes.some((o) => overlaps(o, b, 2)));
        if (!pick) continue;
        labelBoxes.push(pick);
        ctx.textAlign = pick === right ? "left" : "right";
        ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.strokeStyle = pal.bg;
        const tx = pick === right ? right.l : left.r;
        ctx.strokeText(text, tx, a.y);
        ctx.fillStyle = pal.ink;
        ctx.fillText(text, tx, a.y);
      }
    };

    render(0);
    let frame = 0, start: number | null = null;
    const tick = (now: number) => {
      start ??= now;
      const t = Math.min(1, (now - start) / DURATION_MS);
      render(t);
      if (t < 1) frame = requestAnimationFrame(tick);
      else doneRef.current();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // Every value the frames read. onDone is held in a ref and never restarts the run.
  }, [fromScale, toScale, pts, frontier, labs, pal, xName, formatX, showLinks, showFrontier, labeledIds, width, height, grid, yMin, yMax, xMinLog, xMaxLog, xMinLin, xMaxLin, fromPixels, toPixels]);

  return <canvas ref={ref} aria-hidden style={{ position: "absolute", left: 0, top: 0, width, height, background: pal.bg, pointerEvents: "auto", zIndex: 2 }} />;
}

/** A mark's canvas fill: flat lab color, or the spectrogram radial glow some page themes use. */
function fillFor(ctx: CanvasRenderingContext2D, color: string, pal: ChartPalette, cx: number, cy: number, r: number): string | CanvasGradient {
  const fill: MarkFill = markFill(color, pal, "dot");
  if (typeof fill === "string") return fill;
  if (fill.type !== "radial") return color;
  // ECharts' radial fill is in the mark's 0..1 bounding box, so map its centre and radius onto the canvas.
  const size = 2 * r, gradient = ctx.createRadialGradient(cx - r + size * fill.x, cy - r + size * fill.y, 0, cx - r + size * fill.x, cy - r + size * fill.y, size * fill.r);
  for (const stop of fill.colorStops) gradient.addColorStop(stop.offset, stop.color);
  return gradient;
}
