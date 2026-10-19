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

A full run takes 2 to 3 minutes (some sources use headless Chromium). A partial `--only` run keeps the other sources' rows and observation notes unchanged, even when their previous scrape failed, and seeds effort attribution from the previous snapshot.

To add a source, copy `sources/_template.ts`. Its header lists the rules: discover rows live, prefer structured payloads over DOM scraping, emit the label exactly as the site shows it, put a cost in `costUsd` only when the site reports measured run cost, save every parsed payload in `raw`.

Every benchmark comes from a live scraper. No frozen datasets are merged at load time. `liveBenchmarkId` in `src/lib/url.ts` maps the ids of a removed September 2026 import (`real-index:*`) in old shared links to the live benchmarks.

Notes on sources whose behavior is not obvious from the file:

- `surge-sudo-l7` reads the live sudo L7 leaderboard's primary rows, excluding the related benchmark cards. It keeps the existing `bg-sudo-l7` id for saved mixes and excludes the secondary dashboard copy in `boggs.COVERED`. It preserves the published percentage, reasoning effort and agent harness. Scores come from the leaderboard, which can differ from the launch blog. The page's static rank fields all read 1, so they are omitted. Raw HTML is retained; missing or malformed rows fail the refresh and preserve the prior snapshot. Coding category, `defaultWeight: 0`.
- `snorkel-ale` reads Snorkel's Agents' Last Exam leaderboard (first, Overall table). Each row lists every effort measured for a model and harness; the best harness per model and effort wins. Value is the rubric score (pass rate is in the note). Agentic, `defaultWeight: 0`.
- `surge-chartography` reads Surge's Chartography board (professional chart reading), between its "Chartography Leaderboard" heading and "More benchmarks" so the sudo L7 and DAYJOB teasers are skipped. Reasoning category.
- `unipat-babyvision` reads UniPat's BabyVision table (human baseline skipped). Runs marked "(with tools)" are their own benchmark, `babyvision-tools`.
- `zerobench` reads ZeroBench's official leaderboard (first table only): `zerobench-main`, pass@5 as the page sorts it, pass@1 in the note.
- `matharena-apex` reads MathArena's `competition_tables/<comp>` JSON for Apex and the Apex shortlist, with 95% CIs. The ⚠️ contamination marker is dropped from labels and kept in the note.
- `scale-hle-text` reads Scale's text-only Humanity's Last Exam board from the RSC payload (`hle-text-only`), effort from the parenthetical, CIs kept.
- `clockbench` reads ClockBench's leaderboard table (human baselines skipped); effort is the model name's trailing word. Reasoning category, `defaultWeight: 0`.
- `llmlearner` reads LLMLearner's per-benchmark rankings for boards with no official live feed (today NL2Repo-Bench). Every row is a vendor or paper report, noted as self-reported.
  `BASE=https://mypriors.com npx tsx scripts/verify/sudo-l7.ts` checks source agreement, search, adding, reload, every displayed score, and desktop/mobile rendering.

