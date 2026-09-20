/**
 * WeirdML v2 (HT Ihle's leaderboard). Models write ML pipelines across 17 tasks; score is
 * mean accuracy. Backing CSV at htihle.github.io/data/weirdml_data.csv — one row per
 * model/config with effort encoded as `:max` / `(xhigh)` etc. Includes per-run cost and
 * release dates.
 */
import { parse } from "csv-parse/sync";
import type { Source, ScrapeResult, RawRow } from "../../../src/data/types";
import { num } from "../harness";

const SITE = "https://htihle.github.io/weirdml_v2.html";
const CSV = "https://htihle.github.io/data/weirdml_data.csv";

const source: Source = {
  id: "weirdml",
  name: "WeirdML v2",
  url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const csv = await ctx.fetchText(CSV);
    const recs = parse(csv, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
    const rows: RawRow[] = [];
    for (const r of recs) {
      const acc = num(r.avg_acc);
      const internal = r.internal_model_name ?? "";
      if (acc == null || !internal) continue;
      // internal_model_name carries effort as a `:effort` suffix ("gpt-6-astra-pro:max").
      const m = internal.match(/^(.*?)(?::(none|minimal|low|medium|high|xhigh|max|default))?$/);
      const label = (m?.[1] ?? internal).trim();
      const effort = m?.[2] === "max" ? "xhigh" : m?.[2] === "default" ? undefined : m?.[2];
      const lab = r.model_slug?.split("/")[0];
      rows.push({
        benchmarkId: "weirdml-v2",
        modelLabel: label,
        effort,
        value: acc * 100,
        costUsd: num(r.cost_per_run_usd),
        sourceUrl: SITE,
        labHint: lab,
        releaseDateHint: r.release_date || undefined,
        note: `SE ±${((num(r.avg_acc_standard_error) ?? 0) * 100).toFixed(2)} · ${r["API source"] || "API"}`,
      });
    }
    return {
      benchmarks: [{
        id: "weirdml-v2", name: "WeirdML v2", sourceId: this.id, url: SITE,
        description: "17 ML tasks where models write Python pipelines from scratch (shape inference, chess winners, Kolmogorov shuffles); mean accuracy across tasks.",
        unit: "percent", higherIsBetter: true, category: "coding", eligibleForDefault: true, defaultWeight: 5,
      }],
      rows,
      raw: { "weirdml_data.csv": csv },
      notes: [`${rows.length} rows from weirdml_data.csv`],
    };
  },
};
export default source;
