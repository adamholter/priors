# Convex backend

| File | Purpose |
| --- | --- |
| `schema.ts` | Tables: `profiles`, `imports`, `lineups`, `shortLinks`, `agentSpend`, `agentUsers` |
| `validators.ts` | The one definition of stored shapes (`indexConfig`, `section`, `profileTheme`, `chartView`). Types elsewhere are inferred from it |
| `profiles.ts` | Claim a handle, read and update a page, mint an agent token, `agentApply` for the agent API |
| `lineups.ts` | Anonymous record of completed onboarding lineups; `top` feeds the mix library |
| `shortLinks.ts` | Anonymous short links: `create` (same path, same slug) and `resolve`, behind `/s/<slug>`. Pure checks in `shortLinkPath.ts` |
| `agentBudget.ts` | Daily spend cap and per-user request limit for the mix assistant |
| `dev.ts` | Dev-only helpers |
| `auth.config.ts` | Clerk JWT issuer (`CLERK_JWT_ISSUER_DOMAIN`) |

Dev deployment `canny-ferret-545`, production `small-eel-326`. `npx convex dev --once` pushes to dev; `npx convex deploy` pushes to production.

Adding a field to a stored index config means adding it to both `validators.ts` and `IndexConfig` in `src/engine/index.ts`: `tsc` fails until they match exactly.
