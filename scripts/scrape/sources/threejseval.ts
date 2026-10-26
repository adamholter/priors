/**
 * threejseval (threejseval.com). Coding models build a Three.js scene from the same prompt and
 * humans vote blind on pairs of finished scenes. Votes are fitted with an order-independent
 * Bradley-Terry model and put on an Elo scale (base 1500, scale 400); the overall rating is the mean
 * across prompts with enough votes. The ranking page reads a public JSON API (`/api/ranking`).
 * Cost is the site's estimate (recorded token usage at published rates), so it stays in details and
 * never becomes a measured `costUsd`. Labels carry the effort ("Opus 5.5 High").
 */
import type { Source, ScrapeResult, RawRow } from "../../../src/data/types";

const SITE = "https://threejseval.com/ranking";
const API = "https://threejseval.com/api/ranking";

type Row = { rank?: number; modelId?: string; label?: string; rating?: number; costUsd?: number | null; totalTokens?: number | null; battles?: number; released?: string };
type Payload = { computedAt?: string; allVotes?: number; models?: Row[]; prompts?: { countsTowardOverall?: boolean }[] };

const source: Source = {
  id: "threejseval",
  name: "threejseval",
  url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const json = await ctx.fetchJson(API) as Payload;
    const list = Array.isArray(json.models) ? json.models : [];
    if (!list.length) throw new Error("threejseval: empty ranking");
    const rows: RawRow[] = [];
    for (const r of list) {
      if (typeof r.rating !== "number" || !Number.isFinite(r.rating) || !r.label) continue;
      rows.push({
        benchmarkId: "threejseval", modelLabel: r.label, value: r.rating, rank: r.rank, sourceUrl: SITE, sourceModelId: r.modelId,
        note: `${r.battles ?? 0} battles · id ${r.modelId ?? "?"}`,
        details: { battles: r.battles, averageCostUsd: r.costUsd ?? undefined, costEstimated: true, tokensPerEval: r.totalTokens ?? undefined, released: r.released },
      });
    }
    if (!rows.length) throw new Error("threejseval: no rated models");
    const prompts = json.prompts?.filter((p) => p.countsTowardOverall).length;
    return {
      benchmarks: [{
        id: "threejseval", name: "threejseval", sourceId: this.id, url: SITE,
        description: "Coding models build a Three.js scene from the same prompt; humans vote blind on pairs of finished scenes. Value is Bradley-Terry Elo (base 1500), the mean across prompts.",
        lastUpdated: json.computedAt?.slice(0, 10),
        unit: "elo" as const, higherIsBetter: true, category: "creative" as const, eligibleForDefault: false, defaultWeight: 0,
      }],
      rows,
      raw: { "ranking.json": JSON.stringify(json) },
      notes: [`${rows.length} rows; ${json.allVotes ?? "?"} votes${prompts ? `; ${prompts} prompts count toward the overall rating` : ""}`],
    };
  },
};
export default source;
