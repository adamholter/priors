# Profile pages, themes, share cards and link previews

## Routes

| Route | What it is |
| --- | --- |
| `/` | Onboarding for new visitors. Links that carry an index, and visitors with a saved mix, go to `/builder`. |
| `/rank` | The onboarding, always reachable. See `docs/onboarding.md`. |
| `/builder` | The explorer: weights, rankings, charts. State lives in the URL. |
| `/[handle]` | A published page. |
| `/explore` | Published pages. |
| `/compare` | Two rankings side by side. See Compare below. |
| `/models/[id]`, `/model-finder` | One model's results (Strengths: a radar against the index leader and field median, and where it sits on each benchmark; Cost and speed: index score against cost per task by effort, and field strips for cost, time per task, output speed, time to first token and output tokens, naming any it lacks; per-benchmark cards plot score against cost, or the field's spread when cost is unknown); a guided model picker. |
| `/claim`, `/sign-in` | Pick a handle; Clerk sign-in. |
| `/import`, `/skill` | Benchmark import; the agent skill. |
| `/og`, `/[handle]/opengraph-image`, `/models/[id]/opengraph-image` | Share card and link-preview images. |
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
- **A link carries what a visitor changed, not just the selection** (`hv`). On a page, hiding models in chart settings, the effort mode, release window, cost and time sources are local to the visit and never saved, so links used to drop them and a curated chart opened with every model back. `viewParam` (`src/lib/highlight-link.ts`) writes the settings that differ from the saved page in the index codec's keys (`ex`, `only`, `after`, `costsrc`, `costbasis`, `timesrc`, `pareto`, `bars`, joined with `|`). The address bar keeps it current, chart links and the share link carry it, and the page, the link preview and `/og` apply it to the index `hi` names (`linkedViews`). A link that opens the editor (`?edit=1`) ignores `hl` and `hv`, because the editor autosaves what it shows; pressing Edit page on a page opened through them reloads as `?edit=1` (same tab) for the same reason. Removing a single point with the chart's own menu travels separately (`ch`). A link can clear a hide list (`ex=`) but cannot unset the other settings, so a saved value a visitor changed back to default is not expressible.
- **The share link is the bare page address** unless it has to name another tab (`hi`) or a selection that differs from the saved one (`hl`).
- **Images go through the backend's upload endpoint.** `POST /upload?field=avatar|banner` on the deployment's `.convex.site` address (`convex/http.ts`), with the user's Convex token as a bearer token. The server reads the file, checks it and stores it itself, so no file id ever comes from a browser and a stored file always has an owner on record (`uploads`). In order: signed in, stated size at most 8 MB, the account's 40 uploads a day (`uploadUsage`, counted per account so re-claiming a page does not reset it), then the bytes, which must be a PNG, JPEG, WebP, GIF or AVIF. The type an image is stored and served with comes from its bytes, never from what the browser declared, and SVG is refused because it can carry script. The body is read as a stream, so the size limit and the image check stop it while it arrives, whatever content-length it stated. Nothing is stored unless every check passes.
- **The photo in the header is an account menu** (`src/components/AccountMenu.tsx`, `HeaderAccount`). Wherever a header shows the signed-in person's photo (builder, Explore, model finder, model pages, published pages, phone and desktop), clicking it opens Change photo, Use my sign-in photo (when it differs from the page's), Edit profile (`/<handle>?edit=1`), View my page and Sign out. Change photo runs the same upload as the page editor (`useImageUpload`), so a photo set there shows everywhere without the sign-in provider's picture. Signed in with no page yet, the menu offers Publish to Explore. Signed out, the same slot is "Sign in".
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
- **Profile links.** `?c=` is a section title slug; `resolveProfileChart` (`src/lib/profile-chart.ts`) maps it to the chart over the layout the page shows (`pageLayout`), including sections the page shows without having saved them, so a link to the default cost chart unfurls as that chart and not as the rankings. `/[handle]` unfurls through `/[handle]/opengraph-image`. A link to a chart, a selection or another tab (`?c=`, `?hl=`, `?hi=`) goes through `/og?handle=&hi=<index id>`, which names the index instead of spelling it out, so the image address stays short. The title names the tab and chart; the description is the bio, then the open index's top three models.
- **Model links.** `/models/[id]` unfurls through `/models/[id]/opengraph-image` (`src/lib/og-model.ts`): name, lab and release, the General frontier score and rank (with estimates when the model can't rank on measured data alone, as on the page), its three best benchmark placements, and its strengths radar against the #1 model and the field median. The description says the same in a sentence. The image address carries the snapshot date, so caches refresh daily.
- **Caching.** Profile image addresses carry `v=<updatedAt>`, so a cached preview never outlives an edit.
- Both take the saved page theme in its own mode through `profileCardLook` in `og-chart.ts`. A page locked to dark, or on a dark theme, unfurls dark. A page set to follow the visitor unfurls in the theme's signature mode (Priors and Analysis light, Slop dark), because a crawler has no light or dark preference.
- An explicit `theme=` or `scheme=` on `/og` wins over the saved theme.
- **Readable addresses.** `prettyQuery` in `src/lib/url.ts` writes builder links with `:`, `,` and `=` unescaped and `+` for spaces. The `|` between fields stays escaped, because chat apps cut a link at a bare pipe.

## Explore cards
Each card on `/explore` (`src/components/explore/ExploreCard.tsx`) wears its owner's page theme through `resolvePreset`: it follows the visitor's light/dark unless the owner fixed a mode, and single-mode themes stay as picked. The top three show as zoomed podium columns, the benchmark mix is one truncated line, the owner's X link (from `socials`, x.com or twitter.com) is a handle chip, and the footer splits View page | Compare (your ranking against theirs, `/compare?a=me&b=@handle`) | Remix (opens the mix in the builder as a copy). `profiles.explore` returns `theme` and `socials`; run `npx convex deploy` before pushing changes to it.

## Compare
`/compare?a=<ref>&b=<ref>` puts any two rankings side by side. A ref (`src/lib/compare-ref.ts`) is `me` (the visitor's own: their published page's main index, else the first index in their builder), `@handle` or `@handle~tab` (a page, its main index or the tab a link would name), `preset:aa` or `preset:general`, or an index spelled in the builder's codec, so an unsaved ranking compares too. `n` is the length of the top lists (5, 10 or 20) and `same=1` keeps only models both sides rank and ranks them again among themselves. The address follows every change, so it is the share link; a side that is the visitor's own is written as their handle or their spelled index, never as `me`. A link to `/compare` with no `a` fills the left side with the visitor's own ranking.
- **Entry points.** The Compare action on every Explore card, a Compare button in a published page's header (it names the open tab), and Compare beside the Explore header's actions. Visitors with no ranking get "Rank models · 1 min" in the picker.
- **Each side** is one index run on today's data with its owner's imported benchmarks and the page default view (`rankSide` in `src/components/compare/choice.ts`), shown as models (best variant each) by rank. The picker offers the visitor's rankings, published pages (a page with several tabs asks which), the presets, and a pasted link or handle.
- **What it says** (`src/lib/compare.ts`, tested): how many of the top `n` are on both lists, Spearman rank correlation over the models both rank, the two models with the biggest rank gap, and the share of weight the two mixes put on the same benchmarks. Ranks are as each side publishes them unless `same=1`. The slope draws a line from each model to its place on the other list; a model off the other top list keeps a stub and its rank there, or a dash when that side does not rank it.
- **Narrow screens** get the matched table instead of the slope (`.cmp-wide` and `.cmp-narrow`).
- The page's description for link previews is computed from the same numbers (`generateMetadata` in `src/app/compare/page.tsx`); the image is the default card.

## Labs

A lab is a noindex page under `/lab/` that shows three or four switchable variants of one design question, on the real page. When the question is settled, the winner goes live and the lab and losing variants are deleted.

- `/lab/themes`: every page theme on a sample page, with edit mode available without signing in. Nothing saves. Kept as a tool.
- `/lab/compare`: the compare page with its open questions switchable on sample people: layout (slope, boards, matched table, gaps, podiums), summary, how a side is chosen (menu, faces, sheet) and where Compare lives (card footer, pick two, page header). Open question.
- `/lab/index`: where "Publish to Explore" sits on the builder (`labPlacement` in `Builder.tsx`). Open question.

## History
`/history` is not linked from anywhere. It shows the top 20 of an index on every snapshot date (`data/snapshots/<date>.json.gz`), played back in time (or forward) with a scrubber. The index comes from `?i=`, else the builder's saved index, else General frontier. `/api/history?i=&mode=` computes it server-side (`src/lib/history.ts`, no sign-in, cached per index), and `src/lib/history-frames.ts` interpolates between dates (ranks slide, scores blend, a model in one frame fades).

- `mode=fixed`: today's index as written, scored on each day's data. A benchmark not yet published that day has no scores.
- `mode=adapting`: each day also drops benchmarks that fewer than 8 models had published scores for. Identical to fixed when every benchmark was well covered throughout (true for General frontier).
- `/history?video=1` is the bare stage; `scripts/history-video.mjs <baseUrl> <out.mp4> [seconds]` steps it frame by frame with Playwright and encodes with ffmpeg.
- History only goes back to the first snapshot (2026-09-05).
