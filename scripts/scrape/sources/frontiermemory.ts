/**
 * FrontierMemory (frontiermemory.com), Letta's continual-learning benchmark. A model reads trajectories of past agent work and
 * writes memory (Letta Dream harness, highest effort); a task agent (Letta Code) then solves new tasks with that memory, and the
 * score is the share it solves, mean of 3 runs. The site's model table ranks memory models, each at its best task-agent setting
 * (Opus 5.5 max for most; the row names it). The table is server-rendered: one `<tr data-dream-model>` per memory model in
 * `table.unified-leaderboard`. The task cost covers the task agent's runs too, so it is kept in details, never as the model's cost.
 */
import type { RawRow, ScrapeResult, Source } from "../../../src/data/types";

export const FRONTIERMEMORY_ID = "frontiermemory";
const SITE = "https://frontiermemory.com/";
const attr = (html: string, name: string) => new RegExp(`${name}="([^"]*)"`).exec(html)?.[1];
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

export function parseFrontierMemory(html: string): Pick<ScrapeResult, "benchmarks" | "rows" | "notes"> {
  const start = html.indexOf("unified-leaderboard");
  if (start < 0) throw new Error("FrontierMemory: model table not found");
  const table = html.slice(start, html.indexOf("</table>", start));
  const rows: RawRow[] = [];
  for (const m of table.matchAll(/<tr data-harness="([^"]*)" data-dream-model="([^"]*)">([\s\S]*?)<\/tr>/g)) {
    const [, harness, label, cells] = m;
    const effort = /lb-effort">\[([^\]]+)\]/.exec(cells)?.[1];
    const at = Number(attr(cells, "data-tip-at"));
    if (!label || !Number.isFinite(at) || at < 0 || at > 100) continue;
    const aria = /aria-label="Mean [\d.]+%, ±?([\d.]+) percentage points SD, n=(\d+)"/.exec(cells);
    const cost = /\$([\d.]+)/.exec(cells.slice(cells.lastIndexOf("<td")))?.[1];
    const taskModel = decode(attr(cells, "data-tip-task") ?? "");
    const taskHarness = decode(attr(cells, "data-tip-meta") ?? "").replace(/^Task harness:\s*/, "");
    rows.push({
      benchmarkId: FRONTIERMEMORY_ID, modelLabel: decode(label), effort, value: Math.round(at * 100) / 100, sourceUrl: SITE, harness: decode(harness),
      note: `memory written in ${decode(harness)}; task agent ${taskModel || "?"}${taskHarness ? ` in ${taskHarness}` : ""}${aria ? `; ±${aria[1]} pts SD over ${aria[2]} runs` : ""}${cost ? `; $${cost} per task, task agent included` : ""}`,
      details: { taskModel, taskHarness, ...(aria ? { sdPts: Number(aria[1]), runs: Number(aria[2]) } : {}), ...(cost ? { taskCostUsd: Number(cost) } : {}) },
    });
  }
  if (rows.length < 5) throw new Error(`FrontierMemory: ${rows.length} rows; page changed?`);
  const version = /v(\d+(?:\.\d+)*) corpus/.exec(html)?.[1];
  return {
    benchmarks: [{
      id: FRONTIERMEMORY_ID, name: `FrontierMemory${version ? ` v${version}` : ""}`, shortName: "FrontierMemory", sourceId: FRONTIERMEMORY_ID, url: SITE,
      description: "How useful the memory a model writes is: it reads trajectories of past agent work and writes memory, then a task agent (Letta Code, mostly Opus 5.5 at max) solves new tasks with that memory. Score is the share of tasks solved, mean of 3 runs, with the model at its best task-agent setting. From Letta.",
      unit: "percent", higherIsBetter: true, category: "agentic", normalization: { kind: "linear", min: 0, max: 100 },
      eligibleForDefault: false, defaultWeight: 0, ...(version ? { version } : {}),
    }],
    rows,
    notes: [`${rows.length} memory models${version ? `, v${version}` : ""}`],
  };
}

const source: Source = {
  id: FRONTIERMEMORY_ID, name: "FrontierMemory", url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const html = await ctx.fetchText(SITE);
    return { ...parseFrontierMemory(html), raw: { "index.html": html } };
  },
};
export default source;
