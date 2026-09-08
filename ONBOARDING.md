# Priors onboarding experiment

Run this checkout with `npm run dev -- -p 48741`. The main Priors checkout and port 48740 are separate. No Clerk credentials or profile writes are needed here.

The home page lets someone reorder models with pointer dragging, arrow controls, or keyboard arrows. On touch screens, drag the grip; the rest of each row remains scrollable. Choose models changes the lineup. Escape cancels a drag or dismisses a dialog.

A worker searches benchmark weights and calculation settings, reports candidate progress, and simplifies the best fit. Stop & reorder terminates the worker and preserves the preferred order. The result links to `/builder` in this prototype with the fitted configuration encoded in the URL.

Fit quality measures pairwise ranking agreement. Missing models and tied scores must not be counted as matched pairs. The result is the best fit found by a heuristic search, not a proof of global optimality or model quality. Fitting benchmarks to a prior can overfit; the interface keeps that distinction visible.

Benchmark quality combines 30% release recency, 40% headroom and score spread, and 30% assigned grading objectivity. Unknown release dates receive neutral recency. The scorer uses benchmark release dates, never scrape dates, and deduplicates model effort variants. Verified dates link to publisher sources in `src/onboarding/quality.ts`.

Preferred benchmarks: DeepSWE 1.1, Terminal-Bench 4.0, ARC-AGI-3, SimpleBench, BullshitBench v2, Humanity's Last Exam, AA-Omniscience, and FrontierMath Tier 4 v2.
