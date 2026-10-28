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
- **Tests read the checked-in snapshot everywhere** (`SNAPSHOT_BASE_URL: ""` in `vitest.config.ts`). On Vercel `loadSnapshot` reads data-live, so before this the deploy gate tested whatever data was live that minute and could fail where the local run passed.
- **Pushing to `main` runs GitHub CI locally first** (`.githooks/pre-push`, wired by `core.hooksPath`): `npm run ci`, `npm run build`, then `npm run e2e` on port 48797, the same three steps as the `check` and `e2e` jobs, so CI passes first try. Data-only pushes skip it. `PRIORS_PUSH_SKIP_E2E=1` skips the build and e2e (CI still runs them). The log is `$TMPDIR/priors-prepush.log`.
- A push to `main` deploys, unless it only changed `data/snapshots` or `public/intro`: `ignoreCommand` in `vercel.json` skips the build for those (the scrape job's daily archive commit). `vercel.json` runs `npm run ci` before `next build`, so a failing check blocks the deploy.
- **Live data without a build.** The scrape job publishes each changed snapshot to the repo's `data-live` branch, a single commit rewritten every time (`latest*.json.gz`, today's dated files, the intro cards, and a `vercel.json` that turns deployments off for the branch). In production `loadSnapshot` and `loadMixLibrary` (`src/data/load.ts`) read the newest files from `raw.githubusercontent.com/adamholter/priors/data-live/data/snapshots`, keep them five minutes per instance, and fall back to the copy in the build if the fetch fails. `/intro/*` cards are rewritten to the branch's copy (`next.config.ts`). So new data is on the site a few minutes after a scrape, at no build cost and without growing `main`'s history. Locally and in tests the checkout is read; `SNAPSHOT_BASE_URL` overrides the source (empty turns it off). Dated snapshots from the last 30 days that the build lacks are fetched from the branch too; older ones come from the build.
- If `CONVEX_DEPLOY_KEY` is set in Vercel, the build also deploys Convex functions. Until then, run `npx convex deploy` before pushing a schema change. `npx convex dev --once` pushes to the dev deployment. Every checkout shares that one dev deployment, and a push replaces all of its functions: it removes functions and indexes that only exist in another checkout's uncommitted work, until that checkout pushes again.
- A fix or change Adam asks for ships without a second request: verify, push to `main`, confirm it live. See "Working here" in `AGENTS.md`.

## The scrape job

launchd job `com.adam.priors-scrape` runs `scripts/ops/daily-scrape.sh` every 15 minutes, from its own checkout at `~/priors-scrape`. The plist points at that path, so do not move or rename the script.

- **The checkout holds nothing but `origin/main`.** Each run starts with `git checkout -f --detach origin/main`, so it always scrapes with the newest code and can always push. It installs packages again when `package-lock.json` changes. Never work in `~/priors-scrape`: local changes there are thrown away.
- **One run at a time.** The script takes a lock (`$TMPDIR/priors-scrape.lock` holding its pid) after the marker check and skips the run if the previous one is still going, so a slow library search cannot overlap the next 15-minute start. A dead pid's lock is cleared.
- **The marker file.** The script refuses to run unless `.scrape-checkout` exists in the checkout root, so the reset can never hit a checkout someone works in.
- **What it does.** It runs `build.ts --no-library` (every source, about 30 seconds), then `scripts/ops/snapshot-changed.ts` decides whether anything meaningful changed. If nothing did, it stops. If so it rebuilds the mix library (`npm run library`) unless one was built under two hours ago (`library-built-at` on `data-live`; `PRIORS_LIBRARY_EVERY` seconds overrides) and renders `intro-cards.ts`, publishes the files to `data-live` (`publish_live` in the script). Change detection compares with what `data-live` holds, not with `main`. The first run of each new day also archives the finished days: it copies their final dated files, plus the latest files and intro cards, from `data-live` into one `data: archive finished days` commit on `main` (which the build ignores). `main` therefore grows by one data commit a day; the live branch is the only place the day's scrapes exist until then, and it keeps three days of dated files. If `main` moved during the scrape it rebases the snapshot commit and pushes again.
- **It has a test.** `scripts/ops/snapshot-changed.test.ts` runs the real script in a throwaway repo. Run `npm run ci` after touching the script: a failing check blocks every deploy, the job's own included.
- **Why it is quick.** Sources run six at a time and take half a minute in all. The slow part used to be the mix library's lineup fits (each popular lineup searched for up to 20 seconds, every run, twice). Now the library is built once and only when the data changed, and each stored fit is re-checked against today's data (`fitPriors` verifies stored fits before it searches) and kept while it still matches or loses under 1.5 points; only a fit that got worse is searched again. A fit whose data and ranking code are byte-identical (`fitFingerprint`) is not even re-checked. The first run after a new benchmark or code change searches everything (about 10 minutes); later ones take about a minute. Build log lines `TIMING sources` and `fits: n unchanged, n re-verified, n searched` show where time goes; library output now reaches `scrape.log`.
- **Alerts and log.** It raises a macOS notification on a scrape, library or push failure, and when the set of failing sources changes (once, not every 15 minutes while one stays broken; `~/priors/logs/failing-sources.txt` holds the last set). A failed source keeps its previous rows. The data-live push retries three times, since GitHub occasionally drops it with HTTP 408. It also raises one when the default lineup has no exact fit. Log: `~/priors/logs/scrape.log`.
- **New benchmarks.** A source can report benchmarks its publisher added that Priors does not read yet (`discoveries`; today the AA source). `build.ts` logs each as a `NEW_BENCHMARK` line and the run still succeeds. The job raises one notification per item the first time it appears and records it in `~/priors/logs/announced-benchmarks.txt`; delete a line there to hear about it again.
- **Setting it up again.** `git worktree add --detach ~/priors-scrape origin/main`, `touch ~/priors-scrape/.scrape-checkout`, `npm ci` there, and a `.env.local` holding only `NEXT_PUBLIC_CONVEX_URL` set to the production deployment (the mix library reads the lineups real visitors recorded).

The job pushes to `main` all day, so do feature work in a worktree and expect `main` to move.

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
| `share-hint`, `assistant-mode`, `assistant-hint`, `assistant-size` | Small UI state |
| `assistant-chat:<userId>` | The assistant conversation (last 40 turns, no Undo), so it survives reloads; Clear removes it |
| `resume` | Google account id for silent re-sign-in |

`localStorage`, not `sessionStorage`, for anything that must survive sign-in: the OAuth round trip leaves the origin.
