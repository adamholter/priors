import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import type { EChartsOption } from "echarts";
import type { Lab, Snapshot } from "../data/types";
import type { RankedVariant, IndexConfig } from "../engine";
import { chartVariantMode } from "../engine";
import { echarts, themeFor, paletteFor, markColor, DARK_PALETTE, SANS_STATIC, MONO_STATIC, type ChartPalette } from "../components/chart/theme";
import { scatterOption, DEFAULT_VIEW, guidePoints, type Highlight, type ScatterPoint } from "../components/chart/scatter-option";
import { barsOption, defaultBarModels, filterBarModels, selectBars } from "../components/chart/bars-option";
import { frameSvg } from "../components/chart/export-frame";
import { effectiveBasis } from "../data/subscription";
import { chartKind, chartTitle, costChart, costChartFor, pickPoints, type MetricChart } from "./metrics";
import { presetOf, themeById, type PagePreset } from "./page-presets";
import { EMPTY_HIDDEN, visiblePoints, type ChartHidden } from "../components/chart/chart-visibility";

import { labelScale as normalizeLabelScale } from "../components/chart/label-size";

export interface ChartSpec {
  labelScale?: number;
  title: string;
  chart: MetricChart;
  pts: ScatterPoint[];
  /** Vertical bars use chart-local defaults; scatter keeps the full index-filtered set. */
  barPts?: ScatterPoint[];
  hasTitle: boolean;
  /** Highlighted model ids or exact variant ids from the shared index URL. */
  highlight?: string[];
}

/**
 * Resolve a `c` chart param to the scatter spec the matching page chart would draw. Points come
 * from the full ranked set via pickPoints: `cm` overrides the index's pareto effort mode, and
 * best mode keeps each model's best *measured* effort rather than dropping the model.
 */
export function scatterSpec(snapshot: Snapshot, ranked: RankedVariant[], index: IndexConfig, c: string | undefined, cm?: string, cs?: string, hidden: ChartHidden = EMPTY_HIDDEN, labelScale?: number): ChartSpec | null {
  const mode = cm === "best" || cm === "all" ? cm : chartVariantMode(index, "pareto");
  const from = (chart: MetricChart, title: string, hasTitle: boolean): ChartSpec => {
    const metricPoints = chart.points(ranked), defaults = defaultBarModels(metricPoints, chart.better, ranked);
    return {
      title, hasTitle, labelScale: normalizeLabelScale(labelScale),
      chart: chart.scale === "log" && cs === "linear" ? { ...chart, scale: "linear", xName: chart.xName.replace(/, log| \(log\)/g, "") } : chart,
      pts: visiblePoints(pickPoints(chart, ranked, mode), hidden),
      barPts: visiblePoints(filterBarModels(pickPoints(chart, ranked, mode), defaults), hidden),
      highlight: index.highlight?.length ? [...index.highlight] : undefined,
    };
  };
  if (c === "cost") return from(costChartFor(effectiveBasis(index.costBasis)), effectiveBasis(index.costBasis) === "subscription" ? "Score vs subscription cost per task" : "Score vs cost per task", true);
  const ck = chartKind(snapshot, ranked, c, index.timeSource);
  if (ck?.kind !== "metric") return null;
  return from(ck.chart, chartTitle(c) ?? ck.chart.xName, false);
}

/** Chart palette for a share card: the profile's scheme, else the site default. */
/** The page theme a card is drawn in. A requested scheme picks a paired theme's light or dark version; with none, the theme keeps its own mode. */
export function cardPreset(theme?: { preset?: string; surface?: "bone" | "white" }, scheme?: "light" | "dark"): PagePreset {
  const preset = presetOf(theme);
  if (!scheme || !preset.pair || preset.dark === (scheme === "dark")) return preset;
  return themeById(preset.pair) ?? preset;
}

/** Lookalike themes (Analysis, Slop) restyle whole cards. A requested scheme picks that theme's light or dark version. */
export function cardTheme(theme?: { preset?: string; surface?: "bone" | "white" }, scheme?: "light" | "dark"): PagePreset | null {
  const preset = cardPreset(theme, scheme);
  return preset.family === "aa" || preset.family === "slop" ? preset : null;
}

/** Card options for a saved page theme, so a profile's link previews look like its page (dark pages get dark cards). */
export function profileCardLook(theme?: { preset?: string; surface?: "bone" | "white"; accent?: string }) {
  const preset = presetOf(theme);
  return { theme: theme ? { preset: theme.preset, surface: theme.surface } : undefined, accent: theme?.accent, surface: preset.dark ? undefined : preset.bg };
}

export function cardPalette(theme?: { preset?: string; surface?: "bone" | "white" }, scheme?: "light" | "dark"): ChartPalette {
  const themed = cardTheme(theme, scheme);
  if (themed) return paletteFor(themed);
  // A dark card renders a Bone (default) scheme with the site's dark palette; explicit presets keep their own.
  const preset = presetOf(theme);
  return scheme === "dark" && preset.id === "bone" ? DARK_PALETTE : paletteFor(preset);
}

