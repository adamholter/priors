---
name: priors
description: Work on a person's Priors page (mypriors.com) — add a benchmark to their index data, retune their index weights and ranking rules, or restyle their public page's text, sections, theme, and CSS. Use when the user mentions Priors, their index page, or asks to add a benchmark to their model ranking.
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

The `indices` action replaces the **whole** IndexConfig array. Start from `whoami.indices`, preserve every field you aren't changing, send the full array:

```bash
curl -s https://mypriors.com/api/agent -H "Authorization: Bearer $PRIORS_TOKEN" \
  -H 'Content-Type: application/json' -d '{"action":"indices","payload":[ ...full array... ]}'
```

Every IndexConfig field:

| field | meaning |
|---|---|
| `id`, `name` | stable id + display name — rename indices freely, keep `id` stable |
| `weights` | `benchmarkId → weight`, any positive scale |
| `required` / `optional` | benchmark-id arrays overriding automatic requirements; empty both to restore automatic |
| `strictness` | 0–100. Tightens automatic requirements and estimate evidence; 100 disables estimation |
| `estimateMissing` | estimate optional missing benchmarks from similar models (true) or renormalize measured weights (false) |
| `effortMatching` | `calibrated` (default — infer missing effort scores from the model's measured ratios elsewhere), `strict` (exact effort only), `nearest` (legacy alias) |
| `rankingVariants` | `best` (one row per model) or `all` (every effort/configuration) |
| `paretoVariants` | `all` (default) or `best` — independent of `rankingVariants` |
| `excludeModels` | model-id array — hard-removes models from this index's ranking |
| `variants`, `cutoff` | legacy fields — preserve as-is; new behavior lives in the fields above |

Benchmark ids: `https://mypriors.com/api/benchmarks`. Model ids: the page's own models, visible in `whoami.indices` context or the builder URL.

Done when: `whoami` echoes back your changes byte-for-byte.

## Task C — customize the page

Action `page` accepts any subset of: `displayName`, `bio`, `socials` (`[{label,url}]`), `avatarUrl`, `sections`, `theme`.

```bash
curl -s https://mypriors.com/api/agent -H "Authorization: Bearer $PRIORS_TOKEN" \
  -H 'Content-Type: application/json' -d '{"action":"page","payload":{ ...fields... }}'
```

**`sections`** is the ordered page layout. Each: `{ id, kind, title?, indexId?, benchmarkId?, body?, links?, hidden? }` with `kind` one of:

- `rankings` — ranked bars for `indexId`
- `pareto` — score vs cost-per-task for `indexId`
- `speed` — score vs output speed for `indexId`
- `benchmark` — one benchmark's leaderboard (`benchmarkId`)
- `history` — how the frontier for `indexId` moved over time
- `text` — a paragraph (`body`)
- `links` — a list of links (`links`)

Start from the current `sections`, modify, send the whole array back. Keep titles short; no slogans, no emoji.

Done when: `whoami` shows the new sections in order and the page renders them.

## Task D — theme and CSS

`theme` fields on action `page`:

| field | effect |
|---|---|
| `accent` | hex color — accent, links, chart highlights, wordmark `i` (default `#2F4FB0` indigo) |
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
- Charts are canvas-rendered (ECharts); CSS reaches the page around them but not inside. Lab/model colors come from data, not theme.
- The share card honors `accent` + `surface` automatically; `css` doesn't reach it.

**Brand judgment:**

- Default to the Priors look — quiet, editorial, hairline borders, generous whitespace. Change only what the user asked for.
- Broad asks ("make it feel like me") → keep recognizable Priors bones: the fonts, the hairlines, the spacing. Vary `accent`, `surface`, section order — the identity stays.
- Only when the user names the thing to change ("dark mode", "different fonts") do you touch it — then it's a real change, not a tweak: e.g. dark mode means redefining the surface/ink/hair tokens together, not one background.
- Test what you write: after `page`, fetch `https://mypriors.com/<handle>` and confirm the stylesheet took effect. Broken CSS is visible to everyone immediately.

Done when: `whoami.theme` shows your fields and the live page reflects them.

## Reporting

Finish with: what changed, the numbers (rows imported / weights set / fields themed), what could not be done, and `https://mypriors.com/<handle>`.

---

<!-- If the user pasted a request below this line, do that. -->
