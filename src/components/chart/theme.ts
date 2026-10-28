import * as echarts from "echarts/core";
import { LineChart, ScatterChart, BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent, DatasetComponent, MarkLineComponent, MarkAreaComponent, GraphicComponent, DataZoomComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { LabelLayout, UniversalTransition } from "echarts/features";
import type { ChartStyle, PagePreset } from "@/lib/page-presets";

echarts.use([LineChart, ScatterChart, BarChart, GridComponent, TooltipComponent, DatasetComponent, MarkLineComponent, MarkAreaComponent, GraphicComponent, DataZoomComponent, SVGRenderer, LabelLayout, UniversalTransition]);

export const INK = "#1A1A1A", GREY = "#8A8A80", HAIR = "#ECEAE3", BONE = "#FBFBF9";
const SANS = "var(--font-inter), Inter, system-ui, sans-serif";
const MONO = "var(--font-jetbrains), 'JetBrains Mono', Menlo, monospace";
/** Font stacks without CSS variables — for SSR rasterization, where var() cannot resolve. */
export const SANS_STATIC = "Inter, system-ui, sans-serif";
export const MONO_STATIC = "'JetBrains Mono', Menlo, monospace";

/** Colors every chart reads: the site's light palette by default, a page's scheme when it provides one. */
export interface ChartPalette {
  dark: boolean; ink: string; ink2: string; grey: string; hair: string; bg: string; tipBg: string; tipBorder: string;
  /** Page-theme overrides: chart fonts, per-lab mark colors, and chart treatment (grid, frontier, quadrant, bar labels). */
  fonts?: { sans: string; mono: string }; labColors?: Record<string, string>; style?: ChartStyle;
  /** Chart scale: text, marks, plot height and ranking row pitch, as multipliers (default 1). */
  size?: ChartSize;
}
export interface ChartSize { text?: number; mark?: number; height?: number; row?: number }
export const textSize = (pal: ChartPalette) => pal.size?.text ?? 1;
export const markSize = (pal: ChartPalette) => pal.size?.mark ?? 1;
export const LIGHT_PALETTE: ChartPalette = { dark: false, ink: INK, ink2: "#595B53", grey: GREY, hair: HAIR, bg: BONE, tipBg: "#FFFFFF", tipBorder: "#DDDBD4" };
/** Site dark mode: warm near-black page, off-white ink, gridlines just above the background. */
export const DARK_PALETTE: ChartPalette = { dark: true, ink: "#EDECE6", ink2: "#C2C1B9", grey: "#8C8B83", hair: "#262624", bg: "#141413", tipBg: "#1F1F1C", tipBorder: "#3A3A35" };

/**
 * Lab colors tuned for dark backgrounds. Each keeps its light hue but is lifted to OKLab L 0.64–0.84
 * (light-mode lightness order preserved) with chroma matched, so marks hold ≥3:1 against the page and
 * every pair stays at least as distinct as the light set (closest pair ΔE 6.7 vs 6.0 in light).
 * Neutral labs mirror their light order (OpenAI, the darkest, becomes the lightest grey — a step below
 * ink so frontier marks still stand out and big bars don't glare); the unbranded grey dims so it recedes.
 */
export const DARK_LAB_COLORS: Record<string, string> = {
  "anthropic": "#EA8A73",
  "openai": "#BDBCB4",
  "google": "#67A7F8",
  "meta": "#4EC9B2",
  "xai": "#AF82F7",
  "deepseek": "#6B81F0",
  "alibaba": "#E06DC7",
  "moonshot": "#88BE57",
  "mistral": "#FFA559",
  "zhipu": "#7E7D76",
  "minimax": "#F7C160",
  "xiaomi": "#B9855E",
  "cognition": "#67A48D",
  "thinking-machines": "#A999D8",
  "tencent": "#4DADC6",
  "cursor": "#9C9B93",
  "other": "#66655F",
};

const chartPalettes = new Map<string, ChartPalette>();
/** Page preset → chart palette (IndexPage and share cards share this). */
export function paletteFor(preset: PagePreset): ChartPalette {
  let p = chartPalettes.get(preset.id);
  // Night is the site's dark mode on a raised panel: same chart palette, gridlines tuned to the panel.
  if (!p && preset.id === "night") { p = { ...DARK_PALETTE, bg: preset.hair2, hair: "#2B2B28", tipBg: "#242422" }; chartPalettes.set(preset.id, p); }
  if (!p && (preset.family === "aa" || preset.family === "slop" || preset.library)) {
    // Lookalike themes restyle charts completely: their fonts, lab colors, grids and frontier treatment.
    const surface = preset.surface ?? preset.bg;
    p = { dark: preset.dark, ink: preset.ink, ink2: preset.ink2, grey: preset.grey, hair: preset.dark ? preset.hair : preset.hair, bg: surface, tipBg: preset.dark ? preset.hair2 : "#FFFFFF", tipBorder: preset.hair,
      fonts: preset.fonts && { sans: preset.fonts.sans, mono: preset.fonts.mono }, labColors: preset.labColors, style: preset.chart };
    chartPalettes.set(preset.id, p);
  }
  if (!p) { p = preset.dark ? { dark: true, ink: preset.ink, ink2: preset.ink2, grey: preset.grey, hair: preset.hair, bg: preset.hair2, tipBg: preset.bg, tipBorder: preset.hair } : { ...LIGHT_PALETTE, bg: preset.bg }; chartPalettes.set(preset.id, p); }
  return p;
}

const luminance = (hex: string) => { const m = hex.replace("#", "").match(/.{2}/g); if (!m || m.length < 3) return 1; const [r, g, b] = m.slice(0, 3).map((x) => { const c = parseInt(x, 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** A lab's mark color for this palette: the tuned dark variant on dark pages; unknown labs fall back
 *  to their light color, with near-black ones switched to the palette's soft ink so they don't vanish. */
export function markColor(color: string | undefined, pal: ChartPalette, labId?: string) {
  const themed = labId && pal.labColors ? pal.labColors[labId] ?? pal.labColors.other : undefined;
  if (themed) return themed;
  const c = color ?? "#A3A39B";
  if (!pal.dark) return c;
  return (labId && DARK_LAB_COLORS[labId]) ?? (luminance(c) < 0.06 ? pal.ink2 : c);
}

/**
 * Axis labels (rotated bar categories, long tick text) are laid out against fixed grid margins, so a
 * long first label used to run past the canvas edge and get clipped. Every grid merges this: the plot
 * shrinks just enough that axis labels stay inside the canvas, and keeps its margins otherwise.
 */
export const CONTAIN_AXIS_LABELS = { outerBounds: { left: 10, right: 4, top: 2, bottom: 4 }, outerBoundsContain: "all" as const };

/**
 * Series labels (point names on scatters) are not part of the grid, so outerBounds can't hold them.
 * This labelLayout flips a label to the left of its mark when it would cross the right edge, and
 * nudges it down when it would cross the top. `width` is read at layout time (charts resize).
 */
export function insideLabels(width: () => number | undefined, opts: { moveOverlap?: boolean } = {}) {
  return (p: { rect: { x: number; y: number; width: number; height: number }; labelRect: { x: number; y: number; width: number; height: number } }) => {
    const w = width(), r = p.labelRect, out: Record<string, unknown> = { hideOverlap: true, ...(opts.moveOverlap === false ? {} : { moveOverlap: "shiftY" }) };
    if (w && r.x + r.width > w - 4) { out.x = p.rect.x - 6; out.align = "right"; }
    if (r.y < 2) out.y = 2 + r.height / 2;
    return out;
  };
}

/** HearingBench's magma ends: the cool purple a spectrogram starts from and the warm peach it peaks at. */
const SPECTRO_COOL = "#8F2A81", SPECTRO_HOT = "#FDB07B";
const mixHex = (a: string, b: string, t: number) => { const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)), x = p(a), y = p(b); return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
export type MarkFill = string | { type: "linear"; x: number; y: number; x2: number; y2: number; colorStops: { offset: number; color: string }[] } | { type: "radial"; x: number; y: number; r: number; colorStops: { offset: number; color: string }[] };
/**
 * A mark's fill. Flat lab color by default; under `fill: "spectrogram"` (HearingBench) the lab color
 * becomes a heat ramp like a spectrogram band: it starts deep (pulled toward magma purple) at the
 * bar's base, holds the lab's own color through the middle, and burns toward peach at the tip, with
 * faint harmonic bands along the way. Scatter dots glow hot at the center. Labs stay recognizable.
 */
export function markFill(c: string, pal: ChartPalette, dir: "up" | "right" | "dot" = "up"): MarkFill {
  const stops = spectrogramStops(c, pal);
  if (!stops) return c;
  if (dir === "dot") return { type: "radial", x: 0.38, y: 0.36, r: 0.7, colorStops: [{ offset: 0, color: stops.at(-1)!.color }, { offset: 0.45, color: c }, { offset: 1, color: stops[0].color }] };
  return dir === "up" ? { type: "linear", x: 0, y: 1, x2: 0, y2: 0, colorStops: stops } : { type: "linear", x: 0, y: 0, x2: 1, y2: 0, colorStops: stops };
}
/** The same fill as a CSS background (HTML ranking bars), left to right. */
export function markFillCss(c: string, pal: ChartPalette): string {
  const stops = spectrogramStops(c, pal);
  return stops ? `linear-gradient(90deg, ${stops.map((s) => `${s.color} ${(s.offset * 100).toFixed(1)}%`).join(", ")})` : c;
}
/** The same fill as an SVG <linearGradient> (left to right) for hand-built export SVGs; undefined when flat. */
export function markFillSvg(id: string, c: string, pal: ChartPalette): string | undefined {
  const stops = spectrogramStops(c, pal);
  return stops && `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">${stops.map((s) => `<stop offset="${s.offset.toFixed(3)}" stop-color="${s.color}"/>`).join("")}</linearGradient>`;
}
function spectrogramStops(c: string, pal: ChartPalette): { offset: number; color: string }[] | undefined {
  if (pal.style?.fill !== "spectrogram" || !/^#[0-9a-f]{6}$/i.test(c)) return undefined;
  const deep = mixHex(mixHex(c, SPECTRO_COOL, 0.45), pal.dark ? "#000000" : "#1D1730", 0.25), hot = mixHex(mixHex(c, "#FFFFFF", 0.42), SPECTRO_HOT, 0.18);
  const at = (t: number) => t < 0.5 ? mixHex(deep, c, t / 0.5) : mixHex(c, hot, (t - 0.5) / 0.5);
  // Harmonic banding: alternate brighter and dimmer stripes, tighter toward the hot end, as overtones crowd together.
  const stops: { offset: number; color: string }[] = [], N = 9, pos = (i: number) => 1 - (1 - i / N) ** 1.35;
  for (let i = 0; i <= N; i++) {
    stops.push({ offset: pos(i), color: at(pos(i)) });
    if (i < N) stops.push({ offset: pos(i + 0.5), color: mixHex(at(pos(i + 0.5)), pal.dark ? "#000000" : "#FFFFFF", pal.dark ? 0.16 : 0.12) });
  }
  return stops;
}

/** A lab color pushed toward the palette's neutral: how non-highlighted marks recede. */
export function dimColor(color: string | undefined, pal: ChartPalette, amount = 0.72) {
  const neutral = pal.dark ? "#55554F" : "#C4C3BB", c = color && /^#[0-9a-f]{6}$/i.test(color) ? color : neutral;
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)), a = p(c), b = p(neutral);
  return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, "0")).join("");
}

export const markLabel = (pal: ChartPalette) => ({ show: true, position: "right" as const, formatter: "{b}", fontSize: 11.5, color: pal.ink, opacity: 1, distance: 7, textBorderColor: pal.bg, textBorderWidth: 3 });

const registered = new Set<string>();
export function themeFor(pal: ChartPalette, fonts?: { sans?: string; mono?: string }) {
  const sans = fonts?.sans ?? pal.fonts?.sans ?? SANS, mono = fonts?.mono ?? pal.fonts?.mono ?? MONO, grid = pal.style?.grid === "dotted" ? "dotted" : "solid";
  const t = textSize(pal), name = `priors-${[pal.ink, pal.grey, pal.hair, pal.tipBg, sans, mono, grid, t === 1 ? "" : t].join("").replace(/[^a-z0-9]/gi, "")}`;
  if (!registered.has(name)) {
    registered.add(name);
    const axis = { axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: pal.grey, fontFamily: mono, fontSize: 11 * t } };
    echarts.registerTheme(name, {
      backgroundColor: "transparent",
      textStyle: { fontFamily: sans, color: pal.ink },
      categoryAxis: { ...axis, splitLine: { show: false } },
      valueAxis: { ...axis, splitLine: { lineStyle: { color: pal.hair, type: grid } } },
      logAxis: { ...axis, splitLine: { lineStyle: { color: pal.hair, type: grid } } },
      timeAxis: { ...axis, splitLine: { lineStyle: { color: pal.hair, type: grid } } },
      tooltip: { confine: true, backgroundColor: pal.tipBg, borderColor: pal.tipBorder, borderWidth: 1, textStyle: { color: pal.ink, fontSize: 12 * t, fontFamily: sans }, extraCssText: "box-shadow:none;border-radius:4px;padding:8px 10px" },
    });
  }
  return name;
}
themeFor(LIGHT_PALETTE);
themeFor(DARK_PALETTE);

export { echarts, MONO, SANS };
