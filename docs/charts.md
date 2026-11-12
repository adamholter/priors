# Charts and rankings

All charts are ECharts with the `priors` theme, set up in `src/components/chart/echarts.ts`. Pure option builders (`scatter-option.ts`, `bars-option.ts`, `radar-view.ts`) are shared by the page, exports, embeds and share-card renders, so a chart looks the same everywhere.

## Rankings

- `src/components/Rankings.tsx`. Top 30 (25 on profile pages) with one "Show all" toggle. A staged 15, 35, all expansion was tried and rejected.
- Rows are keyed DOM elements that transition between list-local absolute positions inside a paint-contained, clipped list. Do not bring back viewport-coordinate FLIP measurements: they compound in-flight transforms during slider drags and scrolling.
- The benchmark list's search (`src/lib/benchmark-search.ts`) reads names first, then short name and id, lab and every category the benchmark sits in, then descriptions. Every word must match somewhere, a description word must start a word ("ui" does not match "build"), and a name match outranks any number of description matches. A search shows one list, best match first; browsing groups by category.
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
- The gear menu is `ChartSettings.tsx`: reasoning efforts (on the cost, time and speed charts a row of toggles, `none` off by default, saved as `IndexConfig.efforts`, link key `eff`; the ranking keeps its best-or-all dropdown), model-visibility checkboxes (they write `excludeModels`; rows keep their order while the menu is open), the release-age filter, the cost Pricing toggle, "Highlight guides", Background grid, Subscription plans (an unpicked lab's option names its median plan) and Custom formula.
- A chart's display preferences are a `ScatterView`, read through `useScatterView(key, …)` and stored in `localStorage["priors:chart:<key>"]`. On a profile page the owner's choices are saved as the page default instead (`section.view`, or `section.metrics[].view` in the gallery).
- **Picking models.** The Models tab has a checkbox per lab above the search (`labRows`, it writes through `onShowOnly`; a lab with some models on shows as mixed). The search also matches lab names. In the builder, Undo and Clear all sit beside "Your mix" (`src/lib/undoable.ts`, also Cmd+Z); edits within 800ms of each other undo together.
- **Methodology icon.** Cost charts carry the pricing explanation in an info icon beside the title (`ChartMethod.tsx`) rather than a caption, linking to `/benchmarks/methodology#cost`.
- **New models.** The ranking labels a model that was added since the visitor's last visit (`src/lib/seen-models.ts`, `localStorage["priors:seen-models"]`). A first visit labels nothing, and a model is new for one page load. Column-style rankings name them under the bars. Only pages holding the whole snapshot (builder, profile pages) read or write this.
- **Three tabs.** Chart settings are Models, Data (source, release window, pricing, reasoning effort, older models) and Display (scale, frontier, effort lines, grid, model names and their size). Two collapsed sections close the Data tab: Subscription plans and Custom formula.
- **Speed tiers.** A collapsed section on the Data tab of the cost, time per task and output speed charts (`speedTiers` prop, saved as `IndexConfig.speedTiers`, link key `tier`). Toggles for Standard, Flex, Fast and Ultrafast, then one line per tier from the data on what it costs and how it is billed. A picked tier replaces standard where a model has it; a model without it stays at standard; keeping Standard on draws both. `withSpeedTiers` (`src/data/speed-tiers.ts`) makes the rows, each with its own model id (`gpt-6.1-sol+fast`) so effort lines, labels, best per model and bars treat it as its own line. Highlights on a model reach its tier rows. A mark billed at API rates under subscription pricing says `, API rates` in its label, and the chart's legend says what was billed how. Time per task only takes tiers on Artificial Analysis' data, which is tokens over speed: a harness's measured run also holds tool time. Other charts ignore tiers, since a tier changes neither score nor tokens.
- **Subscription plans.** Every cost chart lists them under Data (`PlanPicker.tsx`), along with Count free tiers, Count limit resets and, where a model has two readings of its plan rate (Fable 5.2: Shared limit, the default, or Fable only), a switch between them with one line on each. Under API pricing the section stays, disabled, with a button back to subscription pricing. Reset clears the picks.
- **Custom formulas.** The Data tab's Custom formula section takes a formula such as `score / (cost * time)` that replaces the chart's metric. The parser is `src/lib/formula.ts` (no `eval`). Variables and the derived chart are `formulaInputs` and `formulaChart` in `metrics.ts`. The formula lives in the chart view (`formula`, `formulaBetter`), so it follows localStorage, owner defaults (`chartView` in `convex/validators.ts`) and chart links (`cf`, `cb`).

## Metric gallery

`src/components/page/MetricGallery.tsx`, on both `/builder` and profile pages. Time per task is open by default; Output speed, Latency, Release date, Uptime and Usage start collapsed.

- Cost charts default to a log axis, since costs span orders of magnitude and subsidies shrink those gaps for real users. Time per task and a benchmark's own durations default to linear, because waiting happens in linear time; `logOk` keeps the Log switch on them, and the share card follows it through `cs=log`.

- Usage (T3 Code share) is model-level: one point per model, on its best-scoring ranked variant.
- Per-variant detail fields are looked up on the index observation. Source-qualified variant ids (`@effort~source-conf`) resolve to their base effort id, the same as engine substitution.
- Uptime plots `-log10(downtime)` so 90, 99 and 99.9% are evenly spaced. Tooltips and exports show the raw percent.
- A scatter labels each model once, by name alone (`modelLabel`, `pickLabels`): its efforts share a connecting line, and hovering a mark names the effort (`chartLabel`). Highlighted models keep their effort labels and tags. "Default fallback" is never named; a different fallback setup is, in bars and on hover.
- **Background grid.** On by default; a theme can start it off (`ChartStyle.gridOff`, Slop). The viewer's choice (`chart-grid-pref.ts`, `localStorage["priors:chart-grid"]`) applies to every chart through the ECharts theme in `useEChart`. A chart link carries it to the preview in `xv`.
- Scatter labels (`scatter-label-layout.ts`) are placed in priority order and never overlap each other. Where a clear slot exists they also stay off other marks and the frontier line. ECharts reports a label's box at the size it had before a label-size change (a 150% label arrived at 100%), so the layout scales the box up to the configured font size (`fontPx`) and reserves a little extra for the web font. It also steers around other marks when the chart supplies their pixel positions (`dots`, from `convertToPixel`), falling back to any free slot rather than hiding a label. Check overlaps at 100, 125 and 150% label size and at phone width.
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
- `ExportEditor.tsx`: the screenshot editor, opened by the brush beside PNG (or by a link). It renders a bare copy of the scatter at image size (drag the corner, pick a ratio; the ratio is the finished image's, title and footer included), with its own theme, title and chart settings. Its state is the `xe` param (`src/lib/export-editor.ts`) next to `c=<chart id>`, so the link opens the modal over the same page, mix and highlights; closing drops `xe`. It opens with a short rise and fade (`chart-pop`, off under reduced motion). The leaderboard has it too (`Rankings.tsx`, the default rows look): `rankings-image.ts` draws the rows as an SVG exactly the size of the image, in the editor's theme, with as many rows as the height holds, so a taller image shows more models. There its only chart setting is label size, the heading defaults to the index's name (`imageTitle`), and it has no link yet, so Copy link is not offered. A chart that is not ECharts hands the editor its SVG through `shot.svg`.
- `ChartLink.tsx` and `src/lib/highlight-link.ts`: a link to one chart (`c=<id>` plus view params `cv`, `cm`, `cs`, `cf`, `cb`, `hl` and, on pages, `hv` for the visit's unsaved model and effort settings). Such links unfurl as that chart, see `docs/pages-and-sharing.md`.
- `embed.ts`: a standalone HTML file. It ships both palettes and follows the viewer's `prefers-color-scheme` (override with `?theme=` or `#dark`).

## Strengths radar

`StrengthsRadar.tsx`, `Radar.tsx`, `RadarModal.tsx`, with data in `radar-data.ts` and the SVG renderer in `radar-view.ts` (also used for the radar share card).

- **Names are never cut.** `radar-labels.ts` wraps each benchmark name onto lines (at spaces, then after hyphens) and returns the box the labels need. `Radar.tsx` and the static SVG both size their canvas from that box, and the static SVG places its legend after the widest right-hand label, so a long name can neither clip nor run under the legend. Do not go back to a fixed margin with an ellipsis: two "AA-Omniscience v1.1…" spokes could not be told apart, and the share card clipped them.
- **What a benchmark measures.** Hovering a name opens a card under it with the description (`benchmarkBlurb` in `src/lib/benchmark-blurb.ts`: the "Name: " opening dropped, whole sentences up to about 220 characters) above each model's value. The card has a set width and is clamped inside the radar's box. A click still opens the full benchmark dialog. Under the panel, a collapsed "What each benchmark measures" key lists every benchmark with its full description, which is the route on a phone. In the HTML embed the name's native tooltip carries the description.

- **Range scale.** A spoke runs from a margin below the lowest model drawn to the best ranked model (`zoomAxes` in `radar-data.ts`), not from the field's worst: with the field's worst as the bottom, the top models all sat at the rim and could not be told apart. The scale moves when the selection changes. A field median below the bottom is not drawn or named.
- **Category spokes.** Settings → Show → Categories draws one spoke per category instead of one per benchmark (`radarByCategory` in `radar-view.ts`): a category is worth the sum of its benchmarks' shares, and a model's value there is the share-weighted mean of its 0 to 100 values on the category's benchmarks it has. With more than 12 benchmarks the radar does this by itself (`RADAR_MAX_BENCHMARK_SPOKES`); it needs three categories. Link param `rg=cat` or `rg=bench`. A category spoke has no benchmark card. The model page's "By category" radar (`ModelDomains.tsx`, `standing` in `src/lib/model-view.ts`) is a different measure: the model's average place among the ranking's models, over every current benchmark that measured it, with a benchmark counted in each of its categories.

The toolbar toggle switches the panel to `BenchBars.tsx`: one bar chart per benchmark (Artificial Analysis style), the selected models best first on each, top 8 until the user picks models (the radar follows the top 4). Link param `rv=bars`. Export is a sheet of the on-screen charts (PNG/SVG, CSV/JSON); no HTML embed in this view.

## Loading the library

ECharts is about 650 KB of script, so `useEChart` imports it the first time a chart mounts, and `BuilderLoader` starts that import early because the builder opens on a chart. Import colors, option builders and other helpers from `chart/theme-tokens.ts` or `chart/echarts.ts`, never `chart/theme.ts`, which pulls in the library (only server cards and the assistant's print view, itself a dynamic import, use it). A chart's effects may run before its instance exists: read `chart.current` with a null check, and put event wiring in `onReady`.
