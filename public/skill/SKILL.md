---
name: priors
description: Work on a person's Priors page (priors.so) — research and add a benchmark to their index data, adjust their index weights, or customize the text, links, sections, and styling of their public index page. Use when the user mentions Priors, their index page, or asks to add a benchmark to their model ranking.
---

# Priors

Priors is a site where a person builds a weighted index of AI-model benchmarks and publishes a page at `https://priors.so/<handle>`. You act on their behalf through a small HTTP API. Everything you change is visible on their page immediately.

## Setup (once)

1. Ask the user for their Priors agent token (`pri_...`). They mint it on their page → **Settings → Agent access**. If they don't have a page yet, tell them to sign in at https://priors.so and claim a handle first.
2. Confirm access:
   ```bash
   curl -s https://priors.so/api/agent -H "Authorization: Bearer $PRIORS_TOKEN" \
     -H 'Content-Type: application/json' -d '{"action":"whoami"}'
   ```
   The response lists their handle, indices (weights), sections, socials, bio, and theme. Read it before changing anything.

If you have browser or computer-use tools, you may instead upload JSON at `https://priors.so/import` and edit the page at `https://priors.so/<handle>?edit=1` on the user's behalf; the API is the preferred route.

## Task A — add a benchmark

Goal: produce a complete, honest dataset for one benchmark and import it.

1. **Identify** the benchmark the user named. Find its canonical public leaderboard (official site, paper, or GitHub). Prefer the official source; note the URL.
2. **Get the model list.** Call `whoami` and read `models` (canonical names the site knows). Also run the benchmark's full leaderboard, not a sample — every row the source publishes.
3. **Gather every row.** For each model on the leaderboard record:
   - `modelLabel`: the model name exactly as the source writes it (include reasoning-effort tags like "(high)" if shown; do not rename to match Priors — Priors normalizes names itself)
   - `effort`: if the source shows a separate effort/thinking level, put it here (`low|medium|high|xhigh|max`)
   - `value`: the primary score, as a number (percent as 0–100)
   - `ci`: `[low, high]` if published
   - `costUsd`: measured cost per task/run **only if the source publishes run cost**. Never compute cost from token prices.
   - `outputTokens`, `steps`: if published
   - `sourceUrl`: the page the row came from
4. **List what's missing.** Any model in the user's ranking that the benchmark has not evaluated goes in `missing` with a reason ("not evaluated", "only older version tested", …). Do not invent or interpolate scores.
5. **Write the JSON** exactly in this shape:
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
   - `id`: lowercase slug, stable across re-imports (re-importing the same id replaces the old data).
6. **Import**:
   ```bash
   curl -s https://priors.so/api/agent -H "Authorization: Bearer $PRIORS_TOKEN" \
     -H 'Content-Type: application/json' \
     -d "{\"action\":\"import\",\"payload\":$(cat mybench.json)}"
   ```
   The response includes how many rows were accepted. Rows whose model could not be recognized are ignored — report those labels to the user.
7. **Add it to an index** (optional, if the user asked): read `indices` from `whoami`, add `"my-bench-v2": <weight>` to the chosen index's `weights`, then:
   ```bash
   curl -s https://priors.so/api/agent -H "Authorization: Bearer $PRIORS_TOKEN" \
     -H 'Content-Type: application/json' -d '{"action":"indices","payload":[ ...full updated IndexConfig array... ]}'
   ```
8. Tell the user: benchmark name, rows imported, models missing, and the link to their page.

If you cannot reach the source or the leaderboard is behind a login, say so and stop. Do not fill gaps with estimates; Priors handles gaps itself and marks them.

## Task B — change index weights or rules

`IndexConfig` fields: `id`, `name`, `weights` (benchmarkId → weight, any positive scale), `required` (benchmark ids a model must have), `cutoff` (percent share above which a benchmark is implicitly required; default 5), `estimateMissing` (true = estimate small gaps from similar models, false = renormalize), `variants` (`all` = rank every reasoning effort, `best` = one per model). Send the **full array** with action `indices`.

Benchmark ids available on the site are listed at `https://priors.so/api/benchmarks`.

## Task C — customize the page

Action `page` with any of: `displayName`, `bio` (plain text, short), `socials` (`[{label,url}]`), `theme` (`{ accent: "#hex", surface: "bone" | "white" }`), `sections`.

`sections` is the ordered page layout. Each section: `{ id, kind, title?, indexId?, benchmarkId?, body?, links?, hidden? }` with `kind` one of:
- `rankings` — the ranked bars for `indexId`
- `pareto` — score vs cost-per-task for `indexId`
- `speed` — score vs output speed for `indexId`
- `benchmark` — one benchmark's leaderboard (`benchmarkId`)
- `history` — how the frontier for `indexId` moved over time
- `text` — a paragraph (`body`)
- `links` — a list of links (`links`)

Always start from the current `sections` (from `whoami`), modify, and send the whole array back. Keep it tasteful: the page is meant to look like a clean, quiet report — no slogans, no emoji, short titles.

## Reporting

Finish with: what changed, the numbers (rows imported / weights set), what could not be found, and `https://priors.so/<handle>`.

---

<!-- If the user pasted a request below this line, do that. -->
