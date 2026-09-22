<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Priors

Personal benchmark index builder. Anyone weights AI-model benchmarks, sees rankings + Pareto charts change live, shares by URL, and (signed in) publishes `mypriors.com/<handle>` with an editable page. One agent skill (`public/skill/SKILL.md`) lets a user's own agent add benchmarks and edit the page through `/api/agent`.

## Layout

- `src/data/types.ts` — the data contract (Snapshot, Model, Variant, Benchmark, Observation, RawRow, Source). Read first.
- `src/data/normalize.ts` — model label → canonical id/effort. Regex families + exact `ALIASES`. Unknown labels are excluded, never guessed. Tests in `normalize.test.ts`.
- `src/engine/index.ts` — index math: shares, coverage floor (measured share vs strictness), peer estimation for small gaps, min-max for non-percent units (log for usd), Pareto frontier, `defaultConfig`. Tests in `index.test.ts`.
- `src/lib/url.ts` — URL codec for anonymous indices: `?i=name|bench:w,...|req=|opt=|strict=|bars=|pareto=|cut=|est=|var=|effort=|labs=|ex=|after=` (multiple `i` params = multiple indices).
- `src/lib/import.ts` — zod schema for agent/user JSON imports + merge into a snapshot.
- `src/lib/og.tsx` — all 13 share-card designs (`SHARE_DESIGNS` in `share-designs.ts`; "Leaderboard" is the default, "qr" embeds a QR via the `qrcode` package). Every card footer reads `mypriors.com · <date>`.
- `src/components/page/MetricGallery.tsx` — collapsed extra-metric panels (Time per task open by default; Output speed, Latency, Release date, Uptime collapsed). Looks up per-variant detail fields on the index observation; source-qualified variant ids (`@effort~source-conf`) resolve to their base effort id, same as engine substitution. Uptime plots `-log10(downtime)` so 90/99/99.9% spread evenly; tooltips/export show raw %.
- `src/components/chart/ChartSettings.tsx` — per-chart gear menu: effort mode (best/all) + model-visibility checkboxes that toggle `excludeModels`.
- `src/onboarding/optimizer.ts` — fits benchmark weights from a user-ranked lineup. Search-time exclusions are internal only; the returned config never carries lineup-derived `excludeModels` — the lineup picks weights, not membership.
- `scripts/scrape/` — local scraper pipeline. `build.ts` runs every `sources/*.ts`, normalizes, writes `data/snapshots/<date>.json.gz` + `latest.json.gz`. Raw payloads in `data/raw/` (gitignored). Sources: aa (Artificial Analysis, encrypted RSC payloads), openrouter (operational metrics — uptime, providers, throughput, latency, tool-call errors; `defaultWeight: 0`), deepswe, frontierswe, terminalbench, bsbench, arena, simplebench, simpleqa, arcagi, frontiermath, andonlabs, exploitbench, posttrainbench, weirdml. Partial `--only` runs seed effort attribution from the prior snapshot.
- FrontierMath reads Epoch AI's live `https://epoch.ai/data/benchmarks.csv`: private Tiers 1–3 (v2), Tier 4 (v2), and Erdős. Public sample questions and obsolete v1 sets are excluded; raw CSV is retained. CSV standard errors are preserved as notes, not mislabeled as confidence intervals. Billable token totals are not treated as per-task usage/cost. `node scripts/verify-frontiermath.mjs` verifies search, adding, scores, responsive charts, and the 28px header wordmark.
- Preserve `none`, `minimal`, and `low` as distinct efforts. Explicit model sizes (e.g. Qwen 27B versus 35B-A3B), Instant variants, and dated DeepSeek revisions also remain distinct.
- `convex/` — profiles (handle, indices, sections, theme, agent token hash) + imports. Clerk JWT via `CLERK_JWT_ISSUER_DOMAIN` env in Convex.
- `src/app/` — `/` onboarding→builder redirect, `/builder` explorer (generateMetadata emits the og card per URL), `/[handle]` public page (+ `opengraph-image`), `/og` anonymous share card, `/skill`, `/import`, `/claim`, `/sign-in`, `/api/agent`, `/api/benchmarks`.

## Commands

- `npm run dev` (dev on 48740 in this workspace: `npx next dev -p 48740`)
- `npm test` — vitest (normalizer + engine)
- `node scripts/verify-motion.mjs` — rapid slider interruptions plus scrolling; checks row containment, interpolated motion, reduced motion, mobile overflow, and captures chart-label screenshots in `/tmp/priors-labels-*.png`.
- `npm run typecheck`, `npx eslint src scripts`
- With the local server running: `node scripts/verify-builder.mjs` checks sidebar, effort diagnostics, and snapshot updates; `node scripts/verify-effort-matching.mjs` checks the six-benchmark mix, calibrated/strict matching, independent chart modes, manual requirement overrides, advanced provenance, URL reload, and share cards. `TEST_REFRESH=1 node scripts/verify-builder.mjs` also runs a full live scrape through the browser button.
- `npm run scrape -- --date YYYY-MM-DD [--only aa,deepswe]` — full run takes ~2–3 min (terminalbench uses headless Chromium)
- `npx convex dev --once` — push schema/functions (deployment `canny-ferret-545`)
- Scrape: launchd `com.adam.priors-scrape` every 2 hours (xx:30) → `scripts/ops/daily-scrape.sh` → `build.ts` + `npm run library` → commits + pushes `data/snapshots` (main auto-deploys) and raises a macOS notification on scrape/source/library failures. Log: `logs/scrape.log`.

