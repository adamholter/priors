# Priors: editing the user's page

All of these are write tools (the user's token). Start from `whoami`. The `upsert_*` tools change one thing and leave the rest alone, so prefer them to `set_indices` and `set_sections`, which replace the whole list.

## Indices

An index is one ranking: benchmark weights plus rules. A page with several shows them as tabs in order, and the first is the page's main index. `upsert_index` with an existing `id` changes that index (fields you omit stay, `weights` is replaced whole); a new `id` adds a tab. Leave indices the user did not mention alone.

| field | meaning |
|---|---|
| `id`, `name` | Rename freely, keep `id` stable |
| `weights` | `benchmarkId` to weight, any positive scale. Ids come from `list_benchmarks` |
| `required` | Benchmark ids a model must have a measured score on to be ranked |
| `strictness` | 0 to 100. Higher demands more measured data per model; 100 turns estimation off |
| `estimateMissing` | `true` estimates a missing benchmark from similar models, `false` renormalizes the measured weights |
| `effortMatching` | `calibrated` (default) infers a missing effort's score from the model's ratios elsewhere, `strict` uses exact efforts only |
| `rankingVariants` | `best` (one row per model) or `all` (every effort) |
| `paretoVariants` | `all` (default) or `best`, for the cost chart only |
| `excludeModels` | Model ids hidden from this index. Hide models this way, never by storing a list of the ones to show, so new models still appear |
| `variants`, `cutoff`, `optional` | Legacy. Keep them as they are |

Other fields (`efforts`, `releasedAfter`, `costBasis`, `highlight`, `labs`) are described in the `upsert_index` tool and in `docs/data.md` of https://github.com/adamholter/priors.

## Text and links

`update_page` takes any of `displayName`, `bio`, `socials` (`[{ label, url }]`), `avatarUrl`. Only the fields you give change.

## Sections

The page is an ordered list of sections: `{ id, kind, title?, indexId?, benchmarkId?, body?, links?, hidden?, view?, metrics? }`. Use `upsert_section` (with `position` for a new one) and `remove_section`.

| `kind` | shows |
|---|---|
| `rankings` | Ranked bars for `indexId` |
| `pareto` | Score against cost per task for `indexId` |
| `speed` | Score against output speed for `indexId` |
| `benchmark` | One benchmark's leaderboard (`benchmarkId`) |
| `history` | How the frontier for `indexId` moved over time |
| `gallery` | Collapsed charts for `indexId`: time per task, speed, latency, release date, uptime. Every page gets one. To remove it, add `{ kind: "gallery", hidden: true }` |
| `text` | A paragraph (`body`) |
| `links` | A list of links (`links`) |

- On a page with several indices a section shows on the tab of its `indexId`. `text`, `links` and `benchmark` sections with no `indexId` show on every tab. An index with no chart sections of its own uses the first tab's layout.
- `view` on `pareto` and `speed` sets what visitors see first: `{ kind?: "scatter"|"bars", scale?: "log"|"linear", frontier?: boolean, links?: boolean, labelScale?: number }`.
- `metrics` on `gallery` is an ordered `[{ id, hidden?, open?, view? }]` over `tpt`, `strengths`, `speed`, `latency`, `tokens`, `date`, `uptime`, `usage`. A metric left out of a saved list is hidden, so list every one that should show.
- Keep titles short and plain.

## Theme and CSS

`set_theme` changes only the fields you give. `theme_presets` lists the presets.

| field | effect |
|---|---|
| `preset` | Whole-page theme. Restyles fonts, charts, lab colors and share cards |
| `mode` | `fixed` keeps the chosen light or dark version; otherwise it follows the visitor |
| `accent` | Hex color for links, highlights and the wordmark |
| `surface` | `bone` or `white` page background |
| `serif`, `mono` | Font names for headings and for numbers |
| `css` | A stylesheet for the page, up to 10 KB. An empty string clears it |

Prefix every `css` selector with `.page-root`:

```css
.page-root { --indigo: #7A3FA0; }
.page-root h1, .page-root h2 { letter-spacing: -0.03em; }
```

- Custom properties to redefine inside `.page-root`: `--bone`, `--white`, `--ink`, `--ink-2`, `--grey`, `--hair`, `--hair-2`, `--indigo`, `--indigo-soft`.
- Classes: `section`, `.cap` (small labels), `.btn`, `.btn-quiet`, `header`, `footer`, `.serif`, `.mono`, `.num`. Fonts are Newsreader (headings), Inter (body), JetBrains Mono (numbers); another webfont needs `@import` in `css`.
- Charts are drawn on canvas, so CSS styles the page around them and presets style the charts. The share card follows `preset`, `accent` and `surface`, not `css`.
- Change what the user named and keep the rest of the Priors look: quiet, editorial, hairline borders, generous space. A broad ask ("make it feel like me") means accent, surface and section order. Dark mode means redefining the surface, ink and hairline tokens together.
- After a CSS change, fetch `https://mypriors.com/<handle>` and confirm the stylesheet is in the page.

## A custom theme file

A theme file sets colors for light and dark, fonts, corner radius and chart style in one JSON object (`"priorsTheme": 1`).

1. Ask what look they want if they have not said. Given a site or brand to match, read its real colors.
2. `curl -s https://mypriors.com/api/theme` returns the format, the fonts allowed and a full example. Write one JSON file to it.
3. Validate: `curl -s https://mypriors.com/api/theme -H 'Content-Type: application/json' --data @my-theme.json`. Fix every error and every readability warning, then validate again.
4. Hand it over. The user uploads it under Settings, Theme, Explore themes, Bring your own theme (no token needed). To put it on their page yourself, `set_theme` with `preset` set to the `id` the validator returned (add `.d` for the dark version).

Done when `whoami` shows your change, the live page shows it, and for a theme file the validator answers `ok` with no readability warnings.
