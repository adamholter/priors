# Design system

Brand boards live outside the repo at `~/priors-brand/index.html`.

## Rules

- No taglines, no pills or chips, no gradients.
- Never hardcode a hex color in a component. Use the tokens. (The share-card renderer and page presets are the exceptions: they define palettes.)
- No em dashes in user-facing copy.
- One accent: indigo, the dot of the i in the wordmark.

## Tokens

Defined in `src/app/globals.css`.

| | Light | Dark (`:root[data-theme="dark"]`) |
| --- | --- | --- |
| Background | bone `#FBFBF9` | warm near-black `#141413` |
| Raised surface (`--white`) | white | `#1C1C1A` |
| Ink | `#1A1A1A` | `#EDECE6` |
| Accent text (`--indigo`) | `#2F4FB0` | `#9AABF5` |
| Button fill (`--indigo-fill`, text `--on-accent`) | `#2F4FB0` | `#3E5BC2` |

Plus warm grey, hairlines, and `--brand-i` for the wordmark's i.

`src/onboarding/onboarding.css` keeps its literals in generated `--ob-*` variables (light is the original literal, dark is the mapped value).

## Type

Newsreader (display and serif), Inter (text), JetBrains Mono (numbers). Themed pages bring their own: see `docs/pages-and-sharing.md`.

## Large screens

The builder grows with the screen (`src/components/builder.css`, `builder-size.ts`). From 1024px it centers within 1720px. From 1280px text, ranking rows and the sidebar scale 1.1×, from 1600px 1.2×. The header and sidebar use CSS `zoom`, and dialogs and the benchmark sheet opened from them undo it so they still fit the screen. Charts never sit under a zoom (ECharts misreads the pointer there): they take the same scale through `ChartPalette.size` (text, marks, plot height, ranking row pitch), which is 1 everywhere else. Phones keep their layout, with slightly larger chart dots.

## Light and dark

`src/components/Theme.tsx`. System default; the light/dark button in every header (and the Mode control on `/settings`, which also offers System) pins `localStorage["priors:theme"]` (mirrored in the `priors_theme` cookie). No flash of white for a dark system: the root `viewport` declares `colorScheme: "light dark"`, and an inline `<style>` (`THEME_CRITICAL_CSS` in `src/lib/theme-critical.ts`) paints the dark page color while `<html>` has no `data-theme`, so the first paint is dark even before the stylesheet or the head script run. The head script then sets the real scheme.

**Site theme.** `/settings` (`SiteSettingsPanel` in `SiteSettings.tsx`; an advanced page no menu links to, see docs/pages-and-sharing.md): any page theme (`THEME_CHOICES`) can be the visitor's theme for the builder, Explore, model pages and onboarding. `src/lib/site-theme.ts` turns a preset into site tokens (`presetStyle` plus the wordmark i and onboarding's surface tokens) and sets them inline on `<html>`; Priors sets nothing. `localStorage["priors:site-theme"]` holds the id and both modes' tokens so the no-flash script paints them before React. Single-mode themes force the scheme (Midnight is always dark). The root `ChartPaletteContext` uses `paletteFor(preset)`, so lab colors and chart style follow. `.page-root` sets its owner's tokens on top, so published pages are unchanged; family stylesheets (layout details) apply only on pages.

The picker also has "Explore themes", a library of extra looks (see `docs/pages-and-sharing.md`); a library theme is a site theme the same way.

