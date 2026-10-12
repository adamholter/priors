# Data, scrapers and index math

## The contract

`src/data/types.ts` defines everything: `Snapshot`, `Model`, `Variant`, `Benchmark`, `Observation`, `RawRow`, `Source`. Read it first.

- A snapshot is one gzipped JSON file per day in `data/snapshots/<date>.json.gz`, plus `latest.json.gz`. They are committed: the repo is the archive.
- `src/data/load.ts` loads a snapshot by date or the latest, passing it through `canonical-snapshot.ts` (repairs identities in older snapshots).
- `src/data/client-snapshot.ts` trims a snapshot for the browser. `/api/snapshot?view=core` serves the full one to the onboarding search.

## Model identity

`src/data/normalize.ts` turns a source's model label into a canonical model id and reasoning effort.

- Regex families plus exact `ALIASES`. Unknown labels are excluded, never guessed.
- A variant (model + reasoning effort) is the ranked unit. When a source gives no effort, the row goes to the model's highest known effort.
- `none`, `minimal` and `low` are distinct efforts. Explicit model sizes (Qwen 27B versus 35B-A3B), Instant variants and dated DeepSeek revisions stay distinct too.
- Lab colors live in `LABS` in `normalize.ts`: same lab, same color everywhere.
- Regression corpus: `scripts/benchmarks/` (`npm run benchmark:identity`, also run by Vitest). For a new parsing defect, add the source label and the independently reviewed identity to `fixtures/identity-cases.json`. Never edit expected groups to match the parser.

## Scrapers

`scripts/scrape/build.ts` runs every file in `scripts/scrape/sources/`, normalizes the rows and writes the snapshot. Raw payloads go to `data/raw/` (gitignored).

```
npm run scrape -- --date YYYY-MM-DD [--only aa,openrouter]
```

A full run takes 2 to 3 minutes (some sources use headless Chromium). A partial `--only` run keeps the other sources' rows from the previous snapshot and seeds effort attribution from it.

To add a source, copy `sources/_template.ts`. Its header lists the rules: discover rows live, prefer structured payloads over DOM scraping, emit the label exactly as the site shows it, put a cost in `costUsd` only when the site reports measured run cost, save every parsed payload in `raw`.

Every benchmark comes from a live scraper. No frozen datasets are merged at load time. `liveBenchmarkId` in `src/lib/url.ts` maps the ids of a removed September 2026 import (`real-index:*`) in old shared links to the live benchmarks.

Notes on sources whose behavior is not obvious from the file:

| Source | Note |
| --- | --- |
| `aa` | Artificial Analysis, read from encrypted RSC payloads. `aa-identity.ts` resolves its structured model records. |
| `openrouter` | Operational metrics: uptime, providers, throughput, latency, tool-call errors. `defaultWeight: 0`. |
| `frontiercode` | Static JSON, per-effort rows, Main and Extended subsets. |
| `frontiermath` | Epoch AI's live CSV. Private Tiers 1 to 3 (v2), Tier 4 (v2) and Erdős. Public sample questions and v1 sets are excluded. CSV standard errors are kept as notes, not confidence intervals. Token totals are not treated as per-task cost. |
| `epoch-furniture` | Same Epoch CSV, task `Furniture Assembly`. Latest successful run per model and effort. `defaultWeight: 0`. |
| `weirdml` | v2 CSV plus v3 JSON. Best harness per model and effort; excluded and synthetic models skipped. |
| `osworld` | 2.0 official results (newest release, full set, default steps) plus the Verified xlsx, read with `xlsxRows`/`unzip` in the harness. General models only. |
| `scale`, `scale-hss` | SWE Atlas-QnA and Humanity's Sixth Sense, both from RSC page payloads (`_rsc.ts`). |
| `zapier`, `roboflow`, `terminalbench`, `andonlabs` | Headless page (`ctx.withPage`). Zapier clicks "See N more". |
| `voxelbench`, `minebench` | Human-vote ratings. Creative category, `defaultWeight: 0`. |
| `slopalytics` | T3 Code's own telemetry. `t3-usage-share` is each model's share of all turns in the file's trailing window. Model-level; catch-all buckets count toward the total but are never ranked. Not a quality measure, `defaultWeight: 0`. |
| `realapipricing` | Feeds the subscription cost view, see below. |
| `vals*` | Vals benchmarks. Shared parsing in `_vals.ts` and `vals.ts`. |

