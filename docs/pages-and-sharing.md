# Profile pages, themes, share cards and link previews

## Routes

| Route | What it is |
| --- | --- |
| `/` | Onboarding for new visitors. Links that carry an index, and visitors with a saved mix, go to `/builder`. |
| `/rank` | The onboarding, always reachable. See `docs/onboarding.md`. |
| `/builder` | The explorer: weights, rankings, charts. State lives in the URL. |
| `/[handle]` | A published page. |
| `/explore` | Published pages. |
| `/models/[id]`, `/model-finder` | One model's results; a guided model picker. |
| `/claim`, `/sign-in` | Pick a handle; Clerk sign-in. |
| `/import`, `/skill` | Benchmark import; the agent skill. |
| `/og`, `/[handle]/opengraph-image` | Share card and link-preview images. |
| `/lab/*` | Design labs, not indexed. See below. |
| `/api/agent`, `/api/assistant` | See `docs/assistant.md`. |
| `/api/benchmarks`, `/api/snapshot`, `/api/library`, `/api/lineup` | Data for agents, the onboarding search, and returning visitors. |
| `/ingest/*` | PostHog proxy. |

## Profile pages

- Stored in Convex `profiles`: handle, display name, bio, links, indices, sections, theme, imports, agent token hash. Shapes are defined once in `convex/validators.ts`.
- `src/components/page/IndexPage.tsx` renders the page from `sections` (rankings, pareto, gallery, speed, text and so on).
- **Editing is inline.** The owner edits on the page itself (`IndexPage` plus `PageEdit.tsx`): section frames (drag, move, hide, remove), "+ Add section" between sections, inline name, bio, titles and text, the More metrics layout (`section.metrics`: order, shown, starts open, per-chart `view`) and per-chart owner defaults (`section.view`). Edits autosave through a debounced `profiles.update`, with undo.
- The Page settings drawer (`PageEditor.tsx`) holds theme presets, the light/dark lock, accent, share card design, links, photo and banner, and the agent token.
- **Model lists are never stored by the editor.** Hiding models writes `excludeModels` only, so new models appear automatically.
- Ownership on the client is a hint (`localStorage["priors:handle"]`) confirmed by `OwnerProbe`; Convex mutations enforce it.

## Themes

`src/lib/page-presets.ts` defines every theme: colors, fonts, lab colors, card radius and chart style. `family` (`priors`, `aa`, `slop`, `classic`) switches the scoped stylesheet `src/components/page/page-themes.css`.

- Paired themes (`bone`/`night`, `aa`/`aa-dark`) follow the visitor's light or dark mode unless `theme.mode` is `fixed`. In the editor, "Follow visitor" stores the family's signature preset with no mode; "Always light" and "Always dark" store that preset with `mode: "fixed"`.
- Slop is dark only, like Slopalytics. Pages saved with the old `slop-light` id show Slop.
- The classic themes (Paper, Sand, Graphite, Midnight, Forest) are single-mode.
- Ids `bone` and `night` are kept for stored pages; they display as Priors Light and Priors Dark. A page on `bone` (or with no theme) follows the site theme.
- Analysis uses Switzer (Fontshare, free commercial license, vendored in `src/app/fonts` and `src/lib/og-fonts`) as the stand-in for Artificial Analysis's licensed Suisse Int'l, and Source Serif 4 for its serif. Slop uses DM Sans. Lab colors come from each site's own palette.
- Charts read theme style through `ChartPalette` (`fonts`, `labColors`, `style`: dotted grid, dotted frontier, the Analysis "most attractive quadrant" area, bar labels inside bars).

## Share cards

- `src/lib/og.tsx` draws all 13 designs listed in `src/lib/share-designs.ts`. "Leaderboard" (`board`) is the default; `qr` embeds a QR code. Every footer reads `mypriors.com · <date>`.
- `/og` takes an index (`i=`), `design`, `date`, `theme` (a preset id), `scheme` (`light` or `dark`), `handle`, and `c` for a single chart.
- Chart cards are real ECharts renders: `src/lib/og-chart.ts` builds the same option the page uses and rasterizes it with resvg.
- Dark cards (`SCHEMES` in `og.tsx`) use dark-tuned lab colors, dark text inside bars, an indigo spotlight panel, and a QR code on a light tile.
- The share dialog is `src/components/ShareCards.tsx`. It starts in the page's theme and mode, can pick another theme, and has a Light/Dark switch for themes that have both. From the builder it carries `theme` and `scheme` into the posted `/builder` link so the unfurl matches the preview. From a profile page it posts the page's own URL, so the unfurl follows the saved page theme.
- X's web intent cannot attach an image, so the dialog offers Download for that.
- The three intro cards shown in "How it works" are pre-rendered into `public/intro/` (light and dark) by `scripts/scrape/intro-cards.ts` on every scrape.

## Link previews

- A share link points at `/builder?i=...`. `/builder` sets its og and twitter image to `/og?...`, so the link unfurls as the card.
- A profile link (`/[handle]`) unfurls through `/[handle]/opengraph-image`; a chart or highlight link from a profile (`?c=`, `?hl=`) goes through `/og?handle=`.
- Both take the saved page theme in its own mode through `profileCardLook` in `og-chart.ts`. A page locked to dark, or on a dark theme, unfurls dark. A page set to follow the visitor unfurls in the theme's signature mode (Priors and Analysis light, Slop dark), because a crawler has no light or dark preference.
- An explicit `theme=` or `scheme=` on `/og` wins over the saved theme.

## Labs

A lab is a noindex page under `/lab/` that shows three or four switchable variants of one design question, on the real page. When the question is settled, the winner goes live and the lab and losing variants are deleted.

- `/lab/themes`: every page theme on a sample page, with edit mode available without signing in. Nothing saves. Kept as a tool.
- `/lab/index`: where "Publish to Explore" sits on the builder (`labPlacement` in `Builder.tsx`). Open question.
