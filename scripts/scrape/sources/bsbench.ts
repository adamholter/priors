/**
 * BullshitBench v2 (BSBench, Peter Gostev). Measures whether a model calls out nonsense prompts.
 * Public viewer: petergpt.github.io/bullshit-benchmark/viewer/index.v2.html, backed by data files in
 * the GitHub repo. We read `data/v2/latest/leaderboard.csv` (one row per model x reasoning level) and
 * `aggregate_summary.json` (per-technique breakdown). Value = clear pushback ("green") rate in percent, over the answers that
 * were not refusals: the viewer's own rule ("Scores, rankings and averages always exclude refusals"). The CSV's green_rate counts
 * refusals as misses, which put models that refuse some prompts (Opus 5, Opus 5.5) several points below the published board.
 */
import type { Source, ScrapeResult, RawRow } from "../../../src/data/types";

const RAW = "https://raw.githubusercontent.com/petergpt/bullshit-benchmark/main/data/v2/latest";
const VIEWER = "https://petergpt.github.io/bullshit-benchmark/viewer/index.v2.html";

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",");
  return lines.slice(1).filter(Boolean).map((l) => {
    const cells: string[] = []; let cur = "", q = false;
    for (const ch of l) {
      if (ch === '"') q = !q; else if (ch === "," && !q) { cells.push(cur); cur = ""; } else cur += ch;
    }
    cells.push(cur);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
  });
}

/** Clear pushback over non-refused answers (0 to 1), as the viewer ranks; the CSV's green_rate when the counts are missing. */
export function clearRate(r: Record<string, string>): number | undefined {
  const clear = parseFloat(r.score_2), total = parseFloat(r.nonsense_count), refused = parseFloat(r.refusal_count) || 0;
  if (Number.isFinite(clear) && Number.isFinite(total) && total - refused > 0) return clear / (total - refused);
  const green = parseFloat(r.green_rate);
  return Number.isFinite(green) ? green : undefined;
}

interface AggRow { model: string; technique_breakdown?: Record<string, number>; avg_score?: number; detection_rate_score_2?: number }
interface Agg { leaderboard: AggRow[]; consensus_method?: string; num_judges?: number }

const source: Source = {
  id: "bsbench",
  name: "BullshitBench v2",
  url: VIEWER,
  async scrape(ctx): Promise<ScrapeResult> {
    const csv = await ctx.fetchText(`${RAW}/leaderboard.csv`);
    const raw: Record<string, string> = { "leaderboard.csv": csv };
    const recs = parseCsv(csv);
    let techniques: string[] = [];
    try {
      const agg = await ctx.fetchJson<Agg>(`${RAW}/aggregate_summary.json`);
      raw["aggregate_summary.json"] = JSON.stringify(agg, null, 2);
      techniques = Object.keys(agg.leaderboard?.[0]?.technique_breakdown ?? {});
    } catch (e) { ctx.log(`aggregate_summary.json unavailable: ${e instanceof Error ? e.message : e}`); }

    const rows: RawRow[] = [];
    for (const r of recs) {
      const green = clearRate(r);
      if (green === undefined) continue;
      const m = r.model.match(/^(.*?)(?:@reasoning=([^@]+))?$/);
      const base = (m?.[1] ?? r.model).trim();
      const reasoning = (m?.[2] ?? r.reasoning ?? "").trim();
      rows.push({
        benchmarkId: "bsbench-v2",
        modelLabel: base,
        // pass the published reasoning level through verbatim ("none"/"minimal"/"default"/"high"/...);
        // the central EFFORT_WORDS map decides how to bucket it.
        effort: reasoning || undefined,
        value: Math.round(green * 1000) / 10,
        rank: parseInt(r.rank, 10) || undefined,
        sourceUrl: VIEWER,
        labHint: r.org || undefined,
        note: `reasoning=${reasoning || "default"}; avg score ${r.avg_score}/2; red ${(parseFloat(r.red_rate) * 100).toFixed(0)}%; refusals ${r.refusal_count}/${r.answered_count}`,
      });
    }

    return {
      benchmarks: [{
        id: "bsbench-v2", name: "BullshitBench v2", shortName: "BSBench", sourceId: this.id, url: VIEWER,
        description: "Share of 100 nonsense prompts (software, finance, legal, medical, physics) where the model clearly calls out the nonsense instead of confidently answering, over the prompts it did not refuse; 3-judge panel, mean aggregation. Reported per reasoning level.",
        unit: "percent", higherIsBetter: true, category: "reasoning", eligibleForDefault: true, defaultWeight: 10,
        advanced: techniques.map((t) => ({ id: t, name: t.replace(/_/g, " ") })),
      }],
      rows, raw,
      notes: [`${rows.length} model x reasoning rows from leaderboard.csv`],
    };
  },
};
export default source;
