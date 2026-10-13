# Operations

## Environments

| | Dev | Production |
| --- | --- | --- |
| Site | `localhost` | `mypriors.com` (Vercel project `priors`; `www` redirects to apex; domain at Porkbun) |
| Convex | `canny-ferret-545` | `small-eel-326` |
| Clerk | dev instance, issuer `trusty-escargot-8963.clerk.accounts.dev` | production instance on `clerk.mypriors.com` (CNAMEs at Porkbun) |

Clerk and Convex are optional locally: without their keys the site runs fully anonymous (`authEnabled` and `convexEnabled` in `src/app/providers.tsx`).

Environment variables:

- `.env.local`: `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `AGENT_SERVER_SECRET`, `OPENROUTER_API_KEY`.
- Vercel production also has `NEXT_PUBLIC_SITE_URL=https://mypriors.com` (absolute link-preview URLs).
- Convex has `CLERK_JWT_ISSUER_DOMAIN` (prod: `clerk.mypriors.com`), `AGENT_SERVER_SECRET`, and optionally `AGENT_DAILY_USD_CAP` and `AGENT_USER_DAILY_REQUESTS`.
- When adding a Vercel variable from a shell, use `printf`, not `echo`: a trailing newline breaks it.

## Checks and deploys

- `npm run ci` runs `next typegen`, Vitest, `tsc` (including `convex/`) and ESLint. `npm run validate` adds a production build.
- A push to `main` deploys. `vercel.json` runs `npm run ci` before `next build`, so a failing check blocks the deploy. GitHub Actions runs the same on pushes and pull requests.
- If `CONVEX_DEPLOY_KEY` is set in Vercel, the build also deploys Convex functions. Until then, run `npx convex deploy` before pushing a schema change. `npx convex dev --once` pushes to the dev deployment.
- A fix or change Adam asks for ships without a second request: verify, push to `main`, confirm it live. See "Working here" in `AGENTS.md`.

## The scrape job

launchd job `com.adam.priors-scrape` runs `scripts/ops/daily-scrape.sh` from the main checkout (`~/priors`) every 2 hours at half past. The plist points at that path, so do not move or rename the script.

It runs `build.ts`, `npm run library` and `intro-cards.ts`, then `scripts/ops/snapshot-changed.ts` decides whether anything meaningful changed. If so it commits only `data/snapshots` and `public/intro` and pushes `main`, which deploys. It raises a macOS notification on a scrape, source or library failure, and when the default lineup has no exact fit. Log: `logs/scrape.log`.

Because that job commits to `main` in `~/priors` all day, do feature work in a worktree and expect `main` to move.

## Sign-in

- Clerk handles sign-in (Google, or email and password). Convex verifies Clerk's JWT.
- Clerk's free plan ends every session after 7 days. `ResumeSignIn` (mounted in `providers.tsx`, logic in `src/lib/resume-sign-in.ts`) keeps a signed-in Google user's Google account id in `localStorage["priors:resume"]`. On a signed-out arrival it asks Google once with `prompt=none` and that id, and returns to the same URL. One try per expiry. The header's sign-out stores a mark for that session, so a deliberate sign-out stays signed out. Password users sign in by hand.

## Analytics

PostHog (US), proxied through `/ingest`. Events go through `track()` in `src/lib/analytics.ts`. Signed-in events carry the Clerk user id and name, never the email. `scripts/posthog-dashboard.mjs <project_id>` recreates the dashboard; keys come from the macOS keychain.

## Browser storage

All keys are prefixed `priors:`.

| Key | Holds |
| --- | --- |
| `indices` | The builder's indices, so a return visit restores them |
| `lineup`, `bracket`, `focus` | Unfinished onboarding state |
| `mix` (cookie) | The last fitted mix; sends a returning visitor from `/` to the builder |
| `handle` | The signed-in user's handle (an ownership hint, not a credential) |
| `pending`, `return` | The index and page to come back to after sign-in |
| `chart:<key>` | Per-chart display preferences |
| `theme` | Pinned light or dark |
| `imports` | Benchmarks imported without an account |
| `via` | The profile a visitor arrived from, for the similarity line |
| `share-hint`, `assistant-mode` | Small UI state |
| `resume` | Google account id for silent re-sign-in |

`localStorage`, not `sessionStorage`, for anything that must survive sign-in: the OAuth round trip leaves the origin.
