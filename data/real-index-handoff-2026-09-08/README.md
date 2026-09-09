# Real Index data handoff

This is an optional, self-contained snapshot of Real Index's recorded evidence and current scoring implementation. Nothing here connects to Priors, replaces its data, installs dependencies, or changes its strictness settings. Read the JSON in any language; the bundled ES module also runs in Node without installation.

## Start here

Run `node verify.mjs` from this folder to check hashes and reproduce every exported score, benchmark resolution and calibration evidence record. Numeric reproduction allows an absolute 1e-10 tolerance for Node/Bun logarithm rounding; file hashes and evidence labels must match exactly.

```js
import { readFile } from 'node:fs/promises';
const read = async name => JSON.parse(await readFile(new URL(name, import.meta.url), 'utf8'));
const data = await read('dataset.json');
const formulas = await read('formulas.json');
const scores = await read('composite-scores.json');
const resolved = await read('resolved-benchmarks.json');
// Pick a published index, then inspect its scores and complete calculation trails.
const index = formulas.catalog.publishedIndices[0];
const results = scores.find(group => group.metricId === index.rootMetricId).scores;
console.log(results[0]);
// Every estimate has its own evidence label; missing values are present too.
console.log(resolved.filter(row => row.state === 'estimated').slice(0, 2));
```

## Files and contract

| File | Contents |
| --- | --- |
| `dataset.json` | All model configurations, enabled roster IDs, disabled IDs, original and assigned records, best observations, calibration references, token rates, reasoning profiles, performance estimates and fixed-task-basket evidence. |
| `formulas.json` | All effective benchmark scales, composite weights and versions, published index dates, ordered fallback routes, saved calibrations and policy identifiers. |
| `resolved-benchmarks.json` | One result per roster configuration/raw benchmark, including missing results; full inputs, conversions, sources and evidence states. Values use Real Index normalized points. |
| `composite-scores.json` | Every composite for the current enabled roster, including unpublished fallback-only formulas, provisional results, eligibility, coverage, allowance and complete leaf breakdowns. All configurations remain available in the dataset and raw benchmark resolutions. |
| `calibration-evidence.json` | Recomputed calibration factors and their direct matched evidence; the saved factors actually used for scoring are in `formulas.json`. |
| `engine.mjs` | Readable bundle of the actual current engine and data, with named exports; no external dependencies. |
| `source-files.json` | Original source text keyed by relative filename, including original TypeScript interfaces in `src/types/index.ts`. Kept as JSON so Priors does not compile it. |
| `methodology.md` | Formula, selection, calibration, coverage and uncertainty policy. |
| `priors.mjs` | Optional in-memory adapter for recorded observations only; see below. |
| `manifest.json` | Export time, source commit, working-tree changes, counts and SHA-256 for every other file. Export time is not observation freshness. |

`releaseObservations` preserves records before configuration assignment, including records the current selector does not use. `observations` preserves assigned candidates. `bestObservations` uses Real Index's shared selector: maximum for higher-is-better, minimum for lower-is-better, within the release and setting. This selection can prefer different harnesses on different benchmarks; source/harness details remain available so you can impose a stricter policy. Calibration-only models do not enter the roster.

Raw units belong to observations; `normalizedValue` is always 0–100 points. `rawValue: null` means no raw target value. Performance estimates can have a numeric estimated `rawValue`; check `state` and `estimateKind` rather than treating a non-null value as measured. Never replace a missing raw value with an estimated point score. All observation notes are retained, including source-derived quantities and token-price proxies; an engine `measured` label means a recorded input selected by our engine, not a guarantee of an independently verified experimental measurement.

Resolution labels are `measured`, `estimated`, `unsupported`, and `missing`. An estimate's `estimateKind` is `scaled` (benchmark fallback), `cross-effort`, or `performance`. Performance leaves retain component fits and donor evidence in `performanceEstimate`; benchmark conversions retain any release-specific `modelCalibration`. Composite fallback ingredients further distinguish `measured`, `cross-effort`, and `unsupported`. Source observations, native effort attribution, harness, conversion ID, paired evidence and effective weights remain attached. `unsupported` is a modality policy zero, not a measured failure. A missing leaf has zero contribution under our formula, not an observed zero.

