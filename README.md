# Priors

A personal AI-model benchmark index: like Artificial Analysis, but the weights are yours. Rank a lineup of models, get benchmark weights fitted to that ranking, then explore the leaderboard, Pareto front and metric gallery. Live at <https://mypriors.com>. Signed-in users publish a customizable page at `mypriors.com/<handle>`.

Stack: Next.js, React, TypeScript, Tailwind, ECharts, Convex, Clerk, Vitest, Playwright, and a `tsx` scraper pipeline.

## Run it

```
npm install
npm run dev
```

It runs without any keys: Clerk and Convex are optional, and the benchmark data is committed in `data/snapshots/`. Add `.env.local` (see `docs/operations.md`) for sign-in, published pages and the mix assistant.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm test` | Vitest |
| `npm run ci` | Route types, tests, `tsc`, ESLint. The deploy gate |
| `npm run validate` | `ci` plus a production build |
| `BASE=http://localhost:3000 node scripts/verify/smoke.mjs` | Browser check of every route and the onboarding |
| `npm run scrape -- --date YYYY-MM-DD [--only aa]` | Build a data snapshot |
| `npx convex dev --once` | Push Convex schema and functions to dev |

## Docs

Start with `AGENTS.md`: the map of the code, the rules that must hold, and an index of the topic docs in `docs/`.
