# Onboarding

New visitors at `/` and `/rank` rank a lineup of models; the search then finds the benchmark mix that agrees with them. The lineup is the default index's top 16 (`defaultLineup(snapshot, 16)`). The component is `src/onboarding/Onboarding.tsx`. It has three stages: the calls, the review list, the search.

## The calls

**Smart sprint (normal case).** With ranking evidence for today's snapshot (`rankingEvidence` in `evidence.ts`, built from the precomputed mix library), `runAdaptive` in `adaptive.ts` asks the pairs the evidence is least sure about, weighted toward the top, at most 6 calls (`SMART_CALLS`). Same-family versions and pairs implied by earlier answers are never asked. It can finish before the cap.

**Plain bracket (fallback, no evidence).** `bracket.ts`, at most 10 calls (`BRACKET` in `Onboarding.tsx`): the top 5 seeds are sorted with a merge bracket (before each merge the weakest of the stronger group meets the best of the other, so agreeing settles a merge in one call), then each of the next 5 seeds challenges the current #5. A winner is placed by binary search and bumps #5 out. Seeds 11 to 16 keep index order. Agreeing with the index takes 9 calls; at the cap, remaining matches follow index order.

The UI for both is `BracketDuel.tsx` (not `Bracket.tsx`: that clashes with `bracket.ts` on case-insensitive macOS). Each call is Left is better / Right is better / Not sure: by button, tapping a card, dragging toward the better card, or ← → ↓ (Backspace/Z undoes). Dragging only ever means choosing: from the first few pixels the card being dragged toward lifts, gains an indigo outline and a ✓ Better mark, the other dims and greys, the line under the cards names the model ("Opus 5.5 is better →"), and the matching button highlights; past 72px it locks (indigo, haptic tick). Releasing early cancels. On commit the loser leaves and the winner glides to centre before the next pair. Not sure is a button only (no swipe-up). The first matchup plays a one-time nudge on the left card. Not sure defers that pair to seed order; pairs implied by earlier calls are never asked (optional double-checks of inferred pairs are off by default). Contradictions (loops) are resolved by the order breaking the fewest calls, closest to the index. The bracket is a pure replay of the answer list, so undo drops the last answer; progress persists in `localStorage["priors:bracket"]`. "Let the index decide the rest" answers the remainder with Not sure. Finishing the calls stops at the review list (see below). "Rank the list instead" skips straight to the list. The fit's priority baseline stays the default lineup.

## The review list

The sprint cannot ask every matchup, so finishing the calls stops at the review list under "Does this look right?". The primary button is "Looks right, find my index". "Compare more pairs" reopens the matchups with the earlier calls kept and up to 6 more (`MORE_CALLS`; any unsettled pair may be asked, and drag edits carry over as settled calls).

Reorder models with pointer dragging, arrow controls, or keyboard arrows. On touch screens, drag the grip; the rest of each row remains scrollable. Choose models changes the lineup. Escape cancels a drag or dismisses a dialog.

## The search

A web worker (`fit.worker.ts`) searches benchmark weights and calculation settings, reports candidate progress, and simplifies the best fit. Stop & reorder terminates the worker and preserves the preferred order. The result opens `/builder` with the fitted configuration encoded in the URL. The lineup only determines weights; it never becomes an `excludeModels` filter on the index.

Only the selected lineup enters the fitting objective. The initial lineup is a baseline, so reversing an existing comparison or adding a model creates explicit priorities. The optimizer first minimizes missing models, then violations of explicit priorities from the top down, then top-weighted disagreements across the rest of the selected lineup. Comparisons use inverse squared rank weighting, so a mistake near the top costs more than one near the bottom. Benchmark count, affinity penalty, estimation share, and evidence quality break ties after ranking fit. Unselected models cannot offset a selected-model disagreement.

**Focus.** In the review list the user picks one of four presets (`src/onboarding/focus.ts`, `FOCUSES`); the choice persists in `localStorage["priors:focus"]` and rides along on the result URL as `focus=` (ranking ignores it).

| Focus | Strong categories | Starter mix |
| --- | --- | --- |
| Capabilities (default) | coding, agentic 1.0 | DeepSWE 1.1, Terminal-Bench 4, ARC-AGI-3, Tau3 Banking, HLE |
| Knowledge | knowledge 1.0, long-context .6 | AA-Omniscience, HLE, GPQA Diamond, MLCR, SimpleBench |
| Problem solving | reasoning, math 1.0 | ARC-AGI-3, FrontierMath T4, HLE, SimpleBench, DeepSWE 1.1 |
| General | everything 1.0 | balanced mix of the above |

Unlisted categories get multiplier 0.15. `focusMultiplier(focus, category)` maps a benchmark to its weight.

**Displayed fit.** `fitScore(target, scores, benchCount)` in `optimizer.ts` is the headline number, recomputed on every candidate:

```
wrong      = Σ over wrong pairs (i = 0-based target rank of the model that should be above): 25/√(i+1)
             (a model missing from the ranking counts as wrong against every other model)
thin       = 5 · Σ_correct w·max(0, 1 − gap/3) / Σ_correct w,   w = 1/(i+1) over adjacent pairs (0 if none)
complexity = 5 · clamp((benchCount − 4)/8, 0, 1)
fitScore   = clamp(100 − wrong − thin − complexity, 0, 100)
```

