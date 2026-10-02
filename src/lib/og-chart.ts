import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import type { Lab } from "@/data/types";
import type { RankedVariant, IndexConfig } from "@/engine";
import { chartVariantMode } from "@/engine";
import type { Snapshot } from "@/data/types";
import { echarts, themeFor, paletteFor, SANS_STATIC, MONO_STATIC, type ChartPalette } from "@/components/chart/theme";
import { scatterOption, DEFAULT_VIEW, type ScatterPoint } from "@/components/chart/scatter-option";
import { barsOption, selectBars } from "@/components/chart/bars-option";
import { frameSvg } from "@/components/chart/export-frame";
import { chartKind, chartTitle, costChart, pickPoints, type MetricChart } from "@/lib/metrics";
import { presetOf } from "@/lib/page-presets";

export interface ChartSpec {
  title: string;
  chart: MetricChart;
  pts: ScatterPoint[];
  hasTitle: boolean;
}

/**
 * Resolve a `c` chart param to the scatter spec the matching page chart would draw. Points come
 * from the full ranked set via pickPoints: `cm` overrides the index's pareto effort mode, and
 * best mode keeps each model's best *measured* effort rather than dropping the model.
 */
export function scatterSpec(snapshot: Snapshot, ranked: RankedVariant[], index: IndexConfig, c: string | undefined, cm?: string): ChartSpec | null {
  const mode = cm === "best" || cm === "all" ? cm : chartVariantMode(index, "pareto");
  const from = (chart: MetricChart, title: string, hasTitle: boolean): ChartSpec => ({ title, hasTitle, chart, pts: pickPoints(chart, ranked, mode) });
  if (c === "cost") return from(costChart, "Score vs cost per task", true);
  const ck = chartKind(snapshot, ranked, c, index.timeSource);
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

function rasterize(svg: string, bg: string): Buffer {
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: 2400 },
    background: bg,
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: "Inter", sansSerifFamily: "Inter", serifFamily: "Newsreader", monospaceFamily: "JetBrains Mono" },
  }).render().asPng();
  return Buffer.from(png);
}

/**
 * Rasterize a chart exactly as the site's PNG export draws it: the shared ECharts option rendered
 * SSR→SVG, wrapped in the export frame (serif title top-left; footer moved right because X's title
 * pill covers bottom-left), then resvg → 2400×1260 PNG with the vendored OFL fonts.
 * `cv=bars|scatter` overrides the chart's default view; time-scale charts stay scatter.
 */
export async function renderChartPng(spec: ChartSpec, labs: Lab[], pal: ChartPalette, cv?: string): Promise<Buffer | null> {
  const theme = themeFor(pal, { sans: SANS_STATIC, mono: MONO_STATIC });
  const chart = echarts.init(null, theme, { renderer: "svg", ssr: true, width: CHART_W, height: CHART_H });
  let svg: string;
  const kind = cv === "bars" || cv === "scatter" ? cv : spec.chart.defaultKind ?? "scatter";
  if (kind === "bars" && spec.chart.scale !== "time") {
    const bars = selectBars(spec.pts, spec.chart.better, 24);
    if (!bars.length) return null;
    const opt = barsOption({ bars, labs, xName: spec.chart.xName.replace(", log", ""), formatValue: spec.chart === costChart ? costChart.formatX : spec.chart.formatValue ?? spec.chart.formatX, pal, narrow: false });
    // Rotated category labels need deep bottom margin; keep them clear of X's bottom-left pill (~y550).
    chart.setOption({ ...opt, animation: false, grid: { ...(opt.grid as Record<string, number>), bottom: 132 } });
    svg = chart.renderToSVGString();
  } else {
    if (!spec.pts.length) return null;
    const opt = scatterOption({ ...spec.chart, xUnit: spec.chart.xLabel, pts: spec.pts, hasTitle: spec.hasTitle, labs, view: DEFAULT_VIEW, pal, narrow: false });
    // Lift the x-axis so tick labels and the axis name clear X's bottom-left title overlay (~y550).
    chart.setOption({ ...opt, animation: false, grid: { ...(opt.grid as Record<string, number>), bottom: 108 } });
    svg = chart.renderToSVGString();
  }
  chart.dispose();
  return rasterize(frameSvg(svg, spec.title, undefined, { bg: pal.bg, ink: pal.ink, grey: pal.grey }, { footer: "right" }), pal.bg);
}
