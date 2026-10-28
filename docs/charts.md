# Charts and rankings

All charts are ECharts with the `priors` theme, set up in `src/components/chart/echarts.ts`. Pure option builders (`scatter-option.ts`, `bars-option.ts`, `radar-view.ts`) are shared by the page, exports, embeds and share-card renders, so a chart looks the same everywhere.

## Rankings

- `src/components/Rankings.tsx`. Top 30 (25 on profile pages) with one "Show all" toggle. A staged 15, 35, all expansion was tried and rejected.
- Rows are keyed DOM elements that transition between list-local absolute positions inside a paint-contained, clipped list. Do not bring back viewport-coordinate FLIP measurements: they compound in-flight transforms during slider drags and scrolling.
- The benchmark list's search (`src/lib/benchmark-search.ts`) reads names first, then short name and id, lab and category, then descriptions. Every word must match somewhere, a description word must start a word ("ui" does not match "build"), and a name match outranks any number of description matches. A search shows one list, best match first; browsing groups by category.
- The `+` next to the index tabs copies the index you are viewing (weights, filters, highlights) as "<name> copy", with its name open for renaming. It is how to save a variation without rebuilding it.
- Weight sliders (`WeightsPanel.tsx`) control a benchmark's share (0 to 70%), not its raw weight, so the range is the same for every benchmark.

## Chart kinds

- Chart definitions live in `src/lib/metrics.ts` (`MetricChart`, `chartKind`, `pickPoints`).
- Not every chart opens as a Pareto scatter. `MetricChart.defaultKind` makes Output speed, Latency, Output tokens and Uptime open as bars. Cost and time per task stay scatter because they are real trade-offs. Release date is a time-scale scatter only.
- **Pareto charts start trimmed** (`src/lib/chart-focus.ts`, applied in `ScoreScatter` and in `metricSpec` for cards and previews): every model with an effort on that chart's frontier, the current model of each line from OpenAI, Anthropic, Google, Meta and xAI, and highlighted models. Current means the newest version of its line (name with the version blanked: Opus 5.5 over Opus 5), not of an older generation of its family the lab has moved past (GPT-5.5 after GPT-6 Astra), shipped within six months of the lab's newest model, and not an open-weights size variant (Gemma 4 31B). Other labs appear only when on the frontier. "All models" in the chart's settings (`ScatterView.allModels`, link key `cf=all`) shows everything; once models are picked by hand (`excludeModels` or `onlyModels` set, `HighlightState.curated`) the chart shows exactly those. Time-scale charts and rankings are never trimmed.
- A user's explicit toggle is remembered (`kindChosen`). Chart links carry `cv=bars|scatter` only when it differs from the default.
- Every scatter and bar chart has an expand button (`ChartExpand.tsx`) that fills about 95% of the viewport. Escape or the backdrop closes it.

## Per-chart settings

- Scatter marks have no floating tooltip. The mark under the cursor (or the one a click pinned) gets crosshair guides and a card in the chart's lower right (`PointCard` in `ScoreScatter.tsx`), so details never cover neighbouring marks.
- The gear menu is `ChartSettings.tsx`: reasoning efforts (on the cost, time and speed charts a row of toggles, `none` off by default, saved as `IndexConfig.efforts`, link key `eff`; the ranking keeps its best-or-all dropdown), model-visibility checkboxes (they write `excludeModels`; rows keep their order while the menu is open), the release-age filter, the cost Pricing toggle, "Highlight guides", and a collapsed Advanced section.
- A chart's display preferences are a `ScatterView`, read through `useScatterView(key, …)` and stored in `localStorage["priors:chart:<key>"]`. On a profile page the owner's choices are saved as the page default instead (`section.view`, or `section.metrics[].view` in the gallery).
- **Custom formulas.** Advanced takes a formula such as `score / (cost * time)` that replaces the chart's metric. The parser is `src/lib/formula.ts` (no `eval`). Variables and the derived chart are `formulaInputs` and `formulaChart` in `metrics.ts`. The formula lives in the chart view (`formula`, `formulaBetter`), so it follows localStorage, owner defaults (`chartView` in `convex/validators.ts`) and chart links (`cf`, `cb`).