- The no-flash script is first in `<body>`, not in `<head>`: in `<head>` it caused a hydration error on static pages.
- The root `ChartPaletteContext` switches charts between `LIGHT_PALETTE` and `DARK_PALETTE` (or the site theme's palette).
- Lab colors have dark-tuned versions. Never read `lab.color` directly for display: use `markColor()` in charts and `useLabColor()` in the DOM.

## Phones

Below 1024px the builder is one column in this order: ranking (top 10, then Show all), the mix when open, the other charts (`builder.css`). The mix panel starts closed on AA's index. With it closed, from 1280px the ranking and the cost chart share the first screen. `.builder-charts` becomes `display: contents` so the mix can sit between its children. The header is two short rows: the date moves into the mix's caption, and "Compare with the default mix" moves under it. Long benchmark names wrap there. Any small control takes `.hit`, which gives it a 40px tap area on touch screens without changing how it looks. The assistant button steps aside while the mix's sliders pass under it.

## Motion

- Rankings are keyed rows moving between list-local positions. See `docs/charts.md` for why viewport FLIP is banned.
- Animations honor `prefers-reduced-motion`.
- Page transitions use `PageTransition.tsx` and `transitionTypes` on links.
- `NavProgress.tsx` answers a link's click at once with a thin bar until the new page arrives. Between the click and the arrival a `history.replaceState` makes the router drop the navigation, so URL writers on a timer check `leaving()` first (`nav-progress.ts`).
- Controls whose change redraws charts (model checkboxes, the cost chart's scatter and bars switch) use `useOptimistic` and `startTransition`: the control answers now and the charts follow.

**Disclosures and dropdowns.** A collapsible section's summary takes `.disclosure` (`.disclosure-inline` when it sits in running text): one drawn chevron on the right, never a text glyph or the browser marker. Every `<select>` gets the same chevron from `globals.css`, and long values end in an ellipsis clear of it.

## Calculation settings

The mix's Calculation settings dialog (`CalculationSettings.tsx`, `calculation-settings.css`; redesigned 2026-11-20 after Adam called the long scrolling version confusing) has four tabs. **Settings** holds every setting on one screen with no scrolling at desktop and tablet widths: a label column and a control column, the scoring method as three cards, two checkboxes for missing scores, the strictness slider with one live sentence, and one checkbox chip per benchmark for Required. Each long explanation sits behind its info button, one open at a time. **Breakdown** is one model's calculation, **Left out** lists the variants the settings exclude (its count is on the tab and changes as you move strictness), and **Sources** has the Artificial Analysis note and the source list. The dialog hangs from a fixed top and its title and tabs stick, so switching tabs moves nothing. All four panels stay mounted (the Sources panel checks for newer data).

## Benchmark quality panel

A benchmark page's quality panel (`QualityPanel.tsx`; redesigned 2026-11-20 after Adam asked for something readable at a glance instead of rows of methodology) opens with the score as a ring dial, then one card per part of the score in a grid. Each card has the part's own icon (calendar for recency, stopwatch for new models, a lock that is open for a public test set), its name, a ring showing its score out of 100, the answer in a few words ("Public", "41 of 41 new models, same day") and the question it answers (`QUALITY_FACTORS[].ask`). The share of the score is a small figure in the corner. How each part was worked out, the points, and stars and page uses sit under one closed disclosure below the grid.

## Benchmark page header

`BenchmarkHeader.tsx` (small parts in `header-ui.tsx`, text rules in `src/lib/benchmark-header.ts`, styles in `benchmark-header.css`, classes `bench-top-*`) is the top of `/benchmarks/<id>`, in the page's own order: crumb, name with the star (icon and count) riding the last word, the description, warnings, the Version and Category menus, then one row of icon facts. A long description closes to a whole sentence (`shorten`, 175 characters, 120 on phones) with a chevron after its last word that opens the rest in place. Each warning (stopped publishing, series break, superseded, stale, notice) is one short sentence with an indigo icon and a medium-weight lead, and one chevron after the first opens every row to its full wording and the link to the publisher's method; the `data-*` attributes checks use (`data-series-break`, `data-stopped-publishing`, `data-benchmark-notice`) stay on the rows. The facts row is the quality ring (a link that scrolls to the panel and outlines its total card; the one `data-quality-summary`), Priors Recommended, test set, model count (indigo when under 8), updated date, "Best setting" for best-measured boards, and the source host; each has its sentence on hover, focus or tap (`Tip`, drawn in the window). The height of the description and warnings eases open and closed and is instant under reduced motion. The header is memoized, since the page re-renders on every setting.

## Site nav, search and the mix menu

Every standard page uses one header, `SiteHeader`, so height (56px), spacing and contents match: the wordmark, the five places with icons (`SiteNav`, icons from 1024px), the universal search as an open field from 1024px (growing into the free space up to 340px; an icon below that), the page's own actions, sign-in and settings. On phones the five places and Search are a row under it that hides while you scroll down and pins back on any scroll up. The Builder and published pages keep their own headers (share, publish) at the same 56px and the same parts; the Builder's header no longer scales with its large-screen zoom. The footer leads with the wordmark beside the five places and uses the header's side padding. Search (from Faye Quepeerzade's header mockups, November 2026) is one palette per page (`SiteSearchHost`, mounted by the root layout); the header's field (from 1024px; from 1280px on the Builder; an icon below that), the phone row's Search and ⌘K or Ctrl+K open it. It searches models (with their Priors score), benchmarks, pages and three actions (theme, support, report), from `/api/search`, fetched the first time it opens. "/" is left to the pages' own search boxes. On the Builder the ranking's title is the mix name and opens the mix menu (`MixMenu`, the same mockups, which replaced the header's tab strip): the open mixes to switch between (with their top three labs when the mixes disagree about them), a new mix (a copy of this one, named for what it holds, e.g. "AIME + CritPt", and open for renaming), rename this mix in place, close it when more than one is open or reset it to the default when it is the only one and yours, then Rank models and Change the mix. Arrow keys, Home, End and typing a letter move through the rows; Esc hands focus back to the title. Under the title one line, `SourceLine` (`source-line.css`), says whose scores these are and how old: "Artificial Analysis, updated 15 h ago" (your own mix says "3 benchmarks" instead). The age is read after hydration on a minute clock (`use-now.ts`), reads in ink instead of grey once the data is over three hours old (`freshness.ts`), and its button opens the sources behind it with each one's last fetch (a failed one is named). On phones the line shares the row with the toolbar.

## Rank models A/B test (since 2026-11-27)

Half of visitors see Rank models in the header (links and the phone row, `.rank-in-header`), half see it only as a floating button in the bottom-right corner (`RankFloat`, beside the assistant's button where there is one). `src/lib/ab-rank.ts` picks the arm before first paint, keeps it in localStorage, sets `<html data-rank-place>`, and CSS shows one placement; `?rankplace=header|corner` forces one. Every PostHog event carries `rank_placement`, and clicks send `rank_cta_clicked` with `placement` (`header`, `header_phone` or `corner`). Compare `onboarding_started` and `onboarding_completed` per visitor between the arms (PostHog dashboard "Rank models A/B"). Automated browsers get the header arm unassigned. The footer and the Builder's "Rank models" line are the same in both arms.