## Rules of the data

- Variant (model + reasoning effort) is the ranked unit. Effort unspecified by a source → attributed to the model's max known effort.
- Default effort matching is calibrated (`nearest` remains a legacy alias). Exact results win. Missing efforts use the nearest measured effort adjusted by same-model target/source ratios on other measured benchmarks; category matches count twice, and extreme 20% tails are trimmed with 5+ comparisons. Insufficient paired evidence remains missing. Never copy a maximum score unchanged as a lower-effort estimate. Preserve donor value, source variant/URL, multiplier and evidence in advanced Calculation settings; no estimate markers in the main charts. Cost/speed are never effort-substituted.
- Strictness 0–100 is the measured-coverage floor: a variant is ranked only when measured values (observed or effort-substituted; peer estimates never count) cover at least strictness% of the index's weight — 0 → anything with a value, 100 → fully measured. Strictness also controls minimum effort-comparison count, allowed effort distance and peer release window; 100 disables inference. `required` entries are explicit hard per-benchmark gates; `optional` is legacy and no longer affects ranking. `cutoff` remains supported for legacy URLs (derives strictness).
- Chart modes are independent: `rankingVariants` defaults to `best`, `paretoVariants` to `all`. Always compute the full variant set for the UI, then call `selectVariants` per chart. Calculation controls live in the advanced dialog; chart effort toggles live in each chart's settings icon.
- Cost means measured cost per task (`aa-cost-per-task-index`, benchmark `costUsd`), never token price. `aa-price-blended` is `proxy: true`.
- Logical benchmarks: `versionPolicy.fallback` (DeepSWE 1.1 → 1) or `fresh` (AA index versions).
- Percent scores are used raw; elo/score/usd are min-max normalized over the eligible pool.
- Missing values beyond the floor are estimated from peers (release window / price tier) and marked, or renormalized when estimation is off. At strictness ≥50 a model needs ≥2 measured benchmarks to seed estimates and peers need ≥2 shared benchmarks; the peer offset shrinks as `off/(n+1)`.
- Defaults: strictness 50, and `releasedAfter` undefined → the engine filters to models released in the six months before the snapshot date — `""` (empty `after=` URL param) means all time, and models with unknown release dates are never age-filtered. The chart-settings gear's "Models released" select controls it.

## Product decisions

- Lineup fit only determines benchmark weights — it must never silently exclude non-lineup models from exploration. Explicit `excludeModels` is a user choice: excluded models can be re-checked in the chart-settings model picker.
- Leaderboard shows top 30 (25 on profile pages) with a single "Show all" toggle — a staged 15→35→all expansion was tried and rejected; keep it simple.
- Weight sliders control benchmark *share* (0–70%), not raw weight, so the range is identical for every benchmark regardless of fitted weights.
- Share links point at `/builder?i=...` directly; `/builder` sets og/twitter meta to `/og?...` so X link unfurls show the card. X web intent cannot attach an image — Download the PNG for that.
- Metric gallery exists on both `/builder` and profile pages; Time per task is the default-open panel.

## Design

Bone `#FBFBF9`, ink `#1A1A1A`, one indigo `#2F4FB0` (the i in the wordmark), warm grey, hairlines. Newsreader (display/serif) + Inter + JetBrains Mono for numbers. Lab colors live in `LABS` in normalize.ts (same lab, same color everywhere). No taglines, no pills/chips, no gradients. Charts: ECharts with the `priors` theme in `src/components/chart/echarts.ts`; rankings are keyed DOM rows transitioning between list-local absolute positions, inside a paint-contained/clipped list. Avoid reintroducing viewport-coordinate FLIP measurements: they compound in-flight transforms during slider drags and scrolling. Brand boards: `~/priors-brand/index.html`.

## Production

- Live at `mypriors.com` (Vercel project `priors`, domain registered at Porkbun). `www` redirects to apex. Deploys on push to `main`; `npx vercel --prod` works too.
- Convex prod deployment `small-eel-326` (`npx convex deploy`); dev stays on `canny-ferret-545`. `CLERK_JWT_ISSUER_DOMAIN=clerk.mypriors.com` set on prod.
- Clerk production instance with custom domain `clerk.mypriors.com` (CNAMEs at Porkbun). Local `.env.local` still uses the dev instance (`pk_test`/`sk_test`, issuer `trusty-escargot-8963.clerk.accounts.dev`).
- `NEXT_PUBLIC_SITE_URL=https://mypriors.com` set in Vercel production for absolute OG URLs.

## Ranking logic diagram

`docs/ranking-logic.svg` — the eligibility/scoring flow (age filter → exclusions → measured share → Required gate → coverage floor → estimation → score). Regenerate when the engine's gates change.