| Source | Note |
| --- | --- |
| `aa` | Artificial Analysis, read from encrypted RSC payloads. `aa-identity.ts` resolves its structured model records. Fields only an evaluation page carries (AA-3D) are filled from its inline `initialModels`. Every evaluation page, numeric model field and benchmark announcement it does not map (`EVALS`) or deliberately ignore (`NON_BENCHMARK_FIELDS`, `IGNORED_PAGES`, `IGNORED_ARTICLES`) is returned in `discoveries`, which the scheduled job announces (see `docs/operations.md`). When AA renames a page, set `page` and keep `slug`, since it is the benchmark id. |
| `aa-robotics` | AA-Robotics has no evaluation page or manifest yet: per-task scores ship in the article's page bundle. Mean over tasks; harness per model, effort from the article text. `defaultWeight: 0`. |
| `benchmarkheaven` | Independent leaderboards (creative writing, MathArena, UGI, SWE-bench variants, agent and game boards) read from benchmarkheaven.com's public registry and dataset, which republish each maintainer's board under one schema. Each benchmark links to its maintainer. Skips what Priors reads at the source (`SKIP`, the maintainer list) and cost. A benchmark needs 5 independently measured models; a vendor's own claims count only on a board with 8 or more models. Re-collected boards (`family::snapshot-<date>`) keep one id, from the newest snapshot. All `defaultWeight: 0`. Also supplies open-weights flags. Fallback if a benchmark here gets a direct scraper: add it to `SKIP`. |
| `epoch-eci` | Epoch Capabilities Index (epoch.ai/data/eci_scores.csv, CC BY), with intervals. Also the open-weights group Epoch records. |
| `epoch-tasks` | Other tasks in Epoch's `benchmarks.csv` (chess and mystery-game puzzles, OTIS Mock AIME, MATH level 5, Epoch-run SWE-bench Verified, GPQA and SimpleQA Verified, EBR-bench, MirrorCode, SpireClimb, OEIS Open). Latest successful run per model and effort. A task Epoch adds that nothing maps is announced as a new benchmark. |
| `metr` | METR time horizon (50%), from `benchmark_results_1_1.yaml`. Minutes of human task time a model completes half the time. |
| `openrouter` | Operational metrics: uptime, providers, throughput, latency, tool-call errors. `defaultWeight: 0`. |
| `frontiercode` | Static JSON, per-effort rows, Main and Extended subsets. |
| `frontiermath` | Epoch AI's live CSV. Private Tiers 1 to 3 (v2), Tier 4 (v2) and Erdős. Public sample questions and v1 sets are excluded. CSV standard errors are kept as notes, not confidence intervals. Token totals are not treated as per-task cost. |
| `epoch-furniture` | Same Epoch CSV, task `Furniture Assembly`. Latest successful run per model and effort. `defaultWeight: 0`. |
| `weirdml` | v2 CSV plus v3 JSON. Best harness per model and effort; excluded and synthetic models skipped. |
| `osworld` | 2.0 official results (newest release, full set, default steps) plus the Verified xlsx, read with `xlsxRows`/`unzip` in the harness. General models only. |
| `scale`, `scale-hss` | SWE Atlas-QnA and Humanity's Sixth Sense, both from RSC page payloads (`_rsc.ts`). |
| `zapier`, `roboflow`, `terminalbench`, `andonlabs` | Headless page (`ctx.withPage`). Zapier clicks "See N more". |
| `boardbench` | Board-game puzzles (ten games, engine-scored move quality, 0 to 100), read from the home page's RSC `points`. Reasoning category, `defaultWeight: 0`. Its cost is the list price of one answer, kept in `details`, not `costUsd`. |
| `voxelbench`, `minebench`, `threejseval` | Human-vote ratings. Creative category, `defaultWeight: 0`. threejseval's cost is the site's estimate from token usage, so it is kept in `details`, not `costUsd`. |
| `slopalytics` | T3 Code's own telemetry. `t3-usage-share` is each model's share of all turns in the file's trailing window. Model-level; each observation also carries `details.start`, `daily` (that model's turns per day) and `dayTotals` (all models' turns per day), which the Usage chart stacks over time; catch-all buckets count toward the total but are never ranked. Not a quality measure, `defaultWeight: 0`. |
| `realapipricing` | Feeds the subscription cost view, see below. |
| `vals*` | Vals benchmarks. Shared parsing in `_vals.ts` and `vals.ts`. |

### Subscription cost

`sources/realapipricing.ts` reads `derived/points.json` from github.com/FeiZhuLulu/real-api-pricing into the proxy benchmark `subscription-token-price`: plan fee divided by monthly tokens on the lab's own plan (median first-party plan; `low`-confidence rows are a last resort). Models with no first-party plan fall back to the best reseller or harness plan (OpenCode Go, Command Code, Droid, Ollama): lowest token price at medium confidence or better, since the list price is the same on every plan, so cheapest tokens means biggest subsidy. `sources/subscription-overrides.ts` holds curated figures read from a plan page that states its allowance in dollars (Gemini 4 on OpenCode Go at 6× during the 2× promo, Muse Wonder on Command Code Max at 1.5×). They carry `ratio` directly, replace any computed row, and need about 80% confidence and a checked date. `PLAN_CUTS` in the same file corrects plans whose allowance was cut after Real API Pricing measured them: older measurements are rescaled to the current allowance (ChatGPT Pro $200 went from 20× to 10× Plus on 29 September 2026, so Plus, Pro $100 and Pro $200 are linear per dollar, as Claude's plans are). Meta's own Muse Code plans publish prompts per 5 hours, not tokens, so they cannot be priced. Free tiers come from `scripts/scrape/free-tiers.ts`, not from overrides: every run reads OpenCode Zen's live model list (ids ending `-free`) and OpenRouter's (`:free` variants), and `src/data/free-tier.ts` turns each listing that names a ranked LLM, by exact name, into a ratio 0 row for that model, replacing any computed one. OpenRouter prices some image, audio and router entries at 0 in odd ways, so a listing must output text only, have every price at zero, and not be a router or a safety, guard, moderation or embedding model; entries that match no ranked model are ignored. A model drops off when the provider drops it, so nothing needs removing by hand. If a list cannot be fetched, the previous snapshot's free rows are carried forward. `src/data/subscription.ts` divides the token price by the API list price at the same workload to get each model's share of API price.

