/**
 * VoxelBench (voxelbench.ai). Models build 3D voxel scenes from prompts; humans vote head-to-head on the
 * renders and the site publishes Glicko-2 ratings. The leaderboard page reads a public JSON API
 * (`/api/leaderboard?type=text|image`); both tracks are separate benchmarks.
 * Labels carry the effort in parentheses ("Claude Opus 5.5 (Max)", "Grok 4.6 (xHigh)").
 */
import type { Source, ScrapeResult, RawRow } from "../../../src/data/types";

const SITE = "https://www.voxelbench.ai/leaderboard";
const API = "https://voxelbench.ai/api/leaderboard";

type Row = { rank: number; modelName: string; modelSlug: string; rating: number; deviation?: number; gamesPlayed?: number; winRate?: string };

const TRACKS = [
  { type: "text", id: "voxelbench-text", name: "VoxelBench (text)", description: "Models build 3D voxel scenes from text prompts; humans vote head-to-head on the renders. Glicko-2 rating." },
  { type: "image", id: "voxelbench-image", name: "VoxelBench (image)", description: "Models recreate a reference image as a 3D voxel build; humans vote head-to-head on the renders. Glicko-2 rating." },
] as const;

function split(label: string): { model: string; effort?: string } {
  const m = label.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (!m) return { model: label.trim() };
  const effort = m[2].trim().toLowerCase().replace(/\s+/g, "");
  return /^(none|minimal|low|medium|high|xhigh|max)$/.test(effort) ? { model: m[1].trim(), effort } : { model: label.trim() };
}

const source: Source = {
  id: "voxelbench",
  name: "VoxelBench",
  url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const raw: Record<string, string> = {};
    const rows: RawRow[] = [];
    const notes: string[] = [];
    for (const t of TRACKS) {
      const json = await ctx.fetchJson(`${API}?limit=500&type=${t.type}`) as { leaderboard?: Row[] };
      raw[`leaderboard-${t.type}.json`] = JSON.stringify(json);
      const list = json.leaderboard ?? [];
      if (!list.length) throw new Error(`VoxelBench ${t.type}: empty leaderboard`);
      for (const r of list) {
        if (typeof r.rating !== "number" || !r.modelName) continue;
        const { model, effort } = split(r.modelName);
        rows.push({
          benchmarkId: t.id, modelLabel: model, effort, value: r.rating, rank: r.rank, sourceUrl: SITE,
          ci: typeof r.deviation === "number" ? [r.rating - 1.96 * r.deviation, r.rating + 1.96 * r.deviation] : undefined,
          note: `${r.gamesPlayed ?? "?"} votes · ${r.winRate ?? "?"}% win rate · slug ${r.modelSlug}`,
        });
      }
      notes.push(`${t.type}: ${list.length} rows`);
    }
    return {
      benchmarks: TRACKS.map((t) => ({
        id: t.id, name: t.name, sourceId: this.id, url: SITE, description: t.description,
        unit: "elo" as const, higherIsBetter: true, category: "creative" as const, eligibleForDefault: false, defaultWeight: 0,
      })),
      rows, raw, notes,
    };
  },
};
export default source;
