/**
 * Company Agent Bench (companyagentbench.com, Phil Chen and Josh Qin, November 12, 2026): 205 questions from a month of a
 * real company's Slack (who wrote a message, who was tagged, who wrote each reply). Agent products (Dots, Grok Bot, Claude
 * Tag, Devin) and API models with a simple Slack harness both ran it; only the API models are models, so only they are read.
 * The page is static; its cost chart's aria-label spells out every API model at each effort:
 *   "GPT-6 Astra: low 76.7% at $0.200 per question, medium 81.1% at $0.318 per question, high 80.8% at $0.557 per question; ..."
 */
import type { Benchmark, RawRow, Source } from "../../../src/data/types";

const PAGE = "https://companyagentbench.com";

/** Claude models are written without the family. */
const label = (name: string) => (/^(Fable|Opus|Sonnet|Haiku)\b/.test(name) ? `Claude ${name}` : name);

export function parseCompanyAgentBench(html: string): { benchmark: Benchmark; rows: RawRow[] } {
  const chart = html.match(/aria-label="(Accuracy across all (\d+) questions against cost per question[^"]*)"/);
  if (!chart) throw new Error("Company Agent Bench: cost chart label missing");
  const questions = Number(chart[2]);
  // The models start after the products' sentence.
  const models = chart[1].replace(/^[\s\S]*?Devin [\d.]+%\.\s*/, "");
  const rows: RawRow[] = [];
  for (const part of models.split(/;\s*/)) {
    const m = part.match(/^([^:]+):\s*(.+)$/);
    if (!m) continue;
    for (const e of m[2].matchAll(/\b(minimal|low|medium|high|xhigh|max) ([\d.]+)% at \$([\d.]+) per question/g)) {
      rows.push({
        benchmarkId: "company-agent-bench", modelLabel: label(m[1].trim()), effort: e[1], value: Number(e[2]), costUsd: Number(e[3]), sourceUrl: PAGE,
        note: "API model with the benchmark's simple Slack harness (native search and reading tools)",
      });
    }
  }
  if (rows.length < 9) throw new Error(`Company Agent Bench: parsed only ${rows.length} rows`);
  return {
    benchmark: {
      id: "company-agent-bench", name: "Company Agent Bench", shortName: "Company Agent", sourceId: "company-agent-bench", url: PAGE,
      description: `${questions} questions from a month of a real company's Slack: who wrote a message, who was tagged, and who wrote each reply. API models with a simple Slack harness; share answered correctly.`,
      unit: "percent", higherIsBetter: true, category: "agentic", categories: ["agentic", "professional"],
      normalization: { kind: "linear", min: 0, max: 100 }, eligibleForDefault: false, defaultWeight: 0,
    },
    rows,
  };
}

const source: Source = {
  id: "company-agent-bench", name: "Company Agent Bench", url: PAGE,
  async scrape(ctx) {
    const html = await ctx.fetchText(PAGE);
    const { benchmark, rows } = parseCompanyAgentBench(html);
    return { benchmarks: [benchmark], rows, raw: { "page.html": html }, notes: [`${rows.length} model and effort rows`] };
  },
};
export default source;
