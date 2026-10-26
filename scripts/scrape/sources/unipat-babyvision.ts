/** UniPat AI's BabyVision leaderboard: visual reasoning a 3-year-old manages (388 items, 22 task types). Tool-assisted runs are their own board. */
import type { RawRow, Source } from "../../../src/data/types";
import { splitLabel, text } from "./_board";

const PAGE = "https://unipat.ai/benchmarks/BabyVision";
export const BABYVISION_ID = "babyvision", BABYVISION_TOOLS_ID = "babyvision-tools";

export function parseBabyVision(html: string): RawRow[] {
  const rows: RawRow[] = [];
  for (const m of html.matchAll(/<tr>\s*<td class="bv-lb-rank[^"]*">\d+<\/td>\s*<td class="bv-lb-model-name">([\s\S]*?)<\/td>\s*<td>[^<]*<\/td>\s*<td>([^<]*)<\/td>\s*<td>[^<]*<\/td>\s*<td class="bv-lb-score">([\d.]+)%<\/td>/g)) {
    const { label, effort, tools } = splitLabel(text(m[1])), value = Number(m[3]);
    if (!label || !Number.isFinite(value)) continue;
    rows.push({ benchmarkId: tools ? BABYVISION_TOOLS_ID : BABYVISION_ID, modelLabel: label, effort, value, labHint: m[2].trim(), sourceUrl: PAGE, note: text(m[1]) });
  }
  if (!rows.length) throw new Error("BabyVision page had no leaderboard rows");
  return rows;
}

const base = { unit: "percent" as const, higherIsBetter: true, category: "reasoning" as const, normalization: { kind: "linear" as const, min: 0, max: 100 }, eligibleForDefault: true, defaultWeight: 0, url: PAGE, sourceId: "unipat-babyvision" };
const source: Source = {
  id: "unipat-babyvision", name: "UniPat BabyVision", url: PAGE,
  async scrape(ctx) {
    const html = await ctx.fetchText(PAGE);
    const rows = parseBabyVision(html);
    return {
      benchmarks: [
        { ...base, id: BABYVISION_ID, name: "BabyVision", description: "UniPat AI's visual-reasoning test of basic perception a young child handles (tracking, pattern completion, visual puzzles): 388 items, 22 task types. Accuracy without tools; humans score 94.1%." },
        { ...base, id: BABYVISION_TOOLS_ID, name: "BabyVision (with tools)", shortName: "BabyVision tools", description: "BabyVision with image and Python tools available to the model. Accuracy." },
      ].filter((b) => rows.some((r) => r.benchmarkId === b.id)),
      rows, raw: { "babyvision.html": html }, notes: [`${rows.length} results`],
    };
  },
};
export default source;
