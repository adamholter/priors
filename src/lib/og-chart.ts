import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import type { Lab } from "@/data/types";
import type { RankedVariant } from "@/engine";
import type { Snapshot } from "@/data/types";
import { echarts, themeFor, paletteFor, SANS_STATIC, MONO_STATIC, type ChartPalette } from "@/components/chart/theme";
import { scatterOption, DEFAULT_VIEW, type ScatterPoint } from "@/components/chart/scatter-option";
import { frameSvg } from "@/components/chart/export-frame";
import { chartKind, chartTitle, costChart, type MetricChart } from "@/lib/metrics";
import { presetOf } from "@/lib/page-presets";

export interface ChartSpec {
  title: string;
  pts: ScatterPoint[];
  better: "lower" | "higher";
  xName: string;
  xShort?: string;
  xUnit?: string;
  scale?: "linear" | "log" | "time";
  formatX: (x: number) => string;
  formatValue?: (x: number) => string;
  /** Page charts with their own title row use a tighter top grid (Pareto; gallery panels don't). */
  hasTitle: boolean;
}

/** Resolve a `c` chart param to the scatter spec the matching page chart would draw. */
export function scatterSpec(snapshot: Snapshot, pareto: RankedVariant[], c: string | undefined): ChartSpec | null {
  const from = (chart: MetricChart & { xShort?: string }, title: string, hasTitle: boolean): ChartSpec => ({
    title, hasTitle, pts: chart.points(pareto), better: chart.better, xName: chart.xName, xShort: chart.xShort, xUnit: chart.xLabel, scale: chart.scale, formatX: chart.formatX, formatValue: chart.formatValue,
  });
  if (c === "cost") return from(costChart, "Score vs cost per task", true);
  const ck = chartKind(snapshot, pareto, c);
  if (ck?.kind !== "metric") return null;
  return from(ck.chart, chartTitle(c) ?? ck.chart.xName, false);
}

/** Chart palette for a share card: the profile's scheme, else the site default. */
export function cardPalette(theme?: { preset?: string; surface?: "bone" | "white" }): ChartPalette {
  return paletteFor(presetOf(theme));
}

const FONT_FILES = ["Newsreader-400.ttf", "Inter-400.ttf", "Inter-500.ttf", "Inter-600.ttf", "JetBrainsMono-400.ttf", "JetBrainsMono-500.ttf"].map((f) => path.join(process.cwd(), "src/lib/og-fonts", f));

// 1200×630 card: frameSvg wraps the chart with pad 32, a 22px title band, and a 34px footer.
const CHART_W = 1200 - 64, CHART_H = 630 - 88;

/**
 * Rasterize a chart exactly as the site's PNG export draws it: the shared ECharts option rendered
 * SSR→SVG, wrapped in the export frame (serif title top-left; footer moved right because X's title
 * pill covers bottom-left), then resvg → 2400×1260 PNG with the vendored OFL fonts.
 */
export async function renderChartPng(spec: ChartSpec, labs: Lab[], pal: ChartPalette): Promise<Buffer> {
  const theme = themeFor(pal, { sans: SANS_STATIC, mono: MONO_STATIC });
  const chart = echarts.init(null, theme, { renderer: "svg", ssr: true, width: CHART_W, height: CHART_H });
  const opt = scatterOption({ ...spec, labs, view: DEFAULT_VIEW, pal, narrow: false });
  // Lift the x-axis so tick labels and the axis name clear X's bottom-left title overlay (~y550).
  chart.setOption({ ...opt, animation: false, grid: { ...(opt.grid as Record<string, number>), bottom: 108 } });
  const svg = frameSvg(chart.renderToSVGString(), spec.title, undefined, { bg: pal.bg, ink: pal.ink, grey: pal.grey }, { footer: "right" });
  chart.dispose();
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: 2400 },
    background: pal.bg,
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: "Inter" },
  }).render().asPng();
  return Buffer.from(png);
}
