# Assistant and the agent API

Two separate things: the in-app assistant (questions, charts and changes in plain language), and the HTTP API a user's own agent calls.

## Assistant

Signed-in users talk to the assistant through a round chat button in the bottom-right corner of `/builder` and profile pages (`src/components/MixAssistant.tsx`; `/` opens it). The empty panel is just the composer: its placeholder types out example asks from `HINTS` in a shuffled order that never opens on the last visit's first hint. On desktop the top-left corner drags to resize (arrow keys too; double-click resets). The conversation persists in `localStorage` only, never on our servers; the header's Clear empties it and Save as PDF prints it as a clean page (`assistant-print.ts`: each question and answer, charts as SVG in the light palette, the index link). While it works, each step shows an icon for its kind (`STEP_ICONS`: data, chart, search, compare, solve, highlight, theme) and the live one shimmers. Each answer chart expands over the page with the star highlight menu (it edits the index's highlights; clicking a mark toggles one) and export. It answers questions about the data with embedded charts, changes the active index, highlights models and changes the site theme. Changes apply first with one Undo (mix, highlights and theme together), then it explains; for a vague ask it asks where exactly the user wants things.

- `POST /api/assistant` requires Clerk `auth()`. It takes the index, the conversation and the view (`builder` or a published page, the site theme and mode) and streams NDJSON steps, then one `done` event: the reply, and optionally a proposal (new weights), `charts`, `highlight` and `theme`.
- The loop is `src/agent/agent.ts`, on OpenRouter model `AGENT_MODEL` (`openai/gpt-6-luna`). Verify the id and price live before changing it; `PRICES` there pre-authorizes spend per model.
- Tools (`src/agent/tools.ts`):
  - Data: `query_data` (a table: index score, cost, time, speed, latency, tokens or any benchmark; by model, top N or lab; best effort, all or listed efforts), `make_chart`, `compare_models`, `explain_model`, `find_benchmarks`, `search_benchmarks` (words from the user's work, any word can match, returns each benchmark's description, quality and model coverage; cost, speed and reliability boards are left out).
  - Changes: `solve_edit`, `fit_ranking`, `try_mix`, `propose` (ends the turn; `pin` fixes a share exactly), `highlight`, `set_models` (which models the charts and ranking show: only, hide, show, reset, by name, lab, open or closed weights or top N; rough names are matched and reported; hiding everything is refused; stored as `excludeModels` on the index, applied by the client like a highlight), `set_theme`.
- Data access is `src/agent/data.ts` (`DataView`): index scores from the engine under the user's mix with every effort ranked, benchmark values as published, no estimates. Names resolve in `src/agent/resolve.ts`: a partial model name means the family's best-ranked model, a partial benchmark name prefers the user's mix and the newest version, "Claude" means Anthropic.
- **Charts never come from the model.** `make_chart` (`src/agent/charts.ts`) fills every value from `DataView` and returns a chart number; the reply places it as `[[chart:N]]` on its own line. Kinds: `bar`, `grouped`, `lines`, `scatter` (`src/lib/answer-chart.ts`). The browser draws them with the viewer's chart palette (`AssistantAnswer.tsx`, `chart/answer-option.ts`), so they follow the site theme. Replies are plain text with paragraphs, `- ` lists and `**bold**`; nothing else is interpreted.
- **A mix built from a description of the user's work is chosen by what benchmarks measure, not fitted.** "I mostly fix UI bugs" is not a ranking move, so the prompt forbids `fit_ranking` and `solve_edit` for it: both reproduce a model order and pick benchmarks by statistical fit, which once put a medical-scribe board and a handbook board into a front-end mix. The agent runs `search_benchmarks` per part of the work, reads the descriptions, picks 3 to 8, checks with `try_mix` and calls `propose` with `fresh: true` (the new-entrants guard is for edits, and a new mix is expected to reorder the ranking). A part no benchmark measures is left out and said so. Evals `mix-from-ui-work` and `mix-from-legal-work` hold this.
- Models fill every optional tool field (`top: 0`, `models: []`, `efforts: ["best"]`); the tools treat empty values as unset.
- Try one request offline: `npx tsx scripts/try-assistant.mts "Gemini 4 is too high"`.

### Eval

`npx tsx scripts/assistant-eval/run.mts [--model anthropic/claude-haiku-5.5] [--cases a,b] [--repeat 2] [--budget 3]` runs every case in `scripts/assistant-eval/cases.ts` through the real loop on the pinned snapshot (`EVAL_SNAPSHOT`), with a local spend cap instead of Convex. A case passes when its hard checks hold (right kind of change or none, the right model moved, the right highlights and theme, a chart when one is needed) and the grader (`judge.ts`, Claude Sonnet 5.5) scores the response at least 3 of 5. The grader sees the expected behavior, facts computed live from the data, the data the assistant's tools returned, and what it said and did; it doesn't need a word-for-word match. Results go to `scripts/assistant-eval/results/` (not committed). Run it before changing the prompt, the tools or the model.

22 cases: data questions (effort gaps, cheapest above a score, head-to-head, score vs cost, benchmark leaders, effort scaling, why one model is above another), ranking changes (vague, exact rank, exact share, drop a benchmark plus highlight), view changes (lab highlights, clearing, themes), and edge cases (an unknown model, a model the index doesn't rank, a theme that only comes in dark, a question that must not change anything, off-topic, prompt injection, a follow-up that narrows the last answer).

**Rule: the eval runs on Luna whenever the assistant changes.** `npm run assistant-eval -- --repeat 2` before pushing any change under `src/agent/`, the system prompt, the tool specs, or data the tools read; the command exits non-zero if any run fails. More tools make the model pick the wrong one (adding `set_models` first turned a follow-up chart request into a view change, and the eval caught it), so every new capability ships with cases in `cases.ts` for the plain ask, rough or misspelled names, an impossible ask, a request that sounds similar but is a question, and a multi-step task. When a bug is found in use, add the case that reproduces it before the fix. The cases read a pinned snapshot (`EVAL_SNAPSHOT`); move it forward when a tool starts depending on newer data (it was stuck on 2026-10-14, before the open-weights flag, and eight data questions failed for that reason alone), and keep expectations in `expect` free of numbers: the grader gets the live `facts`.

Results on 2026-10-16 (snapshot 2026-10-16, 36 cases, two runs each): GPT-6 Luna 72/72 (mean grade 4.43, $0.018 for all 72 runs) after two fixes the eval found: the `weights` filter spec now says to leave it empty unless asked (Luna filled in "open" on its own and charts showed two models), and a lab name given to `highlight` expands to that lab's models in the top 10 instead of matching the oldest model with the word. Cases added for `set_models`: select only, dictated and misspelled names, hide a lab, bring one back, show everything, top N, hide nothing, an unknown model, open weights, select plus highlight, select plus chart, and a "just the Claude models" question that must not change the view.

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

## MCP server, CLI and tool API

One registry, `src/mcp/tools.ts`, serves three front doors: the hosted MCP server (`POST /mcp`, `src/app/mcp/route.ts`, hand-rolled Streamable HTTP in stateless JSON mode, `src/mcp/protocol.ts`), a plain HTTP API (`POST /api/tools/<name>`, `GET /api/tools` for the catalog), and the CLI (`public/cli/priors.mjs`, one dependency-free file that calls the HTTP API and also runs as a stdio MCP server with `priors mcp`, which forwards each JSON-RPC line to `/mcp`). The docs page is `/cli` (`src/app/cli/page.tsx`); its tool list is generated from the registry.

- Read tools are public. Tools marked `write` need `Authorization: Bearer pri_...` and go through `profiles.agentApply`, so the token, validators and `storableIndex()` rules are the agent API's. `upsert_index`, `upsert_section` and the other page tools read `whoami` and write the whole field back, so they never touch what they were not asked to change.
- Analysis tools (`get_mix`, `explain_model`, `compare_models`, `find_benchmarks`, `search_benchmarks`, `try_mix`, `solve_edit`, `fit_ranking`, `query_data`, `make_chart`) are the in-app assistant's own tools (`runTool`), run over whatever index the call names, so answers match the site. They compute and never save.
- A fresh agent knows only the server's `instructions` (`src/mcp/protocol.ts`) and the tool descriptions, so those carry how a ranking is made (strictness, release cutoff, older versions left out, cost basis) and which tool answers which question. Keep them current when ranking behavior changes.
- Every ranking tool computes as the site does: `computeIndex(…, { variants: "all" }, PAGE_VIEW)`, then `rankingRows`. `DataView` (`src/agent/data.ts`) applies the same superseded-version rule, so `query_data`, `make_chart`, chart links and the in-app assistant rank the same models as `rank_models` and the Builder; a test checks the two lists match.
- `make_chart` names every model it could not draw under `missing` with the value it lacks (`GPT-5.6 Sol max (no Cost per task)`), for scatters as well as bars, so the assistant never claims a point that is not on the chart.
- Results say who is not ranked and why: `rank_models` and `pareto_frontier` return `settings` and `excluded` (models under the strictness floor or missing a required benchmark, with what they lack); `get_model` returns a `status` naming the reason (strictness, release cutoff, older version, model selection).
- `pareto_frontier` is the site's scatter (`scatterSpec`, `frontierOf`) with every point and the frontier marked, plus the `/og?…&c=` PNG. `make_chart` over MCP returns `image` (`/og?i=…&chart=…`) and `link` in place of the in-app `[[chart:N]]` token. `query_data` over MCP returns up to 200 models (40 in the app) and says when rows are only the top of a longer ranking.
- Reasoning efforts over MCP: `query_data` with a cost, time, speed, latency or tokens metric and `make_chart` scatters default to `efforts: "all"` (each effort its own row or point); `pareto_frontier` points carry `label` (model + effort). Leaderboards stay one row per model.
- `index` (see `src/mcp/index-ref.ts`) is a `@handle` or `@handle/index-id` (that page's imports are merged in), a mypriors.com link, an `i=` value, or an IndexConfig object merged onto the default (a whole `default_index` result is accepted too).
- New tool: add it to `readTools` or `writeTools`, with a schema; the docs page, `/api/tools`, `tools/list` and `priors tools` pick it up. `src/mcp/mcp.test.ts` checks the registry and `scripts/cli.test.ts` the CLI.
- After editing `public/cli/priors.mjs`, bump `VERSION` if behavior changed and run `node scripts/build-cli.mjs`: it repacks `public/cli/priors-cli.tgz` (the `npm i -g` install), and a test fails while the two differ.
- Not exposed: the assistant chat (needs a Clerk session), claiming a handle, image uploads, deleting a page, and removing one imported benchmark (re-importing an id replaces it). The last needs a new `agentApply` action and a Convex deploy.