## Metric gallery

`src/components/page/MetricGallery.tsx`, on both `/builder` and profile pages. Time per task is open by default; Output speed, Latency, Release date, Uptime and Usage start collapsed.

- Usage (T3 Code share) is model-level: one point per model, on its best-scoring ranked variant.
- Per-variant detail fields are looked up on the index observation. Source-qualified variant ids (`@effort~source-conf`) resolve to their base effort id, the same as engine substitution.
- Uptime plots `-log10(downtime)` so 90, 99 and 99.9% are evenly spaced. Tooltips and exports show the raw percent.
- Scatter labels (`scatter-label-layout.ts`) are placed in priority order and never overlap each other. ECharts reports a label's box at the size it had before a label-size change (a 150% label arrived at 100%), so the layout scales the box up to the configured font size (`fontPx`) and reserves a little extra for the web font. It also steers around other marks when the chart supplies their pixel positions (`dots`, from `convertToPixel`), falling back to any free slot rather than hiding a label. Check overlaps at 100, 125 and 150% label size and at phone width.
- **Usage** (More metrics) opens as `UsageStream` (`src/components/chart/UsageStream.tsx`), modelled on Slopalytics' usage tab: each model's daily share of T3 Code turns as stacked areas (biggest at the bottom, the top nine plus one "Other" band, lab colors stepped lighter for a lab's next model), a Share/Volume switch, and a table of window averages (turns per day, share, and the change in share in percentage points, first three days against last three). "Score vs usage", the earlier chart of index score against share, is behind the "Over time / Score vs usage" toggle. Data: `lib/usage-stream.ts` reads the daily series each `t3-usage-share` observation carries; without it (an older snapshot) the old chart shows alone.
- Free models (subscription cost $0) sit on a dashed "free" line left of the cheapest paid cost, since a log axis has no 0. See `docs/data.md`, Subscription cost.

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

- **Embed parity benchmark:** `BASE=http://localhost:<port> N=24 SEED=1 node scripts/verify/embed-parity.mjs` samples random pages, charts, settings and screenshot-editor states, exports the PNG and copies the link the way a person does, fetches the link's preview image as a bot, and scores the pair (aspect, background, gray and layout difference). Failures land in `/tmp/embed-parity/`. Use it before and after any change to chart links, `renderFramedPng` or the export frame.

- `ChartExport.tsx`: PNG, SVG and CSV. PNG and SVG follow the current palette.
- PNG and SVG crop blank space off the right (`trimRight` in `export-frame.ts`, measured in the browser); a label that runs right keeps its room. `trim={false}` turns it off.
- `ExportEditor.tsx`: the screenshot editor, opened by the brush beside PNG (or by a link). It renders a bare copy of the scatter at image size (drag the corner, pick a ratio), with its own theme, title and chart settings. Its state is the `xe` param (`src/lib/export-editor.ts`) next to `c=<chart id>`, so the link opens the modal over the same page, mix and highlights; closing drops `xe`.
- `ChartLink.tsx` and `src/lib/highlight-link.ts`: a link to one chart (`c=<id>` plus view params `cv`, `cm`, `cs`, `cf`, `cb`, `hl` and, on pages, `hv` for the visit's unsaved model and effort settings). Such links unfurl as that chart, see `docs/pages-and-sharing.md`.
- `embed.ts`: a standalone HTML file. It ships both palettes and follows the viewer's `prefers-color-scheme` (override with `?theme=` or `#dark`).

## Strengths radar

`StrengthsRadar.tsx`, `Radar.tsx`, `RadarModal.tsx`, with data in `radar-data.ts` and the SVG renderer in `radar-view.ts` (also used for the radar share card).

The toolbar toggle switches the panel to `BenchBars.tsx`: one bar chart per benchmark (Artificial Analysis style), the selected models best first on each, top 8 until the user picks models (the radar follows the top 4). Link param `rv=bars`. Export is a sheet of the on-screen charts (PNG/SVG, CSV/JSON); no HTML embed in this view.
