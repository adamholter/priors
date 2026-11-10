# Priors: getting data out

Everything on Priors is scraped from each benchmark's own publisher and is public. No token is needed to read it.

## A question or a table

Use the read tools (`POST https://mypriors.com/api/tools/<name>`, schemas at `GET /api/tools`):

| Need | Tool |
|---|---|
| Which benchmarks exist, their ids and units | `list_benchmarks` |
| One benchmark's leaderboard as published | `get_benchmark` (up to 300 rows a call) |
| Models, labs, release dates, efforts measured | `list_models`, `get_model` |
| A ranking under an index | `rank_models` |
| Score, cost, time, speed or any benchmark per model, as one table | `query_data` (up to 200 models) |
| Score against cost or time, with the frontier marked | `pareto_frontier` |
| How a ranking moved over time | `index_history` |
| Someone's published page and its indices | `get_page` |
| How fresh the data is | `data_status` |

Tools that take `index` rank under the default General index unless you pass one: `@handle`, `@handle/index-id`, a mypriors.com link, or an object like `{ "weights": { "<benchmarkId>": 2 } }`.

## The whole dataset

- Latest, gzipped JSON, rebuilt every 15 minutes: `https://raw.githubusercontent.com/adamholter/priors/data-live/data/snapshots/latest.json.gz`
- A past day: `https://raw.githubusercontent.com/adamholter/priors/main/data/snapshots/<YYYY-MM-DD>.json.gz`
- Or plain JSON from the site, about 18 MB, wrapped as `{ "snapshot": ... }`: `https://mypriors.com/api/snapshot` (add `?date=YYYY-MM-DD` for a past day)

A snapshot holds:

- `benchmarks`: `id`, `name`, `unit`, `higherIsBetter`, `category`, `url`, `description`.
- `models` and `labs`: identity. `variants`: one per model and reasoning effort (`id` is `<modelId>@<effort>`). The variant is what gets ranked.
- `observations`: one published result each: `benchmarkId`, `variantId`, `value` (in the benchmark's unit), and when the source publishes them `ci`, `costUsd` (measured cost per task, never a token price), `outputTokens`, `durationSec`, `harness`, plus `sourceUrl` and `note`.
- `estimates`: values Priors inferred. They are kept apart from `observations` so they are never mistaken for measurements.

The exact types are `src/data/types.ts` in https://github.com/adamholter/priors, and `docs/data.md` there explains how rows are built.

To a CSV, for example one benchmark:

```bash
curl -sL https://raw.githubusercontent.com/adamholter/priors/data-live/data/snapshots/latest.json.gz | gunzip \
  | jq -r '.observations[] | select(.benchmarkId=="arena-webdev") | [.variantId, .value, .sourceUrl] | @csv'
```

## When you hand data over

- Say the snapshot date (`date` in the snapshot, or `data_status`).
- Name each benchmark's publisher and keep `sourceUrl`: the scores are theirs.
- Keep estimates labelled as estimates.

Done when the user has the file or table they asked for, with every row they asked for in it, and you have told them the snapshot date.
