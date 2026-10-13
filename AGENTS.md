<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Priors

Personal AI-model benchmark index, live at mypriors.com. A visitor ranks a lineup of models, gets benchmark weights fitted to that ranking, then explores the leaderboard and charts as the weights change. Indices share by URL. Signed-in users publish an editable page at `mypriors.com/<handle>`. An agent skill (`public/skill/SKILL.md`) lets a user's own agent add benchmarks and edit their page through `/api/agent`.

Stack: Next.js App Router, React, TypeScript, Tailwind, ECharts, Convex, Clerk, Vitest, Playwright, and a `tsx` scraper pipeline.

## Map

| Path | What lives there |
| --- | --- |
| `src/data/` | The data contract (`types.ts`, read first), model-label normalization, snapshot loading, cost and time sources |
| `src/engine/index.ts` | Index math: shares, coverage floor, effort matching, peer estimation, Pareto frontier |
| `src/lib/` | Pure helpers: URL codec (`url.ts`), chart metrics, formulas, page themes, share cards (`og.tsx`, `og-chart.ts`), imports |
| `src/onboarding/` | The ranking onboarding: matchups, review list, and the weight search (worker, optimizer, quality) |
| `src/agent/` | The mix assistant: tool loop, tools, edit solver |
| `src/components/` | UI. `chart/` charts and their option builders, `page/` profile pages and editing, `model/`, `model-finder/`, `lab/` |
| `src/app/` | Routes. Pages are thin: load a snapshot, render a component |
| `convex/` | Profiles, imports, recorded lineups, assistant budget. `validators.ts` defines every stored shape |
| `scripts/scrape/` | Scrapers (`sources/`), snapshot build, mix library |
| `scripts/verify/` | Browser checks against a running dev server |
| `scripts/ops/` | The scheduled scrape job |
| `data/snapshots/` | One committed snapshot per day, plus `latest` |

## Docs

Read the one for the area you are changing. Update it in the same change when behavior moves.

- `docs/data.md`: data contract, model identity, scrapers, index math, URL and stored configs.
- `docs/charts.md`: rankings, chart kinds and settings, highlights, the no-clipping rule, exports.
- `docs/pages-and-sharing.md`: routes, profile pages and editing, themes, share cards, link previews, labs.
- `docs/onboarding.md`: the matchups, the review list, the weight search and its scoring.
- `docs/assistant.md`: mix assistant, edit solver, spend caps, the agent API and skill.
- `docs/design.md`: tokens, type, light and dark, copy and style rules.
- `docs/operations.md`: environments, checks and deploys, the scrape job, sign-in, analytics, browser storage.

## Rules that must hold

- A variant (model + reasoning effort) is the ranked unit. Unknown model labels are excluded, never guessed.
- Scores are used as published. Nothing is stretched so the leader reads 100.
- Cost means measured cost per task, never token price.
- Every benchmark comes from a live scraper. No frozen datasets.
- The lineup fit only sets benchmark weights. It never excludes models, and an unlisted model must never land in the top 5.
- Pages never store model lists. Hiding models writes `excludeModels`, so new models appear on their own.
- `convex/validators.ts` is the one definition of stored shapes, and every write goes through `storableIndex()`.
- Chart text never clips. See `docs/charts.md` before touching grids or labels.
- Never hardcode a hex color in a component. No taglines, pills, chips or gradients. No em dashes in copy.
- OpenRouter is called server-side only, behind the spend caps in `convex/agentBudget.ts`.
- Do not move `scripts/ops/daily-scrape.sh`: a launchd job runs it by path.

## Commands

- `npm run dev`: dev server. The main checkout uses port 48740 (`npx next dev -p 48740`); give each worktree its own port.
- `npm test`: Vitest (engine, normalizer, optimizer, solver, scrapers, share cards).
- `npm run ci`: route types, tests, `tsc`, ESLint. This is the deploy gate.
- `npm run validate`: `ci` plus a production build. Run it before handoff.
- `BASE=http://localhost:<port> node scripts/verify/smoke.mjs`: every route plus the onboarding end to end, in a headless browser. Other checks in `scripts/verify/` take the same `BASE`.
- `npm run scrape -- --date YYYY-MM-DD [--only aa,openrouter]`: build a snapshot.
- `npm run library -- --date YYYY-MM-DD`: rebuild the mix library.
- `npx convex dev --once`: push schema and functions to the dev deployment.

## Working here

- `main` moves all day: a scheduled job pushes data snapshots to it from `~/priors-scrape`. Never work in that checkout. Work in a worktree and rebase before shipping.
- **A fix is done when it is live.** When Adam asks for a fix or a change, ship it in the same turn: verify (`npm run validate`, the smoke check), commit, rebase on `origin/main`, push to `main`, confirm it on mypriors.com, then report. Do not stop to ask "should I deploy?". This overrides any broader "do not deploy unless asked" rule from outside this repo.
- Ask before shipping only when the change would delete or rewrite stored user data, or when Adam said to hold it.
- A design question gets a lab: three or four switchable variants on the real page under `/lab/`. When it is settled, ship the winner and delete the lab and the losing variants.
- Code style is dense on purpose. Match the file you are in.
