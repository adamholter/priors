# ARC calibration beyond the leaderboard roster

The earlier no-overlap conclusion was wrong: it reflected missing observations and a roster-limited search. ARC-AGI-2 now converts to ARC-AGI-3 automatically using 13 matched releases, including nine reference-only releases. The unapproved manual factor 0.30 is superseded.

## Verified measurements

Collected September 5, 2026 from ARC Prize's official [ARC-AGI-2 data](https://arcprize.org/media/data/leaderboard/v2.json) and [ARC-AGI-3 data](https://arcprize.org/media/data/leaderboard/v3.json), both generated September 4. These are the semi-private datasets behind [the verified leaderboard](https://arcprize.org/leaderboard). Numeric source fractions are multiplied by 100; saved observations retain full source precision. The table rounds longer values for readability.

| Release | ARC-AGI-2 % | ARC-AGI-3 % | Selected efforts (2 / 3) |
|---|---:|---:|---|
| Claude Opus 4.6 | 69.17 | 0.51 | 120K, High / Max |
| Claude Opus 4.7 | 75.83 | 0.18 | Max / High |
| Claude Opus 4.8 | 72.08 | 1.52 | High / High |
| GPT-5.4 | 73.95 | 0.21 | XHigh / High |
| GPT-5.5 | 85 | 0.43 | XHigh / High |
| Gemini 3.1 Pro Preview | 77.08 | 0.42 | Not published / Not published |
| GPT-5.6 Terra | 83.9 | 0.8 | Max / Max |
| GPT-5.6 Luna (2026-07-09) | 59.54 | 0.18 | Max / Max |
| Grok 4.5 | 52.64 | 0.32 | High / Medium |
| GPT-5.6 Sol | 92.5 | 7.78 | Max / Max |
| Claude Opus 5 | 90.42 | 30.16 | Max / High |
| Grok 4.6 | 67.0833 | 2.11 | XHigh / XHigh |
| GPT-6 Astra | 95 | 62.7128 | Max / Max |

Gemini's "Preview" denotes the model release, not an effort setting; its reasoning budget remains Not published. All imported rows have source modelType CoT. Selection uses the highest eligible number for each release on each benchmark: Opus 4.6 high (69.17) beats max (68.75) on ARC-AGI-2; Grok 4.5 medium (0.32) beats high (0.30) on ARC-AGI-3. Different effort labels do not prevent pairing.

## Result

- Paired primary mean: 8.256369392354328.
- Paired secondary mean: 76.47641025641025.
- Factor: 8.256369392354328 / 76.47641025641025 = **0.10795968802238964**.
- Fable 90 -> **9.71637** ARC-AGI-3 points.
- Kimi 60.4 -> **6.52077** points.
- DeepSeek 61.3 -> **6.61793** points.

These are benchmark points before index weighting. The 13 releases each count once; effort variants are not independent calibration samples. The conversion aligns paired averages and does not guarantee predictions for individual models. No benchmark-disagreement penalty, regression fit or additional uncertainty allowance was introduced.

Grok 4.6, Opus 5, Sol and Astra now also expose their previously missing ARC-AGI-2 scores in their normal model audits. Their measured ARC-AGI-3 results still take priority. Astra's existing two-decimal measurement is refreshed to the source's full Standard-harness precision; this is not a switch to Provider Adapter.

## Scope and matching decisions

- Standard ARC-AGI-3 results match the existing metric's configuration. Provider Adapter rows are distinct configurations and are not merged into Standard or counted as another model. The user's screenshot exposes this distinction explicitly.
- GPT-5.4 Pro and GPT-5.5 Pro are separate releases, not higher-effort replacements for the base releases.
- Luna's original July 9 release is distinct from the July 30 refresh. The latter has no matching ARC-AGI-3 row in this source snapshot.
- Grok 4.20 is not imported: ARC-AGI-2 identifies beta 0309b while ARC-AGI-3 identifies beta 0309. Their release identity needs verification before joining. This is a release-label ambiguity, not an effort exclusion.
- Official IDs differ across benchmark versions for several early releases. Explicit aliases below map the named releases rather than guessing with broad prefix matching. Original evaluation row IDs remain in every observation's notes.

| Stable app/reference ID | ARC-AGI-2 source group/ID | ARC-AGI-3 source group/ID |
|---|---|---|
| claude-opus-4-6 | claude-opus-4-6-thinking | anthropic-opus-4-6-max-effort |
| claude-opus-4-7 | claude-4-7 | anthropic-opus-4-7 |
| claude-opus-4-8 | anthropic-opus-4-8 | anthropic-opus-4-8 |
| gpt-5-4 | gpt-5-4 | openai-gpt-5-4-2026-03-05-thinking |
| gpt-5-5 | gpt-5-5-2026-04-22-thinking | openai-gpt-5-5-2026-04-23-thinking |
| gemini-3-1-pro-preview | gemini-3-1-pro-preview | google-gemini-3-1-pro-preview |
| gpt-5-6-terra | openai-gpt-5-6-terra | openai-gpt-5-6-terra |
| gpt-5-6-luna-2026-07-09 | openai-gpt-5-6-luna | openai-gpt-5-6-luna |
| grok-4-5 | xai-grok-4-5 | xai-grok-4-5 |
| gpt-5-6-sol-max | openai-gpt-5-6-sol | openai-gpt-5-6-sol |
| claude-opus-5-max | anthropic-claude-opus-5 | anthropic-claude-opus-5 |
| grok-4-6-high | xai-grok-4-6 | xai-grok-4-6 |
| gpt-6-astra-max | openai-gpt-6-astra | openai-gpt-6-astra |

## Storage and workflow

src/data/calibrationReferences.ts stores minimal identities and sourced measurements independently of publication. The generator merges them with roster observations by stable ID and applies selectBestObservations, counting each release once. Reference-only models never enter calculateIndexScores, model selectors or Studio result bars. References remain available when their model leaves the leaderboard roster.

Studio previews, Studio saves and the calibration script use the same pool. Sensitivity observation snapshots include the independent reference data, and calibration evidence records model names, roster membership and paired IDs. Current index publication dates are September 5, 2026.

A focused regression protects reference-only evidence, duplicate membership, best-effort/mode selection, roster removal and the publication boundary. Full validation: 38 tests, typecheck, lint, provenance checks, production build and bundle exclusion check pass.
