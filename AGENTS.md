<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Priors

Personal benchmark index builder. Anyone weights AI-model benchmarks, sees rankings + Pareto charts change live, shares by URL, and (signed in) publishes `priors.so/<handle>` with an editable page. One agent skill (`public/skill/SKILL.md`) lets a user's own agent add benchmarks and edit the page through `/api/agent`.

## Layout

- `src/data/types.ts` — the data contract (Snapshot, Model, Variant, Benchmark, Observation, RawRow, Source). Read first.
- `src/data/normalize.ts` — model label → canonical id/effort. Regex families + exact `ALIASES`. Unknown labels are excluded, never guessed. Tests in `normalize.test.ts`.
- `src/engine/index.ts` — index math: shares, implicit required via cutoff, peer estimation for small gaps, min-max for non-percent units (log for usd), Pareto frontier, `defaultConfig` (coverage-derived). Tests in `index.test.ts`.
- `src/lib/url.ts` — URL codec for anonymous indices (`?i=name|bench:w,...|req=|cut=|est=|var=`).
- `src/lib/import.ts` — zod schema for agent/user JSON imports + merge into a snapshot.
- `scripts/scrape/` — local scraper pipeline. `build.ts` runs every `sources/*.ts`, normalizes, writes `data/snapshots/<date>.json.gz` + `latest.json.gz`. Raw payloads in `data/raw/` (gitignored). Sources: aa (Artificial Analysis, encrypted RSC payloads), deepswe, frontierswe, terminalbench, bsbench, arena, simplebench, arcagi, frontiermath.
- FrontierMath reads Epoch AI's live `https://epoch.ai/data/benchmarks.csv`: private Tiers 1–3 (v2), Tier 4 (v2), and Erdős. Public sample questions and obsolete v1 sets are excluded; raw CSV is retained. CSV standard errors are preserved as notes, not mislabeled as confidence intervals. Billable token totals are not treated as per-task usage/cost. `node scripts/verify-frontiermath.mjs` verifies search, adding, scores, responsive charts, and the 28px header wordmark.
- Preserve `none`, `minimal`, and `low` as distinct efforts. Explicit model sizes (e.g. Qwen 27B versus 35B-A3B), Instant variants, and dated DeepSeek revisions also remain distinct.
- `convex/` — profiles (handle, indices, sections, theme, agent token hash) + imports. Clerk JWT via `CLERK_JWT_ISSUER_DOMAIN` env in Convex.
- `src/app/` — `/` builder, `/[handle]` public page (+ `opengraph-image`), `/og` anonymous share card, `/skill`, `/import`, `/claim`, `/sign-in`, `/api/agent`, `/api/benchmarks`.

## Commands

- `npm run dev` (dev on 48740 in this workspace: `npx next dev -p 48740`)
- `npm test` — vitest (normalizer + engine)
- `node scripts/verify-motion.mjs` — rapid slider interruptions plus scrolling; checks row containment, interpolated motion, reduced motion, mobile overflow, and captures chart-label screenshots in `/tmp/priors-labels-*.png`.
- `npm run typecheck`, `npx eslint src scripts`
- With the local server running: `node scripts/verify-builder.mjs` checks sidebar, effort diagnostics, and snapshot updates; `node scripts/verify-effort-matching.mjs` checks the six-benchmark mix, calibrated/strict matching, independent chart modes, manual requirement overrides, advanced provenance, URL reload, and share cards. `TEST_REFRESH=1 node scripts/verify-builder.mjs` also runs a full live scrape through the browser button.
- `npm run scrape -- --date YYYY-MM-DD [--only aa,deepswe]` — full run takes ~2–3 min (terminalbench uses headless Chromium)
- `npx convex dev --once` — push schema/functions (deployment `canny-ferret-545`)
- Daily scrape: launchd `com.adam.priors-scrape` at 06:30 → `scripts/ops/daily-scrape.sh` → commits `data/snapshots`. Log: `logs/scrape.log`. Deploy is manual.

## Rules of the data

- Variant (model + reasoning effort) is the ranked unit. Effort unspecified by a source → attributed to the model's max known effort.
- Default effort matching is calibrated (`nearest` remains a legacy alias). Exact results win. Missing efforts use the nearest measured effort adjusted by same-model target/source ratios on other measured benchmarks; category matches count twice, and extreme 20% tails are trimmed with 5+ comparisons. Insufficient paired evidence remains missing. Never copy a maximum score unchanged as a lower-effort estimate. Preserve donor value, source variant/URL, multiplier and evidence in advanced Calculation settings; no estimate markers in the main charts. Cost/speed are never effort-substituted.
- Strictness 0–100 controls automatic requirements, minimum effort-comparison count, allowed effort distance and peer release window; 100 disables inference. `required` and `optional` arrays override automatic requirements. `cutoff` remains supported for legacy URLs.
- Chart modes are independent: `rankingVariants` defaults to `best`, `paretoVariants` to `all`. Always compute the full variant set for the UI, then call `selectVariants` per chart. Calculation controls live in the advanced dialog; chart effort toggles live in each chart's settings icon.
- Cost means measured cost per task (`aa-cost-per-task-index`, benchmark `costUsd`), never token price. `aa-price-blended` is `proxy: true`.
- Logical benchmarks: `versionPolicy.fallback` (DeepSWE 1.1 → 1) or `fresh` (AA index versions).
- Percent scores are used raw; elo/score/usd are min-max normalized over the eligible pool.
- Any benchmark above the cutoff share (default 5%) is required; below it, missing values are estimated from peers (release window / price tier) and marked, or renormalized when estimation is off.

## Design

Bone `#FBFBF9`, ink `#1A1A1A`, one indigo `#2F4FB0` (the i in the wordmark), warm grey, hairlines. Newsreader (display/serif) + Inter + JetBrains Mono for numbers. Lab colors live in `LABS` in normalize.ts (same lab, same color everywhere). No taglines, no pills/chips, no gradients. Charts: ECharts with the `priors` theme in `src/components/chart/echarts.ts`; rankings are keyed DOM rows transitioning between list-local absolute positions, inside a paint-contained/clipped list. Avoid reintroducing viewport-coordinate FLIP measurements: they compound in-flight transforms during slider drags and scrolling. Brand boards: `~/priors-brand/index.html`.

## Not yet configured

- Clerk keys (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`) and Convex `CLERK_JWT_ISSUER_DOMAIN`. Until set, the site is anonymous-only and sign-in/claim pages show a notice.
- `NEXT_PUBLIC_SITE_URL` for absolute OG URLs in production.
