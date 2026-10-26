/**
 * BullshitBench v2 (BSBench, Peter Gostev). Measures whether a model calls out nonsense prompts.
 * Public viewer: petergpt.github.io/bullshit-benchmark/viewer/index.v2.html, backed by data files in
 * the GitHub repo. We read `data/v2/latest/leaderboard.csv` (one row per model x reasoning level) and
 * `aggregate_summary.json` (per-technique breakdown). Value = detection ("green") rate, in percent.
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
      const green = parseFloat(r.green_rate);
      if (!Number.isFinite(green)) continue;
      const m = r.model.match(/^(.*?)(?:@reasoning=([^@]+))?$/);
      const base = (m?.[1] ?? r.model).trim();
      const reasoning = (m?.[2] ?? r.reasoning ?? "").trim();
      rows.push({
        benchmarkId: "bsbench-v2",
        modelLabel: base,
        // pass the published reasoning level through verbatim ("none"/"minimal"/"default"/"high"/...);
        // the central EFFORT_WORDS map decides how to bucket it.
        effort: reasoning || undefined,
        value: green * 100,
        rank: parseInt(r.rank, 10) || undefined,
        sourceUrl: VIEWER,
        labHint: r.org || undefined,
        note: `reasoning=${reasoning || "default"}; avg score ${r.avg_score}/2; red ${(parseFloat(r.red_rate) * 100).toFixed(0)}%; refusals ${r.refusal_count}/${r.answered_count}`,
      });
    }

    return {
      benchmarks: [{
        id: "bsbench-v2", name: "BullshitBench v2", shortName: "BSBench", sourceId: this.id, url: VIEWER,
        description: "Share of 100 nonsense prompts (software, finance, legal, medical, physics) where the model clearly calls out the nonsense instead of confidently answering; 3-judge panel, mean aggregation. Reported per reasoning level.",
        unit: "percent", higherIsBetter: true, category: "reasoning", eligibleForDefault: true, defaultWeight: 10,
        advanced: techniques.map((t) => ({ id: t, name: t.replace(/_/g, " ") })),
      }],
      rows, raw,
      notes: [`${rows.length} model x reasoning rows from leaderboard.csv`],
    };
  },
};
export default source;
