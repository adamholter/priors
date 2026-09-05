/**
 * Source template. Copy to `<id>.ts`, export default a Source.
 * Rules:
 *  - Discover rows live; never hardcode leaderboard rows.
 *  - Prefer structured payloads (JSON/CSV/RSC/__NEXT_DATA__) over DOM scraping; fall back to ctx.withPage.
 *  - Emit the model label exactly as the site shows it; put a separate effort in `effort` if the site shows one.
 *  - Put measured per-task cost in `costUsd` only if the site reports run cost (not token price).
 *  - Save every raw payload you parsed into `raw` so the run is auditable / re-parseable.
 *  - One logical benchmark per source unless the site truly publishes distinct benchmarks.
 */
import type { Source, ScrapeResult } from "../../../src/data/types";
import { num, ci } from "../harness";

const source: Source = {
  id: "example",
  name: "Example Bench",
  url: "https://example.com/leaderboard",
  async scrape(ctx): Promise<ScrapeResult> {
    const html = await ctx.fetchText(this.url);
    const raw: Record<string, string> = { "page.html": html };
    // ... locate payload, parse rows
    const rows = [] as ScrapeResult["rows"];
    void num; void ci;
    return {
      benchmarks: [{
        id: "example", name: "Example Bench", sourceId: this.id, url: this.url,
        description: "What it measures, in one or two sentences.",
        unit: "percent", higherIsBetter: true, category: "coding", eligibleForDefault: true, defaultWeight: 10,
      }],
      rows, raw,
    };
  },
};
export default source;
