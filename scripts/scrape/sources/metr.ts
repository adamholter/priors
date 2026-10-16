import type { Benchmark, RawRow, ScrapeResult, Source } from "../../../src/data/types";

/**
 * METR time horizon: the length of software task (in minutes a skilled human needs) a model completes
 * half the time. Published as YAML at https://metr.org/assets/benchmark_results_1_1.yaml, which has a
 * fixed, simple shape, so it is read without a YAML library.
 */
const PAGE = "https://metr.org/time-horizons/";
const DATA = "https://metr.org/assets/benchmark_results_1_1.yaml";

export const METR: Benchmark = {
  id: "metr-time-horizon", name: "METR Time Horizon (50%)", shortName: "METR 50% horizon", sourceId: "metr", url: PAGE,
  description: "METR's time horizon: the length of software and reasoning task, measured in minutes a skilled human needs, that the model completes successfully half the time. Longer is better; it has roughly doubled every few months.",
  unit: "score", higherIsBetter: true, category: "agentic", versionPolicy: { kind: "fresh" }, defaultWeight: 0,
};

/** The label METR's alias implies: "claude_3_7_sonnet_inspect" reads as "claude 3 7 sonnet". Unknown labels are dropped by normalization. */
export const metrLabel = (alias: string) => alias.replace(/_inspect$/, "").replace(/_early$/, "").replace(/(\d)_(\d)/g, "$1.$2").replace(/_/g, " ").trim();

/** One block per model under `results:`; every `key: value` line is flattened to its dotted path ("metrics.p50_horizon_length.estimate"). */
export function parseMetr(yaml: string): Pick<ScrapeResult, "benchmarks" | "rows" | "notes"> {
  const start = yaml.indexOf("\nresults:");
  if (start < 0) throw new Error("METR results block not found");
  const rows: RawRow[] = [];
  let alias = "", block: Record<string, string> = {};
  const path: string[] = [];
  const flush = () => {
    const p50 = Number(block["metrics.p50_horizon_length.estimate"]), lo = Number(block["metrics.p50_horizon_length.ci_low"]), hi = Number(block["metrics.p50_horizon_length.ci_high"]);
    if (alias && Number.isFinite(p50) && p50 > 0) rows.push({
      benchmarkId: METR.id, modelLabel: metrLabel(alias), value: p50, sourceUrl: PAGE, harness: "METR",
      ...(Number.isFinite(lo) && Number.isFinite(hi) ? { ci: [lo, hi] as [number, number] } : {}),
      releaseDateHint: block["release_date"],
      note: `p50 horizon in minutes; ${block["metrics.is_sota"] === "true" ? "state of the art at release; " : ""}alias ${alias}`,
    });
  };
  for (const line of yaml.slice(start + 1).split("\n").slice(1)) {
    if (!line.trim() || line.trim().startsWith("#") || line.trim().startsWith("- ")) continue;
    const indent = line.length - line.trimStart().length, m = line.trim().match(/^([^:]+):\s*(.*)$/);
    if (!m) continue;
    if (indent === 0) break; // the next top-level key ends the results block
    const depth = indent / 2;
    if (depth === 1) { flush(); alias = m[1].trim(); block = {}; path.length = 0; continue; }
    path.length = depth - 2;
    path.push(m[1].trim());
    if (m[2] && !m[2].startsWith("#")) block[path.join(".")] = m[2].replace(/\s+#.*$/, "").replace(/^["']|["']$/g, "");
  }
  flush();
  if (!rows.length) throw new Error("METR export has no usable time horizons");
  return { benchmarks: [METR], rows, notes: [`${rows.length} models`] };
}

const source: Source = {
  id: "metr", name: "Time horizon · METR", url: PAGE,
  async scrape(ctx): Promise<ScrapeResult> {
    const yaml = await ctx.fetchText(DATA);
    return { ...parseMetr(yaml), raw: { "benchmark_results_1_1.yaml": yaml } };
  },
};
export default source;