Composite scores remain synthetic even when all ingredients are measured. `fallbackOnly` composites are included for inspection, not published indices. Their ordinary composite score can be partial; actual use as a fallback requires all positive-weight inputs under the resolver's rules. Consult the target leaf's `sourceComponents` for what was actually used. `perfectVisionScore` is a counterfactual display extension. `uncertainty.margin` is an editorial allowance, not a confidence interval. `estimatedPercent` includes the cross-effort portion; do not add `crossEffortEstimatedPercent` again.

## Run or customize the actual formulas

```js
import * as ri from './engine.mjs';
const metrics = ri.buildMetricMap();
const root = ri.publishedIndices[0].rootMetricId;
const baseline = ri.calculateIndexScores(root, ri.enabledModels, metrics, ri.observations, ri.calibrations, ri.models);
// Work on a clone; choose your own existing metric IDs and weights.
const custom = structuredClone(metrics);
custom.set('my-index', {
  id: 'my-index', version: '1', kind: 'composite', family: 'quality',
  name: 'My index', description: 'My chosen weights',
  components: [{ metricId: root, weight: 1 }],
});
const customized = ri.calculateIndexScores('my-index', ri.enabledModels, custom, ri.observations, ri.calibrations, ri.models);
console.log(baseline[0].score, customized[0].score);
```

Keep all evidence models when filtering the displayed roster: pass the full roster as the sixth `evidenceModels` argument so Top donors remain available. If you change raw scales, fallback composite weights or routes, recompute calibration with `generateFallbackCalibrations(models, metrics, observations, manualCalibrations, calibrationReferences)` and pass its `calibrations` explicitly. Signature changes can leave routes pending. Priors may instead use its own math on the records; the bundled engine intentionally reproduces Real Index policy, not Priors strictness.

Use `enabledModels` (or `dataset.enabledModelIds`) to match current published ranks. Using all `models` deliberately includes disabled configurations and can change ranks. The adapter includes all evidence configurations for customization; apply the enabled roster explicitly if matching Real Index. Current performance snapshots are frozen inside the bundled engine: editing the JSON copy alone does not refit them. The original generators and task/component research inputs are preserved in `source-files.json` for rebuilding those fits. Current task cost/time uses a fixed basket with its own weighting and coverage rules, documented in `methodology.md`.

## Using this in Priors

Priors's current upload schema/label matcher cannot losslessly carry all our identities, native token budgets, normalized estimates or evidence categories. The optional adapter returns arrays shaped for its `Snapshot` contract, bypassing that upload path. It contains only selected recorded observations; estimates and composites stay in their own files for explicit integration into Priors's evidence/strictness logic.

```js
import { createPriorsSupplement } from './priors.mjs';
// data and formulas loaded above
const supplement = createPriorsSupplement(data, formulas, { includeAssumedTop: false });
// Inspect supplement.models, .variants, .benchmarks and .observations.
// Integrate these arrays in your own loader when ready; no merge or write happens here.
```

IDs are prefixed `real-index:` and retain exact release/configuration distinctions. They intentionally do not join existing Priors models: doing that requires a reviewed identity crosswalk, especially for dated releases and standalone versus assisted systems. Append at most once, or replace only your own namespaced supplement on refresh. These IDs are intended for the Snapshot loader, not Priors's slug-restricted upload schema. Source dates are retained; there is no fabricated scrape run.

Adapter values are **normalized points**, with fixed 0–100 normalization and higher-is-better, including cost/speed. Original raw value, metric ID, effort attribution and notes are in `observation.details.realIndex`; use the original metric's unit/direction when displaying raw economics. Token price is marked as a proxy and is not cost per task. These supplemental benchmarks are not eligible for default weighting. Native efforts outside Priors's enum become `default` with the exact configuration in `variant.configuration`; IDs stay distinct. Review their treatment before enabling Priors effort inference.

`includeAssumedTop` defaults to true to preserve our selected records; false removes unspecified-effort Top assumptions. It does not claim all remaining records satisfy your strictness policy. Priors's current engine will not automatically enforce the richer metadata in `details`; implement your chosen filters before combining evidence. Never load `resolved-benchmarks.json` or composite scores into its ordinary observation array and expect strictness 100 to remove estimates.

## Refresh

From the Real Index checkout: `bun run export:data -- "C:/path/to/a-new-handoff-folder"`. Use a new folder each time: the exporter refuses to replace an existing directory. Then run that folder's `verify.mjs` and share the folder or a ZIP. No network fetch occurs; records retain their original observation dates and source URLs. This handoff does not grant or alter third-party source rights or attach a new license to either project.