const FONT_FILES = ["Newsreader-400.ttf", "Inter-400.ttf", "Inter-500.ttf", "Inter-600.ttf", "JetBrainsMono-400.ttf", "JetBrainsMono-500.ttf"].map((f) => path.join(process.cwd(), "src/lib/og-fonts", f));

// 1200×630 card: frameSvg wraps the chart with pad 32, a 22px title band, and a 34px footer.
const CHART_W = 1200 - 64, CHART_H = 630 - 88;

export function rasterize(svg: string, bg: string): Buffer {
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: 2400 },
    background: bg,
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: "Inter", sansSerifFamily: "Inter", serifFamily: "Newsreader", monospaceFamily: "JetBrains Mono" },
  }).render().asPng();
  return Buffer.from(png);
}

/** Add the same axis guides and value badges used by ScoreScatter before server-side SVG rendering. */
function addHighlightGuides(chart: ReturnType<typeof echarts.init>, pts: ScatterPoint[], highlight: Highlight | undefined, labs: Lab[], pal: ChartPalette, formatX: (x: number) => string) {
  const guides = guidePoints(pts, highlight);
  if (!guides.length) return;

  const grid = ((chart as unknown as { getModel: () => { getComponent: (type: string, index: number) => { coordinateSystem?: { getRect: () => { x: number; y: number; width: number; height: number } } } | undefined } }).getModel())
    .getComponent("grid", 0)?.coordinateSystem?.getRect();
  if (!grid) return;

  const colorOf = new Map(labs.map((lab) => [lab.id, markColor(lab.color, pal, lab.id)]));
  const bottom = grid.y + grid.height;
  const placed = guides.map((p) => ({ p, px: chart.convertToPixel({ seriesId: "marks" }, [p.x, p.r.score]) as unknown as number[] | undefined }))
    .filter((g): g is { p: ScatterPoint; px: number[] } => !!g.px && Number.isFinite(g.px[0]) && Number.isFinite(g.px[1]));
  if (!placed.length) return;

  const width = chart.getWidth();
  const xs = placed.map(({ p, px }) => { const text = formatX(p.x); return { text, at: px[0], size: text.length * 6.6 + 10 }; });
  const ys = placed.map(({ p, px }) => ({ text: p.r.score.toFixed(1), at: px[1], size: 16 }));
  const spread = (items: { at: number; size: number }[], lo: number, hi: number) => {
    const order = items.map((_, i) => i).sort((i, j) => items[i].at - items[j].at), pos = items.map((item) => item.at);
    for (let k = 0; k < order.length; k++) {
      const i = order[k], prev = order[k - 1];
      pos[i] = Math.max(pos[i], lo + items[i].size / 2, prev == null ? -Infinity : pos[prev] + (items[prev].size + items[i].size) / 2 + 3);
    }
    for (let k = order.length - 1; k >= 0; k--) {
      const i = order[k], next = order[k + 1];
      pos[i] = Math.min(pos[i], hi - items[i].size / 2, next == null ? Infinity : pos[next] - (items[next].size + items[i].size) / 2 - 3);
    }
    return pos;
  };
  const xAt = spread(xs, 2, width - 2), yAt = spread(ys, grid.y - 6, bottom + 6);
  const badge = { fontSize: 10.5, fontFamily: "JetBrains Mono, Menlo, monospace", fill: pal.dark ? "#141413" : "#FFFFFF", padding: [2, 4], borderRadius: 2 };
  const children = placed.flatMap(({ p, px }, i) => {
    const color = colorOf.get(p.r.model.labId) ?? pal.ink, dash = { stroke: color, lineDash: [4, 3], lineWidth: 1.2, opacity: 0.9 };
    return [
      { type: "line", shape: { x1: px[0], y1: px[1], x2: px[0], y2: bottom }, style: dash, z: 3 },
      { type: "line", shape: { x1: grid.x, y1: px[1], x2: px[0], y2: px[1] }, style: dash, z: 3 },
      { type: "text", x: xAt[i], y: bottom + 5, style: { ...badge, text: xs[i].text, backgroundColor: color, align: "center", verticalAlign: "top" }, z: 20 },
      { type: "text", x: grid.x - 5, y: yAt[i], style: { ...badge, text: ys[i].text, backgroundColor: color, align: "right", verticalAlign: "middle" }, z: 20 },
    ];
  });
  chart.setOption({ graphic: [{ id: "guides", type: "group", silent: true, z: 3, children }] } as EChartsOption, { replaceMerge: ["graphic"] });
}

/**
 * Rasterize a chart exactly as the site's PNG export draws it: the shared ECharts option rendered
 * SSR→SVG, wrapped in the export frame (serif title top-left; footer moved right because X's title
 * pill covers bottom-left), then resvg → 2400×1260 PNG with the vendored OFL fonts.
 * `cv=bars|scatter` overrides the chart's default view; time-scale charts stay scatter.
 */
