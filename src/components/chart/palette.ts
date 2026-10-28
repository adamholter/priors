import type { ChartStyle, PagePreset } from "@/lib/page-presets";

/*
 * Chart colors with no chart library attached: the site theme (on every page) reads these, and importing
 * them from `theme.ts` used to load all of ECharts on pages without a chart.
 */
export const INK = "#1A1A1A", GREY = "#8A8A80", HAIR = "#ECEAE3", BONE = "#FBFBF9";
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