A 14-model lineup with 4 benchmarks and wide gaps: perfect → 100; swapping #1↔#2 → ~75; #7↔#8 → ~90; #13↔#14 → ~93; perfect with 12 benchmarks → 95; perfect with hair-thin gaps → ~97.5. Mistakes near the top cost the most, thin margins and extra benchmarks cost a little. An incomplete search explicitly reports "No matching configuration found" and shows the disagreements. It is a bounded heuristic search, not a proof that no mix exists.

**Benchmark quality** (`src/onboarding/quality.ts`): `0.25·coverage + 0.25·recency + 0.30·headroom + 0.20·objectivity + (preferred ? 15 : 0) − (superseded ? 25 : 0)`, clamped 0–100, where `coverage = 100·min(1, modelsMeasured/40)`. Unknown release dates receive neutral recency; the scorer uses benchmark release dates, never scrape dates, and deduplicates effort variants. Verified dates link to publisher sources.

`PREFERRED`: DeepSWE 1.1, Terminal-Bench 4, ARC-AGI-3, SimpleBench, BullshitBench v2, Humanity's Last Exam, AA-Omniscience, FrontierMath Tier 4 v2. `SUPERSEDED`: Terminal-Bench v2.1, ARC-AGI-1/2, DeepSWE 1, MATH-500.

**Affinity** `= quality/100 · focusMultiplier` (0–1) steers the whole search: restart seeding samples benchmarks ∝ affinity, coordinate descent iterates them in descending affinity, the random walk draws ∝ affinity, and the surrogate's preference term penalizes `Σ share·(1 − affinity)`. All four focus starters seed candidate basins (the selected focus goes first), so a lineup whose best mix sits outside the chosen focus still has a nearby start.

**Library seeding.** `scripts/scrape/library.ts` (`npm run library -- --date <date>`, also run automatically at the end of `build.ts` and by the scheduled scrape) samples ~300 affinity-weighted mixes of 4–8 benchmarks per focus, computes their full-pool rankings, greedily keeps ~20 that maximize quality while staying Kendall-tau-diverse (≥0.15 apart), always includes the focus starter, and, when Convex is reachable, refits the top recorded lineups. It writes `data/snapshots/<date>.library.json.gz` + `latest.library.json.gz`, served via `GET /api/library?date=`. Onboarding fetches it on mount; the worker scores each stored mix by pair agreement against the requested lineup and verifies the top three directly. Library misses, stale dates, or new models absent from a stored ranking simply count as missing: seeding degrades gracefully to live column computation. Exact verification always runs the live snapshot.

**Time budget.** The search is wall-clock bounded: 30 s soft / 60 s hard (`budgetMs` option, defaults `{soft: 30_000, hard: 60_000}`). Surrogate screening and annealing run while the soft window is open; verification, refinement, and simplification stop at the hard cap. Exact evaluations are memoized on normalized weights + settings.

**Lineup recording.** On completion the client fire-and-forgets `lineups.record` (Convex, anonymous, guarded by `convexEnabled`): `{focus, lineup, weights, strictness, fitScore, exact, snapshotDate}`. The `lineups` table indexes `by_key` (`focus|model,ids`); `lineups.top` aggregates the most common lineups per focus for the next library build. Lineups outside 2–40 models are rejected.

Search pipeline per settings row (`SETTINGS`): build single-benchmark surrogate columns (from the library when available, else live), screen affinity-seeded restarts, then verify the top finalists plus every seed mix against the full engine. Exact-stage annealing runs next: it accepts temporary setbacks, cools and reheats, and restarts from distinct verified basins. It is followed by fine-weight polishing at 0.1 precision (matching URL serialization), per-settings refinement, a full-engine coordinate pass, and final simplification that drops benchmarks which no longer help. The displayed incumbent remains the best verified fit throughout. Exact candidates are always evaluated against the full model pool, so the published index reproduces the displayed ranking.

## The result

The completion dialog (`Finish.tsx`) shows the ranking card with a share menu and "Explore your index". Visitors arriving from a published profile also see how similar their ranking is to that page's. Returning visitors at `/` go straight to the builder.

## The search panel

`SearchMonitor.tsx` shows the search in progress: a mini leaderboard of the lineup (a slot is solid once it holds the model you put there, dotted otherwise) beside every candidate test (lit when in the mix, ringed while the search tries it). The status line changes on a fixed beat (`useTicker`, about 2.3 s with slight variation and a roll between lines): a new search message when one is waiting, otherwise a stock line for the phase.

## Product rules

- The lineup fit only determines benchmark weights. It must never silently exclude non-lineup models from exploration.
- An unlisted model must never land in the overall top 5: the fit's loss ranks top-5 intruders above any order error, and a fit with intruders is not an exact match.
- The default lineup (`defaults.ts`) is computed from the current snapshot under `DEFAULT_PRIORS_MIX` (the newest AA Intelligence Index). It is never a hand-edited list.
- `npm run library` pre-fits the default lineup and popular lineups into `fits` in the library, so the default fit stays exact. The client verifies stored fits first and stops searching once exact. Fits carry forward between builds; `--seed <json>` bootstraps one. The scrape raises a notification on `DEFAULT_FIT_MISSING`.
- A completed fit sets the `priors:mix` cookie, which is what sends a returning visitor from `/` to the builder.
