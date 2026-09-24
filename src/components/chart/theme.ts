import * as echarts from "echarts/core";
import { LineChart, ScatterChart, BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent, DatasetComponent, MarkLineComponent, GraphicComponent, DataZoomComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { LabelLayout, UniversalTransition } from "echarts/features";
import type { PagePreset } from "@/lib/page-presets";

echarts.use([LineChart, ScatterChart, BarChart, GridComponent, TooltipComponent, DatasetComponent, MarkLineComponent, GraphicComponent, DataZoomComponent, SVGRenderer, LabelLayout, UniversalTransition]);

export const INK = "#1A1A1A", GREY = "#8A8A80", HAIR = "#ECEAE3", BONE = "#FBFBF9", INDIGO = "#2F4FB0";
const SANS = "var(--font-inter), Inter, system-ui, sans-serif";
const MONO = "var(--font-jetbrains), 'JetBrains Mono', Menlo, monospace";
/** Font stacks without CSS variables — for SSR rasterization, where var() cannot resolve. */
export const SANS_STATIC = "Inter, system-ui, sans-serif";
export const MONO_STATIC = "'JetBrains Mono', Menlo, monospace";

/** Colors every chart reads: the site's light palette by default, a page's scheme when it provides one. */
export interface ChartPalette { dark: boolean; ink: string; ink2: string; grey: string; hair: string; bg: string; tipBg: string; tipBorder: string }
export const LIGHT_PALETTE: ChartPalette = { dark: false, ink: INK, ink2: "#595B53", grey: GREY, hair: HAIR, bg: BONE, tipBg: "#FFFFFF", tipBorder: "#DDDBD4" };

const chartPalettes = new Map<string, ChartPalette>();
/** Page preset → chart palette (IndexPage and share cards share this). */
export function paletteFor(preset: PagePreset): ChartPalette {
  let p = chartPalettes.get(preset.id);
  if (!p) { p = preset.dark ? { dark: true, ink: preset.ink, ink2: preset.ink2, grey: preset.grey, hair: preset.hair, bg: preset.hair2, tipBg: preset.bg, tipBorder: preset.hair } : { ...LIGHT_PALETTE, bg: preset.bg }; chartPalettes.set(preset.id, p); }
  return p;
}

const luminance = (hex: string) => { const m = hex.replace("#", "").match(/.{2}/g); if (!m || m.length < 3) return 1; const [r, g, b] = m.slice(0, 3).map((x) => { const c = parseInt(x, 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** Near-black lab colors (e.g. OpenAI) vanish on dark pages; they switch to the palette's soft ink there. */
export function markColor(color: string | undefined, pal: ChartPalette) { const c = color ?? "#A3A39B"; return pal.dark && luminance(c) < 0.06 ? pal.ink2 : c; }

export const markLabel = (pal: ChartPalette) => ({ show: true, position: "right" as const, formatter: "{b}", fontSize: 11.5, color: pal.ink, opacity: 1, distance: 7, backgroundColor: pal.bg + "B8", padding: [2, 3], borderRadius: 2, textBorderColor: pal.bg + "D9", textBorderWidth: 2 });
export const MARK_LABEL = markLabel(LIGHT_PALETTE);

const registered = new Set<string>();
export function themeFor(pal: ChartPalette, fonts?: { sans?: string; mono?: string }) {
  const sans = fonts?.sans ?? SANS, mono = fonts?.mono ?? MONO;
  const name = `priors-${[pal.ink, pal.grey, pal.hair, pal.tipBg, sans, mono].join("").replace(/[#\s]/g, "")}`;
  if (!registered.has(name)) {
    registered.add(name);
    const axis = { axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: pal.grey, fontFamily: mono, fontSize: 11 } };
    echarts.registerTheme(name, {
      backgroundColor: "transparent",
      textStyle: { fontFamily: sans, color: pal.ink },
      categoryAxis: { ...axis, splitLine: { show: false } },
      valueAxis: { ...axis, splitLine: { lineStyle: { color: pal.hair } } },
      logAxis: { ...axis, splitLine: { lineStyle: { color: pal.hair } } },
      timeAxis: { ...axis, splitLine: { lineStyle: { color: pal.hair } } },
      tooltip: { confine: true, backgroundColor: pal.tipBg, borderColor: pal.tipBorder, borderWidth: 1, textStyle: { color: pal.ink, fontSize: 12, fontFamily: sans }, extraCssText: "box-shadow:none;border-radius:4px;padding:8px 10px" },
    });
  }
  return name;
}
themeFor(LIGHT_PALETTE);

export { echarts, MONO, SANS };
