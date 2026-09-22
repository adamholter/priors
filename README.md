# Priors

A personal AI-model benchmark index — like Artificial Analysis, but the
weights are yours. Rank a lineup of models, get benchmark weights fitted to
that ranking, then explore the leaderboard, Pareto front, and metric gallery
live at <https://mypriors.com>. Signed-in users publish a customizable page at
`mypriors.com/<handle>`.

Stack: Next.js + React + TypeScript, Convex + Clerk, ECharts, Vitest,
Playwright verify scripts, `tsx` scraper pipeline.

## Commands

- `npm run dev` — dev server (48740 in this checkout: `npx next dev -p 48740`)
- `npm test` — vitest (engine, normalizer, optimizer, scraper tests)
- `npm run typecheck` · `npx eslint src scripts`
- `npm run scrape -- --date YYYY-MM-DD [--only aa,openrouter]` — snapshot build
- `npx convex dev --once` — push schema/functions to the dev deployment

## Docs

- `AGENTS.md` — architecture, data rules, product decisions, design system,
  production/deploy notes. Read first.
- `ONBOARDING.md` — the lineup-fit onboarding flow and optimizer semantics.
- `public/skill/SKILL.md` — the agent skill served at `/skill` (add benchmarks,
  edit pages via `/api/agent`).
