/**
 * PriorsBench (mypriors.com/priorsbench): Priors visitors' own rankings from /rank, fitted into an Elo-scale rating per model
 * (`src/lib/priorsbench.ts` has the method). The votes come from Convex's public `lineups:forBench` query. The rankings name
 * Priors model ids, so each row is filed under the name the last snapshot gave that id; ids the snapshot no longer has are left out.
 * It measures belief, not ability, so it is never in a default mix and the ranking fit never uses it (it would fit itself).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import type { RawRow, ScrapeResult, Snapshot, Source } from "../../../src/data/types";
import { fetchRankings, HALF_LIFE_DAYS, MIN_RANKINGS, PRIORSBENCH_ID, PRIORSBENCH_URL, rate, type Ranking } from "../../../src/lib/priorsbench";

export function parsePriorsBench(rankings: Ranking[], models: { id: string; name: string }[], now: number): Pick<ScrapeResult, "benchmarks" | "rows" | "notes"> {
  const names = new Map(models.map((m) => [m.id, m.name]));
  const ratings = rate(rankings, { asOf: now, bootstrap: 100, known: (id) => names.has(id) });
  const rows: RawRow[] = ratings.map((r) => ({
    benchmarkId: PRIORSBENCH_ID, modelLabel: names.get(r.modelId)!, effortUnstated: true, value: r.rating, ...(r.ci ? { ci: r.ci } : {}), sourceUrl: PRIORSBENCH_URL,
    note: `In ${r.rankings} people's rankings`, details: { rankings: r.rankings, weightedRankings: r.weight, modelId: r.modelId },
  }));
  if (rows.length < 5) throw new Error(`PriorsBench: ${rows.length} rated models from ${rankings.length} rankings`);
  return {
    benchmarks: [{
      id: PRIORSBENCH_ID, name: "PriorsBench", shortName: "PriorsBench", sourceId: PRIORSBENCH_ID, url: PRIORSBENCH_URL,
      description: `What Priors visitors think: every ranking people finish on /rank counts each higher-placed model as beating each lower one, fitted into an Elo-scale rating like an arena. Recent rankings count most (a ranking's weight halves every ${HALF_LIFE_DAYS} days); a model needs ${MIN_RANKINGS} rankings to be rated. A measure of belief, not ability.`,
      unit: "elo", higherIsBetter: true, category: "preference", eligibleForDefault: false, defaultWeight: 0, lastUpdated: new Date(now).toISOString().slice(0, 10),
    }],
    rows,
    notes: [`${rows.length} models from ${rankings.length} rankings`],
  };
}

const source: Source = {
  id: PRIORSBENCH_ID, name: "PriorsBench", url: PRIORSBENCH_URL,
  async scrape(ctx): Promise<ScrapeResult> {
    const rankings = await fetchRankings(undefined, (url, init) => ctx.fetchJson(url, init));
    const snapshot = JSON.parse(gunzipSync(readFileSync(path.resolve("data/snapshots/latest.json.gz"))).toString("utf8")) as Snapshot;
    return { ...parsePriorsBench(rankings, snapshot.models, Date.parse(ctx.now) || Date.now()), raw: { "rankings.json": JSON.stringify(rankings) } };
  },
};
export default source;
