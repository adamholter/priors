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
| `/sitemap.xml`, `/robots.txt` | The fixed routes, every model page and every published page, rebuilt hourly. |
| anything else | `src/app/not-found.tsx`, for a mistyped handle, a model that left the data, or a broken link. |
| `/lab/*` | Design labs, not indexed. See below. |
| `/api/agent`, `/api/assistant` | See `docs/assistant.md`. |
| `/api/benchmarks`, `/api/snapshot`, `/api/library`, `/api/lineup` | Data for agents, the onboarding search, and returning visitors. |
| `/ingest/*` | PostHog proxy. |

## Profile pages

- Stored in Convex `profiles`: handle, display name, bio, links, indices, sections, theme, imports, agent token hash. Shapes are defined once in `convex/validators.ts`.
- `src/components/page/IndexPage.tsx` renders the page from `sections` (rankings, pareto, gallery, speed, text and so on).
- **Editing is inline.** The owner edits on the page itself (`IndexPage` plus `PageEdit.tsx`): section frames (drag, move, hide, remove), "+ Add section" between sections, inline name, bio, titles and text, the More metrics layout (`section.metrics`: order, shown, starts open, per-chart `view`) and per-chart owner defaults (`section.view`). Edits autosave through a debounced `profiles.update`, with undo.
- **Edit chrome never overlaps.** Each section frame has a toolbar row of its own above the section, the open index's tools (Make main, move, remove) sit on a row under the tabs, and "Add section" takes its own 32px row where only the button is clickable. Nothing uses negative margins or absolute overlays, and editing sets one 16px gap between rows, so a theme's spacing (Slop has none) cannot stack controls. Page text fields opt out of password-manager autofill.
- The Page settings drawer (`PageEditor.tsx`) holds theme presets, the light/dark lock, accent, share card design, links, photo and banner, and the agent token.
- **Several indices are tabs.** A page with more than one index shows them as tabs under the header, in stored order (`PageTabs` in `PageEdit.tsx`). The first is the page's main index: link preview, Explore card, and the ranking a visitor is compared with. Explore lists the other tabs by name.
- **Tab links.** `?hi=` opens a tab. Links write the index name as a slug (`?hi=adams-capabilities-index`) and fall back to the id when the slug is empty or shared; `findTab` accepts either, so older `?hi=i1` links still open. Share, chart and highlight links carry it.
- **Tab keys and the Konami code.** With a tab focused, left and right (and Home and End) move between tabs. A press that is the next step of the Konami code (`midCode` in `src/lib/konami.ts`) is left alone, so entering the code never switches tabs, and the tab handler never stops the key on its way to the code's listener.
- **A section belongs to the tab of its `indexId`.** Text, links and benchmark tables with no `indexId` sit on every tab. `src/lib/page-layout.ts` holds the rules, including the sections a page shows without saving them: a tab with no charts copies the first tab's layout, and every tab gets More metrics. While editing, the open tab can be renamed, moved, made the main index or removed, and a new section joins the open tab.
- **"Save to my page" in the builder never drops an index** (`saveToPage`). For the owner, "Open in builder" tags each index with the page index it came from (`page=handle.id.key` in the builder's address, never stored), and saving updates that one, so a rename keeps its tab. The key is made in the owner's tab on that click and kept in sessionStorage; a reference without it is ignored, so a link someone else wrote can never choose which tab a save overwrites. Without a trusted tag an index updates the page index of the same name. Anything else joins the page as a new tab. Builder ids are positional and change on every URL round trip, so they are never used to match. An index is removed on the page itself.
- **Deleting a page** is under Theme & settings: the owner types the handle, and `profiles.remove` deletes the profile, its imports and its uploaded images. The handle is free to claim again.
- **The share link is the bare page address** unless it has to name another tab (`hi`) or a selection that differs from the saved one (`hl`).
- **Images go through the backend's upload endpoint.** `POST /upload?field=avatar|banner` on the deployment's `.convex.site` address (`convex/http.ts`), with the user's Convex token as a bearer token. The server reads the file, checks it and stores it itself, so no file id ever comes from a browser and a stored file always has an owner on record (`uploads`). In order: signed in, stated size at most 8 MB, the account's 40 uploads a day (`uploadUsage`, counted per account so re-claiming a page does not reset it), then the bytes, which must be a PNG, JPEG, WebP, GIF or AVIF. The type an image is stored and served with comes from its bytes, never from what the browser declared, and SVG is refused because it can carry script. The body is read as a stream, so the size limit and the image check stop it while it arrives, whatever content-length it stated. Nothing is stored unless every check passes.
- **A page holds at most one photo and one banner.** Replacing or clearing one deletes the old file (`dropFile`), and deleting the page deletes both. The public `profiles.byHandle` never returns storage ids, the account id or the token hash.
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

- **Every route has a full preview.** `pageMeta` in `src/lib/site-meta.ts` builds title, description, canonical address, site name and a large image for a route. Use it for any new route: a route's `openGraph` replaces the layout's whole, so a bare `title` would unfurl with the site's default title. Routes with no card of their own show `/og`, the default leaderboard on today's data.
- **Builder links.** A share link points at `/builder?i=...` and unfurls as its card through `/og?...`. The description names the top three models and the benchmark mix (`indexSummary`).
- **Profile links.** `/[handle]` unfurls through `/[handle]/opengraph-image`. A link to a chart, a selection or another tab (`?c=`, `?hl=`, `?hi=`) goes through `/og?handle=&hi=<index id>`, which names the index instead of spelling it out, so the image address stays short. The title names the tab and chart; the description is the bio, then the open index's top three models.
- **Caching.** Profile image addresses carry `v=<updatedAt>`, so a cached preview never outlives an edit.
- Both take the saved page theme in its own mode through `profileCardLook` in `og-chart.ts`. A page locked to dark, or on a dark theme, unfurls dark. A page set to follow the visitor unfurls in the theme's signature mode (Priors and Analysis light, Slop dark), because a crawler has no light or dark preference.
- An explicit `theme=` or `scheme=` on `/og` wins over the saved theme.
- **Readable addresses.** `prettyQuery` in `src/lib/url.ts` writes builder links with `:`, `,` and `=` unescaped and `+` for spaces. The `|` between fields stays escaped, because chat apps cut a link at a bare pipe.

## Labs

A lab is a noindex page under `/lab/` that shows three or four switchable variants of one design question, on the real page. When the question is settled, the winner goes live and the lab and losing variants are deleted.

- `/lab/themes`: every page theme on a sample page, with edit mode available without signing in. Nothing saves. Kept as a tool.
- `/lab/index`: where "Publish to Explore" sits on the builder (`labPlacement` in `Builder.tsx`). Open question.
