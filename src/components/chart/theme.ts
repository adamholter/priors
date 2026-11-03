import * as echarts from "echarts/core";
import { LineChart, ScatterChart, BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent, DatasetComponent, MarkLineComponent, MarkAreaComponent, GraphicComponent, DataZoomComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { LabelLayout, UniversalTransition } from "echarts/features";

echarts.use([LineChart, ScatterChart, BarChart, GridComponent, TooltipComponent, DatasetComponent, MarkLineComponent, MarkAreaComponent, GraphicComponent, DataZoomComponent, SVGRenderer, LabelLayout, UniversalTransition]);

export * from "./theme-tokens";
import { DARK_PALETTE, LIGHT_PALETTE, themeSpec, type ChartPalette } from "./theme-tokens";

const registered = new Set<string>();
/** `showGrid`: the viewer's Background grid choice, when they made one (`useChartGrid`). */
export function themeFor(pal: ChartPalette, fonts?: { sans?: string; mono?: string }, showGrid = !pal.style?.gridOff) {
  const { name, theme } = themeSpec(pal, fonts, showGrid);
  if (!registered.has(name)) { registered.add(name); echarts.registerTheme(name, theme); }
  return name;
}
themeFor(LIGHT_PALETTE);
themeFor(DARK_PALETTE);

export { echarts };