export async function renderChartPng(spec: ChartSpec, labs: Lab[], pal: ChartPalette, cv?: string): Promise<Buffer | null> {
  if (!spec.pts.length) {
    const empty = `<svg xmlns="http://www.w3.org/2000/svg" width="${CHART_W}" height="${CHART_H}"><text x="${CHART_W / 2}" y="${CHART_H / 2}" text-anchor="middle" fill="${pal.grey}" font-family="Inter" font-size="14">No model in this view has this metric.</text></svg>`;
    return rasterize(frameSvg(empty, spec.title, undefined, { bg: pal.bg, ink: pal.ink, grey: pal.grey }, { footer: "right" }), pal.bg);
  }
  const theme = themeFor(pal, { sans: SANS_STATIC, mono: MONO_STATIC });
  const chart = echarts.init(null, theme, { renderer: "svg", ssr: true, width: CHART_W, height: CHART_H });
  let svg: string;
  const kind = cv === "bars" || cv === "scatter" ? cv : spec.chart.defaultKind ?? "scatter";
  const highlight = spec.highlight?.length ? spec.highlight : undefined;
  if (kind === "bars" && spec.chart.scale !== "time") {
    const barPts = spec.barPts ?? spec.pts;
    const modelCount = new Set(barPts.map((p) => p.r.model.id)).size;
    const bars = selectBars(barPts, spec.chart.better, Math.max(24, modelCount), highlight);
    if (!bars.length) return null;
    const opt = barsOption({ bars, labs, xName: spec.chart.xName.replace(", log", ""), formatValue: spec.chart.xLabel === costChart.xLabel ? costChart.formatX : spec.chart.formatValue ?? spec.chart.formatX, pal, narrow: false, highlight, labelScale: spec.labelScale, width: CHART_W, height: CHART_H });
    // Rotated category labels need deep bottom margin; keep them clear of X's bottom-left pill (~y550).
    chart.setOption({ ...opt, animation: false, grid: { ...(opt.grid as Record<string, number>), bottom: 132 } });
    svg = chart.renderToSVGString();
  } else {
    if (!spec.pts.length) return null;
    const emphasis: Highlight | undefined = highlight ? { items: highlight, guides: true } : undefined;
    const opt = scatterOption({ ...spec.chart, xUnit: spec.chart.xLabel, pts: spec.pts, hasTitle: spec.hasTitle, labs, view: { ...DEFAULT_VIEW, labelScale: spec.labelScale, frontier: spec.chart.defaultFrontier ?? DEFAULT_VIEW.frontier }, pal, narrow: false, width: () => CHART_W, height: () => CHART_H, dots: () => { try { return spec.pts.map((p) => { const [x, y] = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [p.x, p.r.score]) as number[]; return { x, y }; }); } catch { return undefined; } }, highlight: emphasis });
    // Lift the x-axis so tick labels and the axis name clear X's bottom-left title overlay (~y550).
    chart.setOption({ ...opt, animation: false, grid: { ...(opt.grid as Record<string, number>), bottom: 108 } });
    addHighlightGuides(chart, spec.pts, emphasis, labs, pal, spec.chart.formatX);
    // Browser clipping safely omits labels with no free slot. resvg's clip intersection can panic
    // for a label entirely outside the canvas, so omit those labels from the server SVG as well.
    for (const root of chart.getZr().storage.getRoots()) root.traverse(el => {
      const label = el.getTextContent();
      if (label && (label.x < -CHART_W || label.y < -CHART_H)) label.ignore = true;
    });
    svg = chart.renderToSVGString();
  }
  chart.dispose();
  return rasterize(frameSvg(svg, spec.title, undefined, { bg: pal.bg, ink: pal.ink, grey: pal.grey }, { footer: "right" }), pal.bg);
}

/** A static radar (radar-view radarSvg) centered in the 1200×630 card frame, rasterized like chart cards. */
export function renderRadarPng(radar: string, title: string, pal: ChartPalette): Buffer {
  const open = radar.match(/<svg[^>]*>/)?.[0] ?? "";
  const w = Number(open.match(/width="([\d.]+)/)?.[1] ?? CHART_W), h = Number(open.match(/height="([\d.]+)/)?.[1] ?? CHART_H);
  const scale = Math.min(CHART_W / w, CHART_H / h, 1.25), x = (CHART_W - w * scale) / 2, y = (CHART_H - h * scale) / 2;
  const inner = radar.replace(/<svg[^>]*>/, `<svg x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(w * scale).toFixed(1)}" height="${(h * scale).toFixed(1)}" viewBox="0 0 ${w} ${h}">`);
  const canvas = `<svg xmlns="http://www.w3.org/2000/svg" width="${CHART_W}" height="${CHART_H}" viewBox="0 0 ${CHART_W} ${CHART_H}">${inner}</svg>`;
  return rasterize(frameSvg(canvas, title, undefined, { bg: pal.bg, ink: pal.ink, grey: pal.grey }, { footer: "right" }), pal.bg);
}
