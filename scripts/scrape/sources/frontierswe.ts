/**
 * FrontierSWE (Cognition). v2 is the live leaderboard at frontierswe.com (mean@5 over 34 tasks,
 * Proximus harness, max reasoning effort). v1 is preserved at /v1 (avg rank + dominance over 17 tasks).
 * Both pages are Next.js; the leaderboard entries are embedded in the RSC flight payload.
 */
import type { Source, ScrapeResult, RawRow } from "../../../src/data/types";
import { rscText, extractKeyed } from "./_rsc";

const SITE = "https://www.frontierswe.com";

interface V2Entry {
  model: string; harness: string; vendor?: string; overall: number;
  implementation?: number; performance?: number; research?: number;
  avgCostUsd?: number | null; avgTokensOut?: number | null; avgDurationSeconds?: number | null;
}
interface V2Entries { abs: { best: V2Entry[]; mean: V2Entry[]; worst: V2Entry[] } }
interface V1Entry { model: string; harness: string; overall: number; dominance: number; implementation?: number; performance?: number; research?: number }
interface V1Entries { best: V1Entry[]; mean: V1Entry[] }

const source: Source = {
  id: "frontierswe",
  name: "FrontierSWE",
  url: `${SITE}/`,
  async scrape(ctx): Promise<ScrapeResult> {
    const rows: RawRow[] = [];
    const raw: Record<string, string> = {};
    const notes: string[] = [];

    // ---- v2 (live)
    const html2 = await ctx.fetchText(this.url);
    raw["v2.html"] = html2;
    const text2 = rscText(html2);
    const ent2 = extractKeyed<V2Entries>(text2, "entries").find((e) => e?.abs?.mean?.length);
    if (!ent2) throw new Error("FrontierSWE v2: could not locate leaderboard entries in RSC payload");
    raw["v2-entries.json"] = JSON.stringify(ent2, null, 2);
    const noteMatch = text2.match(/"note":"(Scores across all \d+ tasks[^"]*)"/);
    if (noteMatch) notes.push(`v2: ${noteMatch[1]}`);
    const byKey = (list: V2Entry[]) => new Map(list.map((e) => [`${e.model}::${e.harness}`, e]));
    const best = byKey(ent2.abs.best), worst = byKey(ent2.abs.worst);
    const mean = [...ent2.abs.mean].sort((a, b) => b.overall - a.overall);
    mean.forEach((e, i) => {
      const k = `${e.model}::${e.harness}`;
      const lo = worst.get(k)?.overall, hi = best.get(k)?.overall;
      rows.push({
        benchmarkId: "frontierswe-v2",
        modelLabel: e.model,
        effort: "max", // site: "We evaluate each model at its maximum reasoning effort"
        value: e.overall,
        ci: lo != null && hi != null ? [lo, hi] : undefined,
        costUsd: e.avgCostUsd ?? undefined,
        outputTokens: e.avgTokensOut ?? undefined,
        durationSec: e.avgDurationSeconds ?? undefined,
        harness: e.harness,
        rank: i + 1,
        sourceUrl: this.url,
        labHint: e.vendor,
        note: `mean@5; whiskers worst@5..best@5${e.implementation != null ? `; impl ${e.implementation.toFixed(1)} / perf ${e.performance?.toFixed(1)} / research ${e.research?.toFixed(1)}` : ""}`,
      });
    });
    notes.push(`v2: ${mean.length} rows`);

    // ---- v1 (preserved)
    try {
      const html1 = await ctx.fetchText(`${SITE}/v1`);
      raw["v1.html"] = html1;
      const text1 = rscText(html1);
      const ent1 = extractKeyed<V1Entries>(text1, "entries").find((e) => Array.isArray(e?.mean) && e.mean.length && "dominance" in e.mean[0]);
      if (!ent1) throw new Error("no v1 entries");
      raw["v1-entries.json"] = JSON.stringify(ent1, null, 2);
      const v1 = [...ent1.mean].sort((a, b) => b.dominance - a.dominance);
      v1.forEach((e, i) => rows.push({
        benchmarkId: "frontierswe-v1",
        modelLabel: e.model,
        value: e.dominance * 100,
        harness: e.harness,
        rank: i + 1,
        sourceUrl: `${SITE}/v1`,
        note: `dominance (mean@5); avg per-task rank ${e.overall.toFixed(2)}`,
      }));
      notes.push(`v1: ${v1.length} rows`);
    } catch (e) {
      notes.push(`v1 skipped: ${e instanceof Error ? e.message : String(e)}`);
    }

    return {
      benchmarks: [
        {
          id: "frontierswe-v2", name: "FrontierSWE v2", shortName: "FrontierSWE", sourceId: this.id, url: this.url,
          description: "Cognition's ultra-long-horizon software engineering benchmark: 34 tasks graded 0-100 on implementation, performance and research; mean@5 with a 20-hour budget per task in the Proximus harness at max reasoning effort.",
          unit: "percent", higherIsBetter: true, category: "coding",
          versionPolicy: { kind: "fresh", supersedes: "frontierswe-v1" }, eligibleForDefault: true, defaultWeight: 25,
          advanced: [
            { id: "implementation", name: "Implementation" }, { id: "performance", name: "Performance" }, { id: "research", name: "Research" },
          ],
        },
        {
          id: "frontierswe-v1", name: "FrontierSWE v1", shortName: "FrontierSWE v1", sourceId: this.id, url: `${SITE}/v1`,
          description: "Original FrontierSWE leaderboard (17 tasks): dominance = win rate against a random opponent on a random task, mean@5, each model in its native CLI harness. Preserved as published.",
          unit: "percent", higherIsBetter: true, category: "coding",
          versionPolicy: { kind: "fresh" }, eligibleForDefault: false, defaultWeight: 0,
        },
      ],
      rows, raw, notes,
    };
  },
};
export default source;
