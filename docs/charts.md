# Charts and rankings

All charts are ECharts with the `priors` theme, set up in `src/components/chart/echarts.ts`. Pure option builders (`scatter-option.ts`, `bars-option.ts`, `radar-view.ts`) are shared by the page, exports, embeds and share-card renders, so a chart looks the same everywhere.

## Rankings

- `src/components/Rankings.tsx`. Top 30 (25 on profile pages) with one "Show all" toggle. A staged 15, 35, all expansion was tried and rejected.
- Rows are keyed DOM elements that transition between list-local absolute positions inside a paint-contained, clipped list. Do not bring back viewport-coordinate FLIP measurements: they compound in-flight transforms during slider drags and scrolling.
- Weight sliders (`WeightsPanel.tsx`) control a benchmark's share (0 to 70%), not its raw weight, so the range is the same for every benchmark.

## Chart kinds

- Chart definitions live in `src/lib/metrics.ts` (`MetricChart`, `chartKind`, `pickPoints`).
- Not every chart opens as a Pareto scatter. `MetricChart.defaultKind` makes Output speed, Latency, Output tokens and Uptime open as bars. Cost and time per task stay scatter because they are real trade-offs. Release date is a time-scale scatter only.
- A user's explicit toggle is remembered (`kindChosen`). Chart links carry `cv=bars|scatter` only when it differs from the default.
- Every scatter and bar chart has an expand button (`ChartExpand.tsx`) that fills about 95% of the viewport. Escape or the backdrop closes it.

## Per-chart settings

- The gear menu is `ChartSettings.tsx`: effort mode (best or all), model-visibility checkboxes (they write `excludeModels`), the release-age filter, the cost Pricing toggle, "Highlight guides", and a collapsed Advanced section.
- A chart's display preferences are a `ScatterView`, read through `useScatterView(key, …)` and stored in `localStorage["priors:chart:<key>"]`. On a profile page the owner's choices are saved as the page default instead (`section.view`, or `section.metrics[].view` in the gallery).
- **Custom formulas.** Advanced takes a formula such as `score / (cost * time)` that replaces the chart's metric. The parser is `src/lib/formula.ts` (no `eval`). Variables and the derived chart are `formulaInputs` and `formulaChart` in `metrics.ts`. The formula lives in the chart view (`formula`, `formulaBetter`), so it follows localStorage, owner defaults (`chartView` in `convex/validators.ts`) and chart links (`cf`, `cb`).

## Metric gallery

`src/components/page/MetricGallery.tsx`, on both `/builder` and profile pages. Time per task is open by default; Output speed, Latency, Release date, Uptime and Usage start collapsed.

- Usage (T3 Code share) is model-level: one point per model, on its best-scoring ranked variant.
- Per-variant detail fields are looked up on the index observation. Source-qualified variant ids (`@effort~source-conf`) resolve to their base effort id, the same as engine substitution.
- Uptime plots `-log10(downtime)` so 90, 99 and 99.9% are evenly spaced. Tooltips and exports show the raw percent.

## Highlights

`src/components/chart/highlight.tsx`. `IndexConfig.highlight` holds model ids (meaning the best effort) or variant ids (that exact effort; several per model allowed). The URL param is `hl=`.

- The builder and profile pages wrap charts in `HighlightContext`; every `ScoreScatter` and `MetricBars` reads it.
- Entry points: the star menu in the chart header, stars in the settings model list (starred models pin to the top), a removable list under the title, and clicking a point.
- Other models desaturate and fade. Featured efforts get name labels; their other efforts get effort tags.
- Guide lines (`view.guides`) are drawn as ECharts `graphic` in pixel space so they end at the axes. Badges slide apart along the axis and never leave the canvas. Exports include them.

## Text must never clip

Grids use fixed pixel margins and the chart div clips overflow, so:

- every grid spreads `CONTAIN_AXIS_LABELS` (ECharts 6 `outerBounds`, which shrinks the plot when rotated or long labels would leave the canvas);
- every scatter with point labels uses `insideLabels(width)`, which flips a label to the left of its mark at the right edge.

Embeds inline the same rules.

## Colors

- `ChartPalette` carries colors, fonts, lab colors and style per theme. The root `ChartPaletteContext` switches between `LIGHT_PALETTE` and `DARK_PALETTE`; page themes supply their own.
- Never read `lab.color` directly for display. Use `markColor(color, pal, labId)` in charts and `useLabColor()` in the DOM, so dark mode and themed pages get their tuned lab colors (`DARK_LAB_COLORS` in `chart/theme.ts`).

## Exports, links and embeds

- `ChartExport.tsx`: PNG, SVG and CSV. PNG and SVG follow the current palette.
- `ChartLink.tsx` and `src/lib/highlight-link.ts`: a link to one chart (`c=<id>` plus view params `cv`, `cm`, `cs`, `cf`, `cb` and `hl`). Such links unfurl as that chart, see `docs/pages-and-sharing.md`.
- `embed.ts`: a standalone HTML file. It ships both palettes and follows the viewer's `prefers-color-scheme` (override with `?theme=` or `#dark`).

## Strengths radar

`StrengthsRadar.tsx`, `Radar.tsx`, `RadarModal.tsx`, with data in `radar-data.ts` and the SVG renderer in `radar-view.ts` (also used for the radar share card).

The toolbar toggle switches the panel to `BenchBars.tsx`: one bar chart per benchmark (Artificial Analysis style), the selected models best first on each, top 8 until the user picks models (the radar follows the top 4). Link param `rv=bars`. Export is a sheet of the on-screen charts (PNG/SVG, CSV/JSON); no HTML embed in this view.