Subscription pricing is the default: `IndexConfig.costBasis` unset means subscription (`effectiveBasis` in `src/data/subscription.ts`); only an explicit `"api"` is stored (URL `costbasis=api`, the Pricing toggle in the cost chart's settings). It multiplies measured cost per task by that share, so a free tier costs $0. Log cost axes have no 0: `costChart.points` puts free models a step left of the cheapest paid cost (`freeFloor`, a quarter of it) with `free: true`, tooltips and bar labels read "free", and the scatter draws a dashed "free" line there. Models without plan data keep API cost. It is a lower bound, because it assumes the full allowance is used. The toggle only shows when the snapshot has the benchmark.

### Open weights

`Model.openWeights` says whether a model's weights can be downloaded (any license); `paramsB` and `activeParamsB` hold parameter counts in billions when a source publishes them. `src/data/open-weights.ts` sets them at scrape time, from the most to the least trustworthy: Artificial Analysis's `isOpenWeights` in each variant's source metadata, flags other sources return in `modelFlags` (Epoch ECI's accessibility group, Benchmark Heaven), then `FAMILY_RULES` for families whose status never varies. Unknown stays undefined, which is not the same as closed. The build logs `OPEN_WEIGHTS n open, n closed, n unknown`. `/api/history` fills the flag on older snapshots from today's models, since a model's weights don't change. Charts: the history page's "Open vs closed" colouring and best-by-weights chart, and the assistant's `weights` filter.

## Index math

`src/engine/index.ts`. Tests in `index.test.ts`. The flow is drawn in `docs/ranking-logic.svg` (age filter, exclusions, measured share, Required gate, coverage floor, estimation, score). Regenerate the diagram when the gates change.