### Subscription cost

`sources/realapipricing.ts` reads `derived/points.json` from github.com/FeiZhuLulu/real-api-pricing into the proxy benchmark `subscription-token-price`: plan fee divided by monthly tokens on the lab's own plan (median first-party plan; resellers such as Cursor are excluded; `low`-confidence rows are a last resort). `src/data/subscription.ts` divides that by the API list price at the same workload to get each model's share of API price.

`IndexConfig.costBasis: "subscription"` (URL `costbasis=subscription`, the Pricing toggle in the cost chart's settings) multiplies measured cost per task by that share. Models without plan data keep API cost. It is a lower bound, because it assumes the full allowance is used. The toggle only shows when the snapshot has the benchmark.

## Index math

`src/engine/index.ts`. Tests in `index.test.ts`. The flow is drawn in `docs/ranking-logic.svg` (age filter, exclusions, measured share, Required gate, coverage floor, estimation, score). Regenerate the diagram when the gates change.

- **Scores are used as published.** Percent and fixed-scale scores are not rescaled (`FIXED_SCALES` covers snapshots without `normalization`). Nothing is stretched so the leader reads 100. Elo becomes win rate against the pool's median model. Other open-ended units go through a logistic around the pool median scaled by spread (USD in log space).
- **Cost means measured cost per task** (`aa-cost-per-task-index`, or a benchmark's `costUsd`). Never token price. `aa-price-blended` is `proxy: true`.
- **Effort matching** defaults to calibrated (`nearest` is a legacy alias). Exact results win. A missing effort uses the nearest measured effort, adjusted by the same model's ratios between those efforts on other benchmarks. Category matches count twice, and with 5 or more comparisons the extreme 20% tails are trimmed. Without enough paired evidence the value stays missing. A maximum-effort score is never copied unchanged to a lower effort. Cost and speed are never effort-substituted. The donor value, source variant, multiplier and evidence are shown in the advanced Calculation settings; the main charts carry no estimate markers.
- **Strictness (0 to 100)** is the measured-coverage floor. A variant is ranked only when measured values (observed or effort-substituted; peer estimates never count) cover at least that share of the index's weight. 0 ranks anything with a value; 100 requires full coverage and disables inference. Strictness also sets the minimum number of effort comparisons, the allowed effort distance and the peer release window.
- **Required** benchmarks are hard per-benchmark gates. `optional` is a legacy field with no effect on ranking. `cutoff` survives for old URLs and derives strictness.
- **Missing values** above the floor are estimated from peers (release window, price tier) and marked, or the weights are renormalized when estimation is off. At strictness 50 and above, a model needs 2 measured benchmarks to seed estimates and peers need 2 shared benchmarks. The peer offset shrinks as `off/(n+1)`.
- **Versioned benchmarks** use `versionPolicy`: `fallback` (DeepSWE 1.1 falls back to 1) or `fresh` (AA index versions).
- **Defaults:** strictness 50. `releasedAfter` undefined means models released in the six months before the snapshot date; an empty string (empty `after=` in the URL) means all time. Models with unknown release dates are never age-filtered.
- **Chart modes are independent.** `rankingVariants` defaults to `best`, `paretoVariants` to `all`. Compute the full variant set once, then call `selectVariants` per chart.

## Index configs and URLs

- `IndexConfig` is defined in the engine. `src/lib/url.ts` encodes it into one `i` query param per index: `?i=name|bench:w,...|req=|strict=|bars=|pareto=|est=|var=|effort=|labs=|ex=|only=|after=`. Several `i` params mean several indices.
- Stored configs (profiles) are validated by `convex/validators.ts`. `IndexConfig` is asserted exactly equal to the validator at compile time, so adding a field on one side without the other fails `tsc`. Every write goes through `storableIndex()`, which drops transient keys. `src/lib/stored-index.test.ts` checks every config producer.
- Model visibility is stored as whichever is shorter: `excludeModels`, or an `onlyModels` allowlist once more than half the picker is hidden (new models then stay hidden). Hiding a model is the user's choice and reversible: excluded models can be re-checked in the chart-settings model picker.
- `src/lib/import.ts` is the zod schema for user and agent benchmark imports, and merges them into a snapshot.
