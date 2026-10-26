/**
 * SimpleBench (AI Explained). Static site; the leaderboard table is rendered from
 * `static/js/leaderboard-data.js` (a `const leaderboardData = [{...}, ...]` literal), discovered from the HTML.
 * Human baseline rows (rank "-") are skipped.
 */
import type { Source, ScrapeResult, RawRow } from "../../../src/data/types";
import { num } from "../harness";

const SITE = "https://simple-bench.com/";

const source: Source = {
  id: "simplebench",
  name: "SimpleBench",
  url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const html = await ctx.fetchText(SITE);
    const raw: Record<string, string> = { "page.html": html };
    const scriptRel = html.match(/src="([^"]*leaderboard-data\.js[^"]*)"/)?.[1] ?? "static/js/leaderboard-data.js";
    const scriptUrl = new URL(scriptRel, SITE).toString();
    const js = await ctx.fetchText(scriptUrl);
    raw["leaderboard-data.js"] = js;

    const block = js.match(/const\s+leaderboardData\s*=\s*\[([\s\S]*?)\n\];/)?.[1];
    if (!block) throw new Error("SimpleBench: leaderboardData literal not found");
    const rows: RawRow[] = [];
    let skipped = 0;
    for (const m of block.matchAll(/\{([^}]*)\}/g)) {
      const body = m[1];
      const field = (k: string) => body.match(new RegExp(`\\b${k}\\s*:\\s*(?:"([^"]*)"|'([^']*)'|(null|[\\d.-]+))`))?.slice(1).find((x) => x != null);
      const model = field("model"), score = field("score"), rank = field("rank"), org = field("organization"), added = field("dateAdded");
      if (!model || score == null) continue;
      if (/human/i.test(model) || /\*$/.test(model)) { skipped++; continue; }
      const v = num(score);
      if (v == null) continue;
      rows.push({
        benchmarkId: "simplebench",
        modelLabel: model,
        value: v,
        rank: rank ? num(rank.replace(/(st|nd|rd|th)$/, "")) : undefined,
        sourceUrl: SITE,
        labHint: org || undefined,
        releaseDateHint: added && added !== "null" ? added : undefined,
      });
    }
    return {
      benchmarks: [{
        id: "simplebench", name: "SimpleBench", sourceId: this.id, url: SITE,
        description: "200+ multiple-choice questions on spatio-temporal reasoning, social intelligence and adversarial trick questions where unspecialized humans outperform frontier models; accuracy averaged over 5 runs.",
        unit: "percent", higherIsBetter: true, category: "reasoning", eligibleForDefault: true, defaultWeight: 5,
      }],
      rows, raw,
      notes: [`${rows.length} rows; ${skipped} human baseline rows skipped`],
    };
  },
};
export default source;
