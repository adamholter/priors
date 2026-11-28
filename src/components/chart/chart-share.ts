import { embedFonts } from "./embed-fonts";
import { frameSvg, trimRight, type ImagePlace } from "./export-frame";
import type { ChartPalette } from "./palette";

export type ExportRow = Record<string, string | number | boolean | null | undefined>;
export type ChartExportFormat = "png" | "svg" | "csv" | "json" | "html";
/** What a chart's toolbar exposes to its right-click menu: the same actions, run by the same code. */
export type ChartShareHandle = {
  download: (format: ChartExportFormat) => Promise<void>; formats: ChartExportFormat[];
  copyImage: () => Promise<boolean>; copyLink: () => Promise<void>; edit?: () => void; hasLink: boolean; native: boolean;
  /** Rows the data formats would hold, -1 when the chart has none to export. Counted on demand. */
  rows: () => number;
};
/** What a toolbar needs to draw and export a chart. */
export type ShareSource = { name: string; title?: string; trim?: boolean; place?: ImagePlace; frame?: boolean; getSvg: () => string | undefined };
export type ShareKind = ChartExportFormat | "image" | "link";

export const LOADING = "Chart is still loading. Try again.";
/** What the toolbar says after each action. */
export const SAVED: Record<ShareKind, string> = { png: "PNG saved", svg: "SVG saved", html: "HTML saved", csv: "CSV saved", json: "JSON saved", image: "Image copied", link: "Link copied" };

/** File name without extension: `priors-<chart name>`. */
export const fileStem = (name: string) => `priors-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

export function toCsv(rows: ExportRow[]) {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v: ExportRow[string]) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [keys.join(","), ...rows.map((r) => keys.map((k) => cell(r[k])).join(","))].join("\n");
}

/** The hint beside a data format: "55 rows", or nothing when the chart has no rows to count. */
export const rowsHint = (n: number) => (n < 0 ? "" : `${n.toLocaleString("en-US")} ${n === 1 ? "row" : "rows"}`);

/** Short fingerprint of a string, so a rendered PNG is reused only while the chart looks the same. */
export function fingerprint(s: string) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return `${s.length}:${h}`; }

/** Wording for the right-click menu's undo row: names the last effort or model hidden, and counts when several are. */
export const undoLabel = (hidden: number, latest?: string) => (hidden > 1 ? `Undo hide (${hidden})` : latest ? `Undo hide ${latest}` : "Undo hide");

/** Where a menu opens: at the pointer, shifted left to stay clear of the right gutter and up to stay on screen, so the pointer stays inside it. */
export function menuPlace(x: number, y: number, w: number, h: number, vw: number, vh: number, gutter = 8) {
  return { left: Math.max(gutter, Math.min(x, vw - w - gutter)), top: Math.max(gutter, Math.min(y + 2, vh - h - gutter)) };
}

/** Single keys on the focused plot. Returns the action a key runs, or null. C works with Cmd or Ctrl held too; the rest do not, so browser shortcuts keep working. */
export type PlotAction = "copy" | "save" | "link" | "edit" | "expand";
export function plotAction(key: string, mod: boolean): PlotAction | null {
  const k = key.toLowerCase();
  if (k === "c") return "copy";
  if (mod) return null;
  return k === "s" ? "save" : k === "l" ? "link" : k === "e" ? "edit" : k === "x" ? "expand" : null;
}

/** The framed chart as an SVG string, fonts not yet inlined. */
export function framedSvg(p: ShareSource, pal: ChartPalette): string | undefined {
  const raw = p.getSvg();
  if (!raw) return undefined;
  // Exports cannot inherit the page's CSS variables.
  const clean0 = raw.replace(/var\(--font-[a-z0-9-]+\),?\s*/g, "");
  const clean = p.trim ?? true ? trimRight(clean0) : clean0;
  return p.frame ? frameSvg(clean, p.title || p.name, undefined, pal, p.place ? { place: p.place } : undefined) : clean;
}

/** SVG to a 3x PNG on the palette's background. Fonts are inlined first, so a theme's typeface survives. */
export async function renderPng(svgText: string, bg: string): Promise<Blob> {
  const svg = await embedFonts(svgText);
  const source = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image(); img.src = source; await img.decode();
    // Fonts inlined in the SVG can land a frame after decode (Safari): give them one before drawing.
    await new Promise((r) => setTimeout(r, 60));
    const canvas = document.createElement("canvas");
    // Keep long expanded rankings within browser canvas limits.
    const scale = Math.min(3, 16000 / Math.max(img.width, img.height));
    canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image export is unavailable.");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Image export failed."))), "image/png"));
  } finally { URL.revokeObjectURL(source); }
}

/** The SVG file: framed, with fonts inlined. */
export async function renderSvg(source: ShareSource, pal: ChartPalette): Promise<Blob> {
  await document.fonts.ready;
  const svg = framedSvg(source, pal);
  if (!svg) throw new Error(LOADING);
  return new Blob([await embedFonts(svg)], { type: "image/svg+xml;charset=utf-8" });
}

/** A phone or tablet whose share sheet can take a PNG file. */
export function canShareFiles() {
  try {
    if (typeof navigator.canShare !== "function" || typeof navigator.share !== "function") return false;
    if (!window.matchMedia("(pointer: coarse)").matches) return false;
    return navigator.canShare({ files: [new File(["x"], "x.png", { type: "image/png" })] });
  } catch { return false; }
}

/** Saves a blob as a file through a temporary link. */
export function saveBlob(blob: Blob, name: string, ext: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `${fileStem(name)}.${ext}`;
  a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
