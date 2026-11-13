/**
 * Config-only boards: a leaderboard one of the generic readers (`readers.ts`) can read needs only an entry here, plus its
 * catalog entry in `src/data/catalog/`. `npm run board:try -- <url>` finds the reader and options and prints a ready entry.
 * Each entry runs as its own source (`sources/boards.ts`), so one broken page fails only its own board.
 */
import type { BoardConfig } from "./run";

/** Anthropic's models written without the family ("Fable 5.2"). */
const CLAUDE = { prefix: "Claude ", when: /^(Fable|Opus|Sonnet|Haiku)\b/ };

export const BOARDS: BoardConfig[] = [
  {
    // Phil Chen and Josh Qin, November 12, 2026. Agent products (Dots, Grok Bot, Claude Tag, Devin) ran it too; they are not models, so only the
    // API models in the cost chart are read. That chart's label spells out each model at each effort with its cost per question.
    id: "company-agent-bench", name: "Company Agent Bench", shortName: "Company Agent", url: "https://companyagentbench.com",
    reader: "ariaLabel", match: /^Accuracy across all \d+ questions against cost per question/, after: /agent products:.*?%\.\s/,
    unit: "percent", higherIsBetter: true, category: "agentic", categories: ["agentic", "professional"], normalization: { kind: "linear", min: 0, max: 100 }, minRows: 9,
    description: "205 questions from a month of a real company's Slack: who wrote a message, who was tagged, and who wrote each reply. API models with a simple Slack harness; share answered correctly.",
    labelPrefix: CLAUDE, note: "API model with the benchmark's simple Slack harness (native search and reading tools)",
  },
  {
    // Mercor's APEX page ships every board it runs in __NEXT_DATA__; OpenWorldEngineer launched November 12, 2026. Headline is Mean@8 with
    // a 95% interval across tasks (`error` is the half-width). Mercor names Reflection's Beam 1.0 just "Beam".
    id: "owe-bench", sourceId: "mercor-apex", name: "OpenWorldEngineer (OWE-Bench)", shortName: "OWE-Bench", url: "https://openworldengineer.mercor.com", fetch: "https://www.mercor.com/apex/",
    reader: "nextData", rows: "props.pageProps.benchmarks[leaderboardKey=open-world-engineer-leaderboard].globalLeaderboard",
    label: "model.modelName", value: "passScores[pass=mean-8].score", ciHalf: "passScores[pass=mean-8].error", effort: "model.effort",
    details: { mercorModelId: "model.modelId", "best-8": "passScores[pass=best-8].score", elo: "passScores[pass=elo].score" },
    unit: "percent", higherIsBetter: true, category: "agentic", categories: ["agentic", "coding", "science"], normalization: { kind: "linear", min: 0, max: 100 }, minRows: 8,
    description: "26 long-horizon engineering projects built by domain experts, from GPU kernels to aircraft design. Each attempt is scored by how far it moves the project from its baseline (0%) toward the task's ceiling (100%) on held-out cases. Mean of 8 attempts per task.",
    labelPrefix: CLAUDE, labelMap: { Beam: "Beam 1.0" },
  },
];
