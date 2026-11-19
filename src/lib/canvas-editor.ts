import { EDITOR_MAX, EDITOR_MIN, EDITOR_RATIOS, clampSize, sizeForRatio } from "./export-editor";
import { FRAME_H, FRAME_W, type ImagePlace } from "../components/chart/export-frame";

/** Geometry for the canvas screenshot editor. Sizes are the plot's, as in the editor's state; the image adds the frame. */
export interface Size { w: number; h: number }
export interface Insets { top: number; right: number; bottom: number; left: number }
export interface Camera { x: number; y: number; s: number }
export type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
export const HANDLES: Record<Handle, readonly [number, number]> = { nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0] };
export const imageSize = (s: Size): Size => ({ w: s.w + FRAME_W, h: s.h + FRAME_H });
const ratioValue = (id?: string) => EDITOR_RATIOS.find((r) => r.id === id)?.r;

/** Past a limit the edge keeps following the pointer, more and more reluctantly. */
export function rubber(v: number, lo: number, hi: number) {
  const pull = (d: number) => 90 * (1 - 1 / (d / 220 + 1));
  return v < lo ? lo - pull(lo - v) : v > hi ? hi + pull(v - hi) : v;
}
export const softSize = (s: Size): Size => ({ w: rubber(s.w, EDITOR_MIN.w, EDITOR_MAX), h: rubber(s.h, EDITOR_MIN.h, EDITOR_MAX) });

/** The preset the finished image is close enough to be pulled onto. */
export function nearRatio(s: Size, tolerance = 0.014): string | undefined {
  const { w, h } = imageSize(s), now = w / h; let best: string | undefined, gap = tolerance;
  for (const r of EDITOR_RATIOS) { if (!r.r) continue; const d = Math.abs(now / r.r - 1); if (d < gap) { gap = d; best = r.id; } }
  return best;
}
const heightFor = (w: number, r: number) => (w + FRAME_W) / r - FRAME_H, widthFor = (h: number, r: number) => (h + FRAME_H) * r - FRAME_W;

/**
 * What a drag means. A corner keeps a chosen shape, Shift keeps the shape the drag began with, an edge frees it. Otherwise the
 * size is pulled onto a nearby preset, along the axis being dragged.
 */
export function dragSize(raw: Size, handle: Handle, opts: { ratio?: string; keep?: number; free?: boolean } = {}): { size: Size; ratio: string } {
  const [dx, dy] = HANDLES[handle], corner = !!dx && !!dy, locked = corner ? opts.keep ?? ratioValue(opts.ratio) : opts.keep;
  if (locked) {
    const byWidth = !dy || (dx && (raw.w + FRAME_W) / locked >= raw.h + FRAME_H);
    const size = byWidth ? { w: raw.w, h: heightFor(raw.w, locked) } : { w: widthFor(raw.h, locked), h: raw.h };
    return { size, ratio: opts.keep ? nearRatio(size, 0.002) ?? "free" : opts.ratio ?? "free" };
  }
  const near = opts.free ? undefined : nearRatio(raw), r = ratioValue(near);
  if (!near || !r) return { size: raw, ratio: "free" };
  return { size: dy ? (dx ? { w: raw.w, h: heightFor(raw.w, r) } : { w: widthFor(raw.h, r), h: raw.h }) : { w: raw.w, h: heightFor(raw.w, r) }, ratio: near };
}
/** The size a finished drag settles on: inside the limits and exactly on its ratio. */
export const settleSize = (s: Size, ratio?: string): Size => { const r = ratioValue(ratio); return r ? sizeForRatio(s.w, r) : clampSize(s.w, s.h); };

/** The camera that centers an image in the free part of the canvas, never enlarging it. */
export function fitCamera(image: Size, view: Size, inset: Insets): Camera {
  const room = { w: Math.max(40, view.w - inset.left - inset.right), h: Math.max(40, view.h - inset.top - inset.bottom) };
  const s = Math.min(1, room.w / image.w, room.h / image.h);
  return { s, x: inset.left + (room.w - image.w * s) / 2, y: inset.top + (room.h - image.h * s) / 2 };
}
export interface Spring { x: number; v: number }
/** One step of a damped spring; returns true once it has come to rest on the target. */
export function stepSpring(p: Spring, target: number, dt: number, stiffness: number, damping: number, rest = 0.02) {
  p.v += (stiffness * (target - p.x) - damping * p.v) * dt; p.x += p.v * dt;
  if (Math.abs(target - p.x) < rest && Math.abs(p.v) < rest * 10) { p.x = target; p.v = 0; return true; }
  return false;
}

export const PLACE_DEFAULT: Required<ImagePlace> = { tx: 0, ty: 0, ts: 24, px: 0, py: 0, pw: 0, ph: 0, fx: 0, fy: 0, fs: 11 };
/** Only what differs from the standard layout, rounded, so an untouched image stores nothing. */
export function cleanPlace(p: Required<ImagePlace>): ImagePlace | undefined {
  const out: ImagePlace = {}; for (const k of Object.keys(PLACE_DEFAULT) as (keyof ImagePlace)[]) { const v = Math.round(p[k] * 10) / 10; if (v !== PLACE_DEFAULT[k]) out[k] = v; }
  return Object.keys(out).length ? out : undefined;
}
/** How far to shift so the closest of `edges` lands on one of `lines`, if any is within reach, and the line it landed on. */
export function snapTo(edges: number[], lines: number[], reach: number): { shift: number; line?: number } {
  let shift = 0, line: number | undefined, best = reach;
  for (const e of edges) for (const l of lines) { const d = Math.abs(l - e); if (d < best) { best = d; shift = l - e; line = l; } }
  return { shift, line };
}
