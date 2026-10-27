/**
 * EnigmaEval (Scale Labs x CAIS x MIT): 1,184 long-form multimodal puzzles from puzzle hunts, exact
 * string answers, accuracy over three runs. Private test set. Entries are inlined in the Scale page's
 * RSC payload as slugs such as "claude-fable-5-high" (model + effort).
 */
import type { RawRow, ScrapeResult, Source } from "../../../src/data/types";
import { extractKeyed, rscText } from "./_rsc";

const PAGE = "https://labs.scale.com/leaderboard/enigma_eval";
type Entry = { model: string; score: number; confidenceInterval_upper?: number; company?: string; deprecated?: boolean };
const SLUG_EFFORT = /^(.*?)-(none|minimal|low|medium|high|xhigh|max)$/;

export function parseEnigmaEval(html: string): RawRow[] {
  const list = extractKeyed<Entry[]>(rscText(html), "entries").find((l) => Array.isArray(l) && l.some((e) => typeof e?.score === "number" && typeof e?.model === "string"));
  if (!list) throw new Error("EnigmaEval page has no leaderboard entries");
  const rows: RawRow[] = [];
  for (const e of list) {
    if (e.deprecated || !Number.isFinite(e.score)) continue;
    const m = e.model.trim().match(SLUG_EFFORT);
    const slug = (m ? m[1] : e.model.trim()).replace(/-+$/, "");
    const ciHalf = e.confidenceInterval_upper;
    rows.push({
      benchmarkId: "enigmaeval", modelLabel: slug, effort: m?.[2], value: e.score,
      ci: ciHalf != null ? [e.score - ciHalf, e.score + ciHalf] : undefined,
      sourceUrl: PAGE, labHint: e.company, note: e.model,
    });
  }
  return rows;
}

const source: Source = {
  id: "enigmaeval", name: "EnigmaEval", url: PAGE,
  async scrape(ctx): Promise<ScrapeResult> {
    const html = await ctx.fetchText(PAGE);
    const rows = parseEnigmaEval(html);
    if (!rows.length) throw new Error("EnigmaEval returned no rows");
    return {
      benchmarks: [{
        id: "enigmaeval", name: "EnigmaEval", sourceId: "enigmaeval", url: PAGE,
        description: "1,184 long-form multimodal puzzles from puzzle hunts such as the MIT Mystery Hunt, graded by exact string match; accuracy over three runs. Private test set (Scale Labs, CAIS, MIT).",
        normalization: { kind: "linear", min: 0, max: 100 },
        unit: "percent", higherIsBetter: true, category: "reasoning", eligibleForDefault: false, defaultWeight: 0,
      }],
      rows, raw: { "enigma_eval.html": html }, notes: [`${rows.length} rows`],
    };
  },
};
export default source;
