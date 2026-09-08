# Fallback scoring and score allowances

Preferred observations always win. Otherwise, try registered, modality-compatible alternatives in order and use the first with usable evidence and a matching calibration.

## Exact reasoning configurations

Select the best numeric result for each benchmark within the displayed release and exact reasoning setting. Top/Middle/Lowest map to fixed native settings recorded in src/data/reasoningProfiles.json. Compare settings over the same available quality benchmarks; use documented ordering provisionally when comparable measurements are unavailable. Unspecified effort applies only to Top (or a sole configuration), with the assumption visible in provenance. Known non-reasoning results remain excluded. Higher-is-better metrics use the maximum; lower-is-better metrics use the minimum. Endpoint token rates are shared; measured speed and task costs are setting-specific. The shared selector in src/engine/observations.ts drives scoring and calibration.

## Cross-effort estimates

After direct measurements and usable same-effort benchmark fallbacks, a missing Middle or Lowest capability benchmark may use that release's real Top measurement of the same benchmark. Compute one factor per lower configuration across registered raw capability benchmarks (quality, knowledge and vision) directly measured at both settings:

factor = mean(lower normalized points) / mean(Top normalized points)

estimated points = clamp(Top normalized points for the missing benchmark × factor, 0, 100)

Each shared benchmark counts once, regardless of index weights. This is a ratio of means, not a mean of per-benchmark ratios. One shared measurement and a positive Top mean suffice; zero lower means are valid. Factors may exceed one when the lower setting measures better. The same factor applies across index views; changing benchmark normalization or recorded measurements recomputes it. Top-only unspecified-effort assumptions remain visible on source observations.

Only this release's same-mode direct observations supply the factor and the missing benchmark's Top input. Other releases, other lower settings, resolved benchmark fallback scores, inferred scores and unsupported-vision zeros cannot supply these inputs. If the primary benchmark has no real Top measurement, registered fallback routes can instead estimate each missing raw input from its real Top measurement, then apply the normal benchmark conversion. Existing same-effort measured ingredients and unsupported-vision zeros retain their weights. These routes are labeled cross-effort estimates via benchmark fallback, with both conversion steps visible; the full target weight counts as cross-effort estimated and receives the allowance once. Estimates never become observations or calibration reference evidence. Confirmed unsupported vision keeps its existing zero and perfect-vision extension. Quality ratios do not estimate speed, latency, or costs.

The audit labels these as **Cross-effort estimate**, separately from **Benchmark fallback** and **measured**, and shows the Top measurement, factor, shared benchmark pairs and source links. Raw result cells remain empty because the estimated value is in normalized points. Coverage includes these estimates. `estimatedPercent` includes both estimate types; `crossEffortEstimatedPercent` reports the cross-effort portion separately. Both use effective index weight, not benchmark count or fraction of earned points.

Lower efforts use dotted outlines only when total estimated weight (benchmark fallbacks plus cross-effort estimates) exceeds 25%. Exactly 25% stays filled. Top and single configurations stay filled even when incomplete. The existing 75% display and 95% ranking coverage thresholds still apply after estimates; incomplete results below 95% retain their provisional label. Each estimate receives the same 10-point weighted substitution radius as a benchmark fallback, with no extra fit or sample-size penalty.

## Paired-average calibration

For each route, select models with direct compatible measurements on both the primary and secondary benchmarks. Use exactly the same models in both means:

The pool combines leaderboard configurations with independently recorded models in src/data/calibrationReferences.ts. Stable IDs merge both pools before selection. Primary and fallback measurements must belong to the same release and configuration, including reference-only releases. Use at most one matched setting per release: the pair with the highest normalized primary score. This prevents releases with more published settings from dominating calibration. Reference-only models never enter leaderboard results or model selectors. Measurements for a reference model already in the roster also supply its normal score audit. Research outside the roster before concluding that a route has no overlap.

factor = mean(primary normalized points) / mean(secondary normalized points)

converted points = clamp(secondary normalized points × factor, 0, 100)

