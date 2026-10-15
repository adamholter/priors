# Assistant and the agent API

Two separate things: the in-app assistant (questions, charts and changes in plain language), and the HTTP API a user's own agent calls.

## Assistant

Signed-in users talk to the assistant through a round chat button in the bottom-right corner of `/builder` and profile pages (`src/components/MixAssistant.tsx`; `/` opens it). The empty panel is just the composer: its placeholder types out example asks from `HINTS` in a shuffled order that never opens on the last visit's first hint. On desktop the top-left corner drags to resize (arrow keys too; double-click resets). The conversation persists in `localStorage` only, never on our servers; the header's Clear empties it and Save as PDF prints it as a clean page (`assistant-print.ts`: each question and answer, charts as SVG in the light palette, the index link). While it works, each step shows an icon for its kind (`STEP_ICONS`: data, chart, search, compare, solve, highlight, theme) and the live one shimmers. Each answer chart expands over the page with the star highlight menu (it edits the index's highlights; clicking a mark toggles one) and export. It answers questions about the data with embedded charts, changes the active index, highlights models and changes the site theme. Changes apply first with one Undo (mix, highlights and theme together), then it explains; for a vague ask it asks where exactly the user wants things.

- `POST /api/assistant` requires Clerk `auth()`. It takes the index, the conversation and the view (`builder` or a published page, the site theme and mode) and streams NDJSON steps, then one `done` event: the reply, and optionally a proposal (new weights), `charts`, `highlight` and `theme`.
- The loop is `src/agent/agent.ts`, on OpenRouter model `AGENT_MODEL` (`openai/gpt-6-luna`). Verify the id and price live before changing it; `PRICES` there pre-authorizes spend per model.
- Tools (`src/agent/tools.ts`):
  - Data: `query_data` (a table: index score, cost, time, speed, latency, tokens or any benchmark; by model, top N or lab; best effort, all or listed efforts), `make_chart`, `compare_models`, `explain_model`, `find_benchmarks`, `search_benchmarks`.
  - Changes: `solve_edit`, `fit_ranking`, `try_mix`, `propose` (ends the turn; `pin` fixes a share exactly), `highlight`, `set_theme`.
- Data access is `src/agent/data.ts` (`DataView`): index scores from the engine under the user's mix with every effort ranked, benchmark values as published, no estimates. Names resolve in `src/agent/resolve.ts`: a partial model name means the family's best-ranked model, a partial benchmark name prefers the user's mix and the newest version, "Claude" means Anthropic.
- **Charts never come from the model.** `make_chart` (`src/agent/charts.ts`) fills every value from `DataView` and returns a chart number; the reply places it as `[[chart:N]]` on its own line. Kinds: `bar`, `grouped`, `lines`, `scatter` (`src/lib/answer-chart.ts`). The browser draws them with the viewer's chart palette (`AssistantAnswer.tsx`, `chart/answer-option.ts`), so they follow the site theme. Replies are plain text with paragraphs, `- ` lists and `**bold**`; nothing else is interpreted.
- Models fill every optional tool field (`top: 0`, `models: []`, `efforts: ["best"]`); the tools treat empty values as unset.
- Try one request offline: `npx tsx scripts/try-assistant.mts "Gemini 4 is too high"`.

### Eval

`npx tsx scripts/assistant-eval/run.mts [--model anthropic/claude-haiku-5.5] [--cases a,b] [--repeat 2] [--budget 3]` runs every case in `scripts/assistant-eval/cases.ts` through the real loop on the pinned snapshot (`EVAL_SNAPSHOT`), with a local spend cap instead of Convex. A case passes when its hard checks hold (right kind of change or none, the right model moved, the right highlights and theme, a chart when one is needed) and the grader (`judge.ts`, Claude Sonnet 5.5) scores the response at least 3 of 5. The grader sees the expected behavior, facts computed live from the data, the data the assistant's tools returned, and what it said and did; it doesn't need a word-for-word match. Results go to `scripts/assistant-eval/results/` (not committed). Run it before changing the prompt, the tools or the model.

22 cases: data questions (effort gaps, cheapest above a score, head-to-head, score vs cost, benchmark leaders, effort scaling, why one model is above another), ranking changes (vague, exact rank, exact share, drop a benchmark plus highlight), view changes (lab highlights, clearing, themes), and edge cases (an unknown model, a model the index doesn't rank, a theme that only comes in dark, a question that must not change anything, off-topic, prompt injection, a follow-up that narrows the last answer).

Results on 2026-10-14, two runs per case: GPT-6 Luna 44/44 (mean grade 4.25, $0.007 for all 44 runs); Claude Haiku 5.5 39/44 (mean 3.95, $0.067). Haiku misses data it didn't ask for (one effort instead of all), misorders runners-up and once proposed a ranking change that didn't reach the requested rank. On 2026-10-15, after asking for one chart per part of a multi-part question, GPT-6 Luna passed 44/44 (mean 4.27).

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
