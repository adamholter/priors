/**
 * RSI-Infra Bench (AI4AI / DAGroup-PKU, Preview released 2026-11-17): can a coding agent make real training jobs run faster in 10 hours of
 * wall-clock time without changing what they compute? Eight tasks from public repos (LLaVA, YOCO, NanoChat, BAGEL SFT, R3, 3DGS, Slime GRPO,
 * Slime OPD) on 1-4 Hopper GPUs, one run per model and task. A task scores ln(speedup) / ln(best speedup on that task); the overall score is an
 * Epoch Capabilities Index fit over every model and task, pinned at Claude Opus 5.5 = 40 and Kimi K3.1 Pro = 10, so scores move as models join.
 * The leaderboard page is a static table (`#board`): one row per model with its harness and each task's final speedup.
 */
import type { Benchmark, RawRow, ScrapeResult, Source } from "../../../src/data/types";

export const RSI_INFRA_ID = "rsi-infra-bench";
const BLOG = "https://ai4ai-for-anything.github.io/blog/rsi-infra-bench/";
export const RSI_INFRA_BOARD = `${BLOG}leaderboard/`;

const text = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();

export function parseRsiInfra(html: string): { rows: RawRow[]; benchmark: Benchmark; tasks: string[] } {
  const table = /<table id=["']?board["']?[^>]*>([\s\S]*?)<\/table>/.exec(html)?.[1];
  if (!table) throw new Error("RSI-Infra Bench: no #board table; page changed?");
  const head = /<thead>([\s\S]*?)<\/thead>/.exec(table)?.[1] ?? "";
  const tasks = [...head.matchAll(/<th[^>]*class=["']?tk[^>]*>([\s\S]*?)<\/th>/g)].map((m) => text(m[1]));
  if (tasks.length < 4) throw new Error(`RSI-Infra Bench: ${tasks.length} task columns; page changed?`);
  const rows: RawRow[] = [];
  for (const [, tr] of table.matchAll(/<tr class=["']?m\d+["']?>([\s\S]*?)<\/tr>/g)) {
    const model = /class=["']?mfull["']?>([^<]*)</.exec(tr)?.[1], harness = /class=["']?hn["']?>([^<]*)</.exec(tr)?.[1], lab = /class=["']?mo["']?>([^<·]*)/.exec(tr)?.[1];
    const score = Number(/class=["']?scv["']?>([^<]*)</.exec(tr)?.[1]);
    if (!model || !Number.isFinite(score)) throw new Error("RSI-Infra Bench: a row without a model or score; page changed?");
    const cells = [...tr.matchAll(/<td class=['"]tk[^>]*>([\s\S]*?)<\/td>/g)].map((m) => Number(/:\s*([\d.]+)×/.exec(m[1])?.[1] ?? text(m[1]).replace(/×/, "")));
    const speedups = Object.fromEntries(tasks.map((t, i) => [t, Number.isFinite(cells[i]) ? cells[i] : null]));
    const nerf = /suspected nerf/i.test(tr);
    rows.push({
      benchmarkId: RSI_INFRA_ID, modelLabel: text(model), value: score, labHint: lab?.trim(), harness: harness && text(harness), sourceUrl: RSI_INFRA_BOARD,
      note: `ECI fit over ${tasks.length} tasks, one 10-hour run each, in ${harness ? text(harness) : "its harness"}${nerf ? "; the authors suspect this model was degraded during their runs" : ""}`,
      details: { speedups },
    });
  }
  const benchmark: Benchmark = {
    id: RSI_INFRA_ID, sourceId: "rsi-infra-bench", name: "RSI-Infra Bench", shortName: "RSI-Infra", url: RSI_INFRA_BOARD, unit: "score", higherIsBetter: true,
    category: "science", categories: ["science", "coding", "agentic"], normalization: { kind: "linear", min: 0, max: 50 }, eligibleForDefault: false, defaultWeight: 0,
    description: `Can an agent make real training jobs run faster in 10 hours without changing what they compute? ${tasks.length} tasks from LLM, multimodal, pretraining and RL code on Hopper GPUs. An index fitted over every model and task, with Claude Opus 5.5 at 40 and Kimi K3.1 Pro at 10.`,
  };
  return { rows, benchmark, tasks };
}

const source: Source = {
  id: "rsi-infra-bench", name: "RSI-Infra Bench", url: RSI_INFRA_BOARD,
  async scrape(ctx): Promise<ScrapeResult> {
    const html = await ctx.fetchText(RSI_INFRA_BOARD), { rows, benchmark, tasks } = parseRsiInfra(html);
    if (rows.length < 5) throw new Error(`RSI-Infra Bench: ${rows.length} models`);
    return { benchmarks: [benchmark], rows, raw: { "leaderboard.html": html }, notes: [`${rows.length} models over ${tasks.length} tasks`] };
  },
};
export default source;
