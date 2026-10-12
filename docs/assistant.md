# Mix assistant and the agent API

Two separate things: the in-app assistant that edits an index in plain language, and the HTTP API a user's own agent calls.

## Mix assistant

Signed-in users adjust the active index from a composer bar on `/builder` and profile pages (`src/components/MixAssistant.tsx`; `/` focuses it; it can dock as a right panel). It acts first, applying the change with Undo, then explains. For a vague ask it asks where exactly the user wants things.

- `POST /api/assistant` requires Clerk `auth()`. It streams NDJSON steps, then a proposal.
- The loop is `src/agent/agent.ts`, on OpenRouter model `AGENT_MODEL` (`openai/gpt-6-luna`). Verify the id and price live before changing it.
- Tools (`src/agent/tools.ts`): `get_mix`, `explain_model`, `find_benchmarks`, `search_benchmarks`, `solve_edit`, `fit_ranking` (the onboarding fitter), `try_mix`, `propose`.
- Try it offline: `npx tsx scripts/try-assistant.mts "Gemini 4 is too high"`.

### Edit solver

`src/agent/solver.ts` finds the smallest change to the mix that satisfies the requested moves.

- Moves are pairwise against models from the original order, so a newly ranked model cannot satisfy a "drop".
- It minimizes weight moved, rank churn (new top-20 entrants are penalized) and mix complexity (few benchmarks, even shares, a soft 5 to 40% band; never hard caps).
- A fast surrogate (single-benchmark engine columns) screens candidates; the exact engine verifies.
- Excluding a benchmark excludes its mirrors and versions (`withFamilies`).
- Auto-adds skip price, speed, arena, vision and creative boards.

### Spend safety

- `convex/agentBudget.ts` enforces a hard daily USD cap (`AGENT_DAILY_USD_CAP`, default 3) and a per-user daily request limit (`AGENT_USER_DAILY_REQUESTS`, default 40), transactionally. Every model call reserves its worst case first and settles with OpenRouter's reported cost.
- The budget mutations require `AGENT_SERVER_SECRET` (set in Convex dev and prod and in Vercel; never sent to the client).
- `OPENROUTER_API_KEY` lives only in Vercel and `.env.local`. OpenRouter is called server-side only.

## Agent API and skill

A user's own agent edits their page through `POST /api/agent` with `Authorization: Bearer pri_...` and `{ action, payload }`. Actions: `whoami`, `import`, `indices`, `page`. The route validates imports with `importSchema` and hands everything to `profiles.agentApply` in Convex, which checks the token hash.

- The token is minted on the owner's page under Page settings, Agent access. Only its hash is stored.
- `public/skill/SKILL.md` is the skill users give their agent, served at `/skill`. It is user-facing: keep it in step with the API.
- `GET /api/benchmarks` lists benchmark ids and model coverage for agents.