- **Scores are used as published.** Percent and fixed-scale scores are not rescaled (`FIXED_SCALES` covers snapshots without `normalization`). Nothing is stretched so the leader reads 100. Elo becomes win rate against the pool's median model. Other open-ended units go through a logistic around the pool median scaled by spread (USD in log space).
- **Cost means measured cost per task** (`aa-cost-per-task-index`, or a benchmark's `costUsd`). Never token price. `aa-price-blended` is `proxy: true`.
- **Effort matching** defaults to calibrated (`nearest` is a legacy alias). Exact results win. A missing effort uses the nearest measured effort, adjusted by the same model's ratios between those efforts on other benchmarks. Category matches count twice, and with 5 or more comparisons the extreme 20% tails are trimmed. Without enough paired evidence the value stays missing. A maximum-effort score is never copied unchanged to a lower effort. Cost and speed are never effort-substituted. The donor value, source variant, multiplier and evidence are shown in the advanced Calculation settings; the main charts carry no estimate markers.
- **Strictness (0 to 100)** is the measured-coverage floor. A variant is ranked only when measured values (observed or effort-substituted; peer estimates never count) cover at least that share of the index's weight. 0 ranks anything with a value; 100 requires full coverage and disables inference. Strictness also sets the minimum number of effort comparisons, the allowed effort distance and the peer release window.
- **Required** benchmarks are hard per-benchmark gates. `optional` is a legacy field with no effect on ranking. `cutoff` survives for old URLs and derives strictness.
- **Missing values** above the floor are estimated from peers (release window, price tier) and marked, or the weights are renormalized when estimation is off. A peer estimate averages two guesses: the mix match (nearest models on the benchmarks in the mix, shifted by the average offset) and, for percent benchmarks, a panel match (models whose scores are closest as ratios across every measured percent benchmark they share, at least 8, scaled by the median ratio). Other models only; the target's own efforts never donate. Each estimate carries `donors` and an `estimateRange` (the donors' spread, never under 1.5 points), shown in the model detail and the bar tooltip. `scripts/verify/peer-backtest.mts` hides known scores and measures the miss: on the 2026-10-18 snapshot (168 hidden scores, 12 benchmarks) mean error fell from 7.5 to 6.5 points and 85% of hidden scores landed inside the range. Re-run it before changing the estimator. At strictness 50 and above, a model needs 2 measured benchmarks to seed estimates and peers need 2 shared benchmarks. The peer offset shrinks as `off/(n+1)`.
- **Versioned benchmarks** use `versionPolicy`: `fallback` (DeepSWE 1.1 falls back to 1) or `fresh` (AA index versions).
- **Defaults:** strictness 50. `releasedAfter` undefined means models released in the six months before the snapshot date; an empty string (empty `after=` in the URL) means all time. Models with unknown release dates are never age-filtered.
- **Chart modes are independent.** `rankingVariants` defaults to `best`, `paretoVariants` to `all`. Compute the full variant set once, then call `selectVariants` per chart. `efforts` filters the cost, time and speed charts through `filterEfforts`.
- **The default view drops superseded versions.** Pages that show an index call `computeIndex(..., PAGE_VIEW)`. When the index has no `excludeModels` or `onlyModels` (nobody curated it), `supersededModelIds` (`src/engine/superseded.ts`) leaves out an older version of a line (same lab, same name apart from the version number, newer one no older by release date) none of whose efforts is on the cost frontier. Scores do not change, `result.autoHidden` lists them, the picker shows them unticked, and "All" is `excludeModels: []`, an explicit choice that turns the rule off. Internal callers (solver, optimizer, history) never pass `PAGE_VIEW`.

## Index configs and URLs

- `IndexConfig` is defined in the engine. `src/lib/url.ts` encodes it into one `i` query param per index: `?i=name|bench:w,...|req=|strict=|bars=|pareto=|est=|var=|effort=|labs=|ex=|only=|after=`. Several `i` params mean several indices.
- Links are written through `prettyQuery`, which keeps `:`, `,` and `=` readable; both forms decode the same. `page=handle.id.key` marks the published page index a builder index was opened from. It is written only to the builder's own address and the owner's "Open in builder" links, rides along at runtime (`FromPage`), is trusted only with the key held in that tab's sessionStorage, and is never stored.
- Stored configs (profiles) are validated by `convex/validators.ts`. `IndexConfig` is asserted exactly equal to the validator at compile time, so adding a field on one side without the other fails `tsc`. Every write goes through `storableIndex()`, which drops transient keys. `src/lib/stored-index.test.ts` checks every config producer.
- Model visibility is stored as whichever is shorter: `excludeModels`, or an `onlyModels` allowlist once more than half the picker is hidden (new models then stay hidden). Hiding a model is the user's choice and reversible: excluded models can be re-checked in the chart-settings model picker.
- `src/lib/import.ts` is the zod schema for user and agent benchmark imports, and merges them into a snapshot.
