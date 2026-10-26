/**
 * MineBench (minebench.ai). Models turn a text prompt into raw Minecraft-style block coordinates,
 * builds are rendered and humans vote pairwise; the site publishes a confidence-aware Glicko-style
 * rating. The leaderboard page reads a public JSON API (`/api/leaderboard`). Public ordering uses the
 * conservative `rankScore` (roughly rating − 2·RD); display names carry no effort suffix.
 */
import type { Source, ScrapeResult, RawRow } from "../../../src/data/types";

const SITE = "https://minebench.ai/leaderboard";
const API = "https://minebench.ai/api/leaderboard";

type Row = {
  slug: string;
  provider?: string;
  displayName: string;
  stability?: string;
  eloRating?: number;
  ratingDeviation?: number;
  rankScore?: number;
  ci95?: number;
  ciLower?: number;
  ciUpper?: number;
  confidence?: number;
  rank?: number;
  shownCount?: number;
  winCount?: number;
  lossCount?: number;
  drawCount?: number;
  coveredPrompts?: number;
  activePrompts?: number;
  promptCoverage?: number;
  benchmark?: { averageCostUsd?: number; costEstimated?: boolean; averageTimeMs?: number };
};

const source: Source = {
  id: "minebench",
  name: "MineBench",
  url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const json = await ctx.fetchJson(API) as { models?: Row[] };
    const list = json.models ?? [];
    if (!list.length) throw new Error("MineBench: empty leaderboard");
    const rows: RawRow[] = [];
    for (const r of list) {
      if (typeof r.rankScore !== "number" || !r.displayName) continue;
      const votes = r.shownCount ?? 0;
      rows.push({
        benchmarkId: "minebench", modelLabel: r.displayName, value: r.rankScore, rank: r.rank, sourceUrl: SITE,
        ci: typeof r.ciLower === "number" && typeof r.ciUpper === "number" ? [r.ciLower, r.ciUpper] : undefined,
        note: `${votes} votes · ${r.stability ?? "?"} · slug ${r.slug}`,
        details: {
          eloRating: r.eloRating, ratingDeviation: r.ratingDeviation, confidence: r.confidence,
          wins: r.winCount, losses: r.lossCount, draws: r.drawCount, votes,
          coveredPrompts: r.coveredPrompts, activePrompts: r.activePrompts, promptCoverage: r.promptCoverage,
          stability: r.stability, provider: r.provider,
          averageCostUsd: r.benchmark?.averageCostUsd, costEstimated: r.benchmark?.costEstimated, averageTimeMs: r.benchmark?.averageTimeMs,
        },
      });
    }
    return {
      benchmarks: [{
        id: "minebench", name: "MineBench", sourceId: this.id, url: SITE,
        description: "Models turn a text prompt into raw Minecraft-style block coordinates; humans vote pairwise on the rendered builds. Value is the conservative rankScore (rating − 2·RD), not raw Elo.",
        unit: "elo" as const, higherIsBetter: true, category: "creative" as const, eligibleForDefault: false, defaultWeight: 0,
      }],
      rows,
      raw: { "leaderboard.json": JSON.stringify(json) },
      notes: [`${rows.length} rows; stability: ${[...new Set(list.map((r) => r.stability))].join("/")}`],
    };
  },
};
export default source;
