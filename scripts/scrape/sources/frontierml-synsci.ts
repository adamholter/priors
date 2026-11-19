/**
 * FrontierML (Synthetic Sciences, frontierml.ai): open-ended ML research problems. An agent works twelve hours in a virtual lab and is graded
 * on protected data, where 0 is the task's starting reference and 1 a strong result set by judgment. Not the Induction Labs benchmark of the
 * same name (`bg-frontierml`, frontierml.org). The page is server-rendered: each leaderboard row shows its mean over the graded tasks, and the
 * mean marker's position carries the exact value, which must match the shown mean. A model scored on only some tasks (Grok 4.7 ran only the
 * public ones) is left out, since its mean covers different tasks. The site states no reasoning effort.
 */
import type { RawRow, ScrapeResult, Source } from "../../../src/data/types";
import { text } from "./_board";

export const FRONTIERML_SYNSCI_ID = "frontierml-synsci";
const SITE = "https://frontierml.ai/";

export function parseFrontierML(html: string): { rows: RawRow[]; tasks: number; partial: string[] } {
  const tasks = Number(html.match(/mean normalized score over the (\d+) graded tasks/)?.[1]);
  if (!tasks) throw new Error("FrontierML: no task count");
  const rows: RawRow[] = [], partial: string[] = [];
  for (const r of html.split('<div class="bd-row bd-r">').slice(1)) {
    const name = text(r.match(/<b>([\s\S]*?)<\/b>/)?.[1] ?? ""), exact = Number(r.match(/class="bd-tick" style="left:calc\(5px \+ (-?[\d.]+) \*/)?.[1]);
    const mean = r.match(/<span class="bd-mean"[^>]*>(-?[\d.]+)(<i aria-label="over (\d+) of the (\d+) tasks">)?/);
    if (!name || !mean || !Number.isFinite(exact) || Math.abs(exact - Number(mean[1])) > 0.0006) throw new Error(`FrontierML: row changed at ${name || "?"}`);
    if (mean[2]) { partial.push(`${name} (${mean[3]} of ${mean[4]} tasks)`); continue; }
    rows.push({ benchmarkId: FRONTIERML_SYNSCI_ID, modelLabel: name, effortUnstated: true, value: +(exact * 100).toFixed(2), sourceUrl: SITE, note: `Mean normalized score over all ${tasks} graded tasks, public and private`, details: { score: +exact.toFixed(4) } });
  }
  return { rows, tasks, partial };
}

const source: Source = {
  id: FRONTIERML_SYNSCI_ID, name: "FrontierML (Synthetic Sciences)", url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const html = await ctx.fetchText(SITE), { rows, tasks, partial } = parseFrontierML(html);
    if (rows.length < 4) throw new Error(`FrontierML: only ${rows.length} models`);
    return {
      benchmarks: [{
        id: FRONTIERML_SYNSCI_ID, name: "FrontierML (Synthetic Sciences)", shortName: "FrontierML SynSci", sourceId: FRONTIERML_SYNSCI_ID, url: SITE, unit: "percent", higherIsBetter: true, category: "science", categories: ["science", "coding", "agentic"],
        normalization: { kind: "linear", min: 0, max: 100 }, eligibleForDefault: false, defaultWeight: 0,
        description: `${tasks} open-ended ML research problems, each worked for twelve hours in a virtual lab and graded on protected data. Mean score where 0 is the starting reference and 100 a strong result no run has reached.`,
      }],
      rows, raw: { "index.html": html }, notes: [`${rows.length} models over ${tasks} tasks${partial.length ? `; left out ${partial.join(", ")}` : ""}`],
    };
  },
};
export default source;
