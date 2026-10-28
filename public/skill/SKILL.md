---
name: priors
description: Work on a person's Priors page (mypriors.com) — add a benchmark to their index data, retune their index weights and ranking rules, or restyle their public page's text, sections, theme, and CSS, or design a custom Priors theme file (colors, fonts, chart style) for them to upload. Use when the user mentions Priors, their index page, asks to add a benchmark to their model ranking, or asks for a Priors theme.
---

# Priors

Priors is a site where a person builds a weighted index of AI-model benchmarks and publishes a page at `https://mypriors.com/<handle>`. You act on their behalf through a small HTTP API. Everything you change is visible on their page immediately — verify it before reporting done.

## Setup (once)

1. Ask the user for their Priors agent token (`pri_...`). They mint it on their page → **Settings → Agent access**. If they don't have a page yet, tell them to sign in at https://mypriors.com and claim a handle first.
2. Confirm access and learn the current state:
   ```bash
   curl -s https://mypriors.com/api/agent -H "Authorization: Bearer $PRIORS_TOKEN" \
     -H 'Content-Type: application/json' -d '{"action":"whoami"}'
   ```
   Response: `handle`, `displayName`, `indices` (their index configs), `sections` (page layout), `socials`, `bio`, `theme`. Read it before changing anything — most actions replace whole fields, so you merge, never rebuild.

Done when: `whoami` returns a handle and you have the current `indices`/`sections`/`theme` in hand.

## Task A — add a benchmark

Goal: produce a complete, honest dataset for one benchmark and import it.

1. **Identify** the benchmark the user named. Find its canonical public leaderboard (official site, paper, or GitHub). Prefer the official source; note the URL.
2. **Get the model list.** Benchmark ids and model coverage live at `https://mypriors.com/api/benchmarks`. Rows whose model Priors can't recognize are dropped, so match source labels to known models where the source is ambiguous.
3. **Gather every row** the source publishes — not a sample. For each row:
   - `modelLabel`: the model name exactly as the source writes it (keep reasoning-effort tags like "(high)"; Priors normalizes names itself)
   - `effort`: `low|medium|high|xhigh|max` only if the source shows a separate effort level
   - `value`: primary score as a number (percent as 0–100)
   - `ci`: `[low, high]` if published
   - `costUsd`: measured cost per task/run **only if the source publishes it** — never derive it from token prices
   - `outputTokens`, `steps`, `sourceUrl`: if published
4. **List what's missing.** Any model in the user's ranking the benchmark has not evaluated goes in `missing` with a reason. Do not invent or interpolate scores — Priors estimates gaps itself and marks them.
5. **Write the JSON** in this exact shape:
   ```json
   {
     "benchmark": {
       "id": "my-bench-v2",
       "name": "MyBench v2",
       "shortName": "MyBench",
       "url": "https://example.com/leaderboard",
       "description": "One or two sentences: what it measures, how it is scored.",
       "unit": "percent",
       "higherIsBetter": true,
       "category": "coding"
     },
     "rows": [
       { "modelLabel": "Claude Opus 4.8 (max)", "value": 71.2, "ci": [68.9, 73.5], "costUsd": 13.41, "sourceUrl": "https://example.com/leaderboard" }
     ],
     "missing": [ { "modelLabel": "Gemini 3.5 Pro", "reason": "not evaluated" } ]
   }
   ```
   - `unit`: `percent | score | elo | usd | seconds | count`
   - `category`: `coding | agentic | reasoning | knowledge | math | long-context | instruction | creative | safety | economics | composite | other`
   - `id`: lowercase slug, stable — re-importing the same id replaces the old data.
6. **Import**:
   ```bash
   curl -s https://mypriors.com/api/agent -H "Authorization: Bearer $PRIORS_TOKEN" \
     -H 'Content-Type: application/json' \
     -d "{\"action\":\"import\",\"payload\":$(cat mybench.json)}"
   ```
   The response reports accepted row count. Report unrecognized model labels to the user.
7. **Wire it into an index** if asked: merge `"my-bench-v2": <weight>` into the target index's `weights` and send the full array via `indices` (Task B).

Done when: the import response reports the row count, and (if asked) `whoami` shows the benchmark id in the index's weights.

If the source is unreachable or paywalled, say so and stop.

## Task B — retune the mix and rankings

The `indices` action replaces the **whole** IndexConfig array. Start from `whoami.indices`, preserve every field you aren't changing, send the full array. To add an index, append it with a new `id`; never drop or overwrite an index the user did not ask you to change. A page with more than one index shows them as tabs in array order, and the first is the page's main index (link preview, Explore).

```bash
curl -s https://mypriors.com/api/agent -H "Authorization: Bearer $PRIORS_TOKEN" \
  -H 'Content-Type: application/json' -d '{"action":"indices","payload":[ ...full array... ]}'
```

Every IndexConfig field:

| field | meaning |
|---|---|
| `id`, `name` | stable id + display name — rename indices freely, keep `id` stable |
| `weights` | `benchmarkId → weight`, any positive scale |
| `required` / `optional` | `required` = benchmark-id array of hard per-benchmark gates; `optional` is legacy and no longer affects ranking |
| `strictness` | 0–100. Tightens estimate evidence and the minimum share of index weight a model must have measured data for; 100 disables estimation |
| `estimateMissing` | estimate optional missing benchmarks from similar models (true) or renormalize measured weights (false) |
| `effortMatching` | `calibrated` (default — infer missing effort scores from the model's measured ratios elsewhere), `strict` (exact effort only), `nearest` (legacy alias) |
| `rankingVariants` | `best` (one row per model) or `all` (every effort/configuration) |
| `paretoVariants` | `all` (default) or `best` — independent of `rankingVariants` |
| `excludeModels` | model-id array — hides models from this index's leaderboard (the model-picker gear toggles them) |
| `variants`, `cutoff` | legacy fields — preserve as-is; new behavior lives in the fields above |

Benchmark ids: `https://mypriors.com/api/benchmarks`. Model ids: the page's own models, visible in `whoami.indices` context or the builder URL.

Done when: `whoami` echoes back your changes byte-for-byte.

## Task C — customize the page

Action `page` accepts any subset of: `displayName`, `bio`, `socials` (`[{label,url}]`), `avatarUrl`, `sections`, `theme`.

```bash
curl -s https://mypriors.com/api/agent -H "Authorization: Bearer $PRIORS_TOKEN" \
  -H 'Content-Type: application/json' -d '{"action":"page","payload":{ ...fields... }}'
```

**`sections`** is the ordered page layout. Each: `{ id, kind, title?, indexId?, benchmarkId?, body?, links?, hidden?, view?, metrics? }` with `kind` one of:

- `rankings` — ranked bars for `indexId`
- `pareto` — score vs cost-per-task for `indexId`
- `speed` — score vs output speed for `indexId`
- `benchmark` — one benchmark's leaderboard (`benchmarkId`)
- `history` — how the frontier for `indexId` moved over time
- `gallery` — collapsed expandable charts for `indexId` (time per task — open by default — plus output speed, latency, release date, OpenRouter uptime). Every page gets one automatically if absent — add `{kind:"gallery", hidden:true}` only if the user asks to remove it.
- `text` — a paragraph (`body`)
- `links` — a list of links (`links`)

On a page with several indices, a section appears on the tab of its `indexId`. `text`, `links` and `benchmark` sections with no `indexId` appear on every tab. An index with no chart sections of its own shows the same layout as the first tab, so a new index needs no sections unless the user wants a different layout for it.

Chart defaults (what visitors see first; their own tweaks stay in their browser):

- `view` on `pareto`/`speed`: `{ kind?: "scatter"|"bars", scale?: "log"|"linear", frontier?: boolean, links?: boolean, labelScale?: number }`.
- `metrics` on `gallery`: ordered `[{ id, hidden?, open?, view? }]` over `tpt` (time per task), `strengths` (radar), `speed`, `latency`, `tokens`, `date`, `uptime`, `usage`. Metrics left out of a saved list stay hidden, so include every one you want shown. `view.mode` (`"best"|"all"`) sets that chart's effort mode.
- Never store model lists for visibility; hide models with the index's `excludeModels` so new models still appear.

Start from the current `sections`, modify, send the whole array back. Keep titles short; no slogans, no emoji.

Done when: `whoami` shows the new sections in order and the page renders them.

## Task D — theme and CSS

`theme` fields on action `page`:

| field | effect |
|---|---|
| `preset` | whole-page theme: `bone` (Priors Light), `night` (Priors Dark), `aa` / `aa-dark` (Analysis: Artificial Analysis-style cards, serif section heads with square markers, AA lab colors, green quadrant), `slop` / `slop-light` (Slopalytics-style: black, DM Sans, flat sections), or classic `paper`, `sand`, `graphite`, `midnight`, `forest`. Themes restyle fonts, charts, lab colors and share cards. |
| `mode` | `"fixed"` keeps the chosen light/dark version; default follows the visitor's light/dark setting (paired themes only) |
| `accent` | hex color — accent, links, chart highlights, wordmark `i` (default: the theme's accent) |
| `surface` | `"bone"` (default `#FBFBF9`) or `"white"` page background |
| `serif` | font name for display headings — e.g. `"Georgia"` or a loaded webfont |
| `mono` | font name for data/numbers — e.g. `"Menlo"` |
| `css` | raw stylesheet injected into the page (≤10KB) — full control |

Everything in `css` is scoped by convention to `.page-root` — prefix every selector with it, e.g.:

```css
.page-root { --indigo: #7A3FA0; }
.page-root h1, .page-root h2 { letter-spacing: -0.03em; }
.page-root section { max-width: 900px; }
```

**What you're working with** — the Priors design system:

- Custom properties: `--bone #FBFBF9` · `--white` · `--ink #1A1A1A` · `--ink-2 #4A4A46` · `--grey #8A8A80` · `--hair #DDDBD4` (hairlines) · `--hair-2 #ECEAE3` · `--indigo #2F4FB0` · `--indigo-soft #E8ECF8`. Redefining a property inside `.page-root` cascades everywhere it applies.
- Fonts: Newsreader (display serif — `h1,h2,h3,.serif`), Inter (body — default), JetBrains Mono (numbers — `.mono,.num`). `serif`/`mono` theme fields override just those slots; loading a webfont needs `@import` inside `css`.
- Classes to target: `.page-root` (whole page), `section`, `.cap` (small mono labels), `.btn`, `.btn-quiet`, `header` (sticky top bar), `footer`, `.serif`, `.mono`.
- Charts are canvas-rendered (ECharts); CSS reaches the page around them but not inside. Lab/model colors come from data, except that the Analysis and Slop themes swap in those sites' lab colors.
- The share card follows `preset` (and `accent` + `surface`) automatically; `css` doesn't reach it.

**Brand judgment:**

- Default to the Priors look — quiet, editorial, hairline borders, generous whitespace. Change only what the user asked for.
- Broad asks ("make it feel like me") → keep recognizable Priors bones: the fonts, the hairlines, the spacing. Vary `accent`, `surface`, section order — the identity stays.
- Only when the user names the thing to change ("dark mode", "different fonts") do you touch it — then it's a real change, not a tweak: e.g. dark mode means redefining the surface/ink/hair tokens together, not one background.
- Test what you write: after `page`, fetch `https://mypriors.com/<handle>` and confirm the stylesheet took effect. Broken CSS is visible to everyone immediately.

Done when: `whoami.theme` shows your fields and the live page reflects them.

## Task E — make a custom theme

Goal: write one **Priors theme** file the user uploads in Priors → Settings → Theme → Explore themes → *Bring your own theme* (no token needed), or applies to their page.

1. **Ask what look they want** if they haven't said: a mood, a brand, or a website to match. If given a site, read its real colors and fonts instead of guessing.
2. **Write one JSON object** in this format (format version 1):
   - `priorsTheme`: `1`. `name`: at most 40 characters.
   - `light` and/or `dark`: give both when you can, so the theme follows each visitor's light/dark setting. Each is an object of `#hex` colors:
     - `bg` page background (a light color in `light`, a dark one in `dark`). `surface` (optional) cards, panels and chart backgrounds; defaults to `bg`.
     - `ink` main text, at least 4.5:1 against `bg` and `surface`. `ink2` secondary text and `grey` captions and axis labels, at least 3.5:1 against `bg`.
     - `hair` borders and gridlines. `hair2` subtle fills (bar tracks, hovers).
     - `accent` links, selected states, buttons, at least 3:1 against `bg`; white text sits on it in light mode. `panelAccent` (dark mode, optional) is a deeper shade of the accent that holds white button text.
     - `labs` (optional): chart color per AI lab, lab id → hex. Ids: anthropic, openai, google, meta, xai, deepseek, alibaba, moonshot, mistral, zhipu, minimax, xiaomi, thinking-machines, nvidia, cursor, cognition, tencent, other (`other` colors every lab you don't name). Omit `labs` to keep Priors' own lab colors. Keep the colors distinct from each other and from `bg`; lift them lighter for dark backgrounds.
   - `fonts` (optional): `{ "sans", "serif", "mono" }`, each one of: Inter, DM Sans, Geist, Outfit, Poppins, Switzer, Newsreader, Source Serif 4, Lora, JetBrains Mono, Geist Mono, IBM Plex Mono, Excalifont, Comic Shanns. Only these exist; never name another font. `sans` is body text, `serif` headings, `mono` numbers and labels.
   - `radius` (optional): corner roundness in px, 0–24.
   - `chart` (optional): `{ "grid": "solid"|"dotted", "frontier": "solid"|"dotted", "barLabels": "top"|"inside", "barRadius": 0–12, "fill": "flat"|"spectrogram" }`. `spectrogram` fills bars and dots with a gradient of each lab's color.
   - Colors are `#RGB` or `#RRGGBB` only (no names, `rgb()`, `var()`, urls). No comments, no trailing commas, no other keys.
3. **Validate it:** `curl -s https://mypriors.com/api/theme -H 'Content-Type: application/json' --data @my-theme.json`. The reply is `{"ok":true,"warnings":[...]}` or `{"ok":false,"errors":[...]}`. Fix every error, and every warning that is a readability problem, then validate again. `curl -s https://mypriors.com/api/theme` returns this format as plain text, with a full example.
4. **Hand it over:** save as `my-theme.json` and tell the user to upload it (Settings → Theme → Explore themes → Upload theme file, or Paste theme). To put it on their page instead, set `theme.preset` on action `page` to `u.` + the base64url (no padding) of the minified JSON, which is the `id` the validate reply returns; add `".d"` to that id for the dark version.

Done when: the validate reply is `ok` with no readability warnings, and the user has the file (or `whoami.theme.preset` shows the `u.` id).

## Reporting

Finish with: what changed, the numbers (rows imported / weights set / fields themed), what could not be done, and `https://mypriors.com/<handle>`.

---

<!-- If the user pasted a request below this line, do that. -->