This is a ratio of averages, not an average of each model's ratio. Unpaired models do not affect either mean. At least one paired model and a positive secondary mean are necessary. A zero primary mean produces a valid zero factor. No correlation, predictive-fit, or minimum sample-size gate beyond one pair applies.

The saved artifact freezes the factor and records all direct reference results, paired model IDs, paired count, method and benchmark signatures. Filtering the leaderboard never recalibrates it. Studio previews and saves regenerate calibration using the edited formula. Sparse or unrepresentative overlap can still produce an unreliable alignment; this is not proof of equivalent benchmark content or a statistical prediction interval.

## Manual calibration

A route with no overlapping models, or a zero secondary mean, requires manual calibration. Until approved, it is skipped and contributes no points or coverage. Later calibrated alternatives remain usable. There is no maximum-to-maximum conversion, reference-mean estimate or neutral 50-point substitute.

Approved manual factors belong in the optional manualCalibrations array in src/data/indexCatalog.json. Each entry includes targetMetricId, sourceMetricId, factor, targetSignature, sourceSignature and rationale. Use the signatures from the generated route artifact. Proposals stay in reports until the user approves them.

A manual factor is used only when no usable automatic paired ratio exists. Changed benchmark definitions or composite weights invalidate its signatures and require a new review. Usable overlapping measurements automatically take precedence when added. The conversion remains multiplicative, zero-preserving and clamped to 0–100.

ARC-AGI-2 now has direct overlap and uses automatic calibration. See [the ARC overlap audit](arc-overlap-calibration-2026-09-05.md); it supersedes the unapproved 0.30 proposal.

## Composite sources and vision

Routes are ordered in fallbackRoutes. Sources may be raw benchmarks or composite formulas, including nested composites. The first pass requires each positive-weight raw input's direct compatible result or confirmed unsupported-vision zero. The later cross-effort pass may fill missing inputs as described above. Neither pass chains an ingredient's benchmark fallback or redistributes missing weights. Normalize inputs, retain policy zeros, take the weighted sum, then apply the target conversion once.

Policy zeros resolve runtime coverage but do not count as measured calibration inputs. Composite reference models need direct measurements for every positive-weight ingredient. Source signatures include all nested weights and raw normalization definitions.

Confirmed unsupported vision receives zero, including inside composite fallbacks. Unknown support remains unresolved, and conflicting vision observations require review. The translucent perfect-vision extension sets only unsupported inputs to 100 through the same weights and conversion. It changes neither rank nor the allowance.

## Coverage and the editorial allowance

A preferred measurement, a calibrated compatible fallback, a cross-effort estimate, or a confirmed unsupported-vision zero resolves a weighted component. Missing unused alternatives do not reduce coverage. At least 95% unrounded coverage qualifies for ranking. Missing weight retains zero points.

fallback allowance = 10 × effective fallback weight

cross-effort allowance = 10 × effective cross-effort estimated weight

total ± margin = fallback allowance + cross-effort allowance + (100 − unrounded coverage) / 2

The 10-point allowance is already a ± radius. Automatic and manual conversions receive the same allowance. Disagreement, sparse overlap and repeated use of a source do not add another penalty. Ingredient count does not multiply the target's allowance.

At 97% coverage, the coverage margin is 1.5 points. With 20% fallback weight, the total is 3.5, displayed as ±4. Sum at full precision, then round the margin to a whole point. Keep central scores at one decimal and margins in regular faded text without a space after ±. Fully measured scores omit the allowance.

This is an editorial indicator, not measured variance or a bound on possible scores. Measurement noise, calibration uncertainty and benchmark differences are not quantified.

## Reproduction and validation

Run bun run calibrate after changing observations, benchmark scales, or approved manual factors. It rebuilds src/data/calibrations.json and reports/fallback-calibration-evidence.json. Run bun run sensitivity before publication to retain the formula and observation snapshots.

Historical reports and formula snapshots preserve the earlier maximum-to-maximum methodology; this document supersedes it. Regression tests protect paired arithmetic and identity matching, pending/manual transitions, next-route selection, signature invalidation, primary priority, coverage and vision handling. No model-specific exception applies.
