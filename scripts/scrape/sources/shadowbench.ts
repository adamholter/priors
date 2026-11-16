/**
 * ShadowBench (Perpetual Research, Nov 5 2026): a model sees a hand-shadow plate from a nineteenth-century book and poses two
 * articulated 3D hands between a lamp and a screen, one tool call at a time, until their shadow matches it. The Hugging Face
 * dataset perpetual-research/shadowbench publishes `data/leaderboard/leaderboard.parquet` (its default config), one row per
 * model and reasoning effort with the mean score over 20 plates, a 95% bootstrap interval, token cost and minutes per episode.
 * Rows whose `kind` is "reference" are baselines (featureless blob, blind CMA-ES search, hands at rest), not models: they are
 * read into the description, never as rows. Read with hyparquet, as Arena's dataset is.
 */
import type { RawRow, ScrapeResult, Source } from "../../../src/data/types";
import { LIVE_NOTE } from "../../../src/data/catalog";

export const SHADOWBENCH_ID = "shadowbench";
const SITE = "https://perpetualresearch.si/shadowbench/";
const DATASET = "https://huggingface.co/datasets/perpetual-research/shadowbench";
const PARQUET = `${DATASET}/resolve/main/data/leaderboard/leaderboard.parquet`;

export type ShadowRow = {
  kind?: string | null; model?: string | null; model_name?: string | null; effort?: string | null; episodes?: number | null;
  score?: number | null; ci_low?: number | null; ci_high?: number | null; iou?: number | null; boundary_f1?: number | null;
  cost_usd_per_episode?: number | null; minutes_per_episode?: number | null; calls_per_episode?: number | null;
  episodes_with_book_peek?: number | null; best_episode_score?: number | null;
};

const fin = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function parseShadowBench(table: ShadowRow[], lastUpdated?: string): Pick<ScrapeResult, "benchmarks" | "rows" | "notes"> {
  const rows: RawRow[] = [];
  const refs: string[] = [];
  for (const r of table) {
    if (!r.model_name || !fin(r.score) || r.score < 0 || r.score > 100) continue;
    if (r.kind !== "model" || !r.effort) { refs.push(`${r.model_name} ${r.score.toFixed(1)}`); continue; }
    rows.push({
      benchmarkId: SHADOWBENCH_ID, modelLabel: r.model_name, effort: r.effort, value: r.score, sourceUrl: SITE,
      ...(fin(r.ci_low) && fin(r.ci_high) ? { ci: [r.ci_low, r.ci_high] as [number, number] } : {}),
      ...(fin(r.cost_usd_per_episode) ? { costUsd: r.cost_usd_per_episode } : {}),
      ...(fin(r.minutes_per_episode) ? { durationSec: Math.round(r.minutes_per_episode * 60) } : {}),
      ...(fin(r.calls_per_episode) ? { steps: r.calls_per_episode } : {}),
      note: `${r.episodes ?? 20} episodes, one per plate${fin(r.best_episode_score) ? `; best episode ${r.best_episode_score.toFixed(1)}` : ""}`,
      details: { sourceModelId: r.model, iou: r.iou, outlineF1: r.boundary_f1, bookPeekEpisodes: r.episodes_with_book_peek, bestEpisode: r.best_episode_score },
    });
  }
  if (rows.length < 6) throw new Error(`ShadowBench: ${rows.length} model rows; leaderboard.parquet changed?`);
  return {
    benchmarks: [{
      id: SHADOWBENCH_ID, name: "ShadowBench", shortName: "Shadow", sourceId: SHADOWBENCH_ID, url: SITE,
      description: `Hand shadows: the model poses two 3D hands between a lamp and a screen until their shadow matches an animal from a nineteenth-century book.${refs.length ? `${LIVE_NOTE}Reference scores, not models: ${refs.join(", ")}.` : ""}`,
      unit: "score", higherIsBetter: true, category: "vision", categories: ["vision", "reasoning"], normalization: { kind: "linear", min: 0, max: 100 },
      eligibleForDefault: true, defaultWeight: 0, ...(lastUpdated ? { lastUpdated } : {}),
    }],
    rows,
    notes: [`${rows.length} model rows${refs.length ? `, ${refs.length} references (${refs.join(", ")})` : ""}`],
  };
}

/** Parquet integers come back as BigInt. */
const plain = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : v])) as ShadowRow;

const source: Source = {
  id: SHADOWBENCH_ID, name: "ShadowBench", url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    void ctx;
    const get = async (url: string) => {
      const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(60_000), headers: { "user-agent": "Mozilla/5.0 priors-scraper" } });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return res;
    };
    const { parquetReadObjects } = await import("hyparquet");
    const buf = await (await get(PARQUET)).arrayBuffer();
    const table = (await parquetReadObjects({ file: buf }) as Record<string, unknown>[]).map(plain);
    // The dataset's last commit is the results' publish date.
    const meta = await get(`https://huggingface.co/api/datasets/perpetual-research/shadowbench`).then((r) => r.json() as Promise<{ lastModified?: string }>).catch(() => ({} as { lastModified?: string }));
    const updated = meta.lastModified?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    return { ...parseShadowBench(table, updated), raw: { "leaderboard.json": JSON.stringify(table) } };
  },
};
export default source;
