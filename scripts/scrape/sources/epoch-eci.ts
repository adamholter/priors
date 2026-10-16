import { parse } from "csv-parse/sync";
import type { Benchmark, RawRow, ScrapeResult, Source } from "../../../src/data/types";

/**
 * Epoch Capabilities Index (ECI): one capability number per model, fitted by Epoch AI over many
 * benchmarks. Also the place Epoch records whether a model's weights are open, which feeds the
 * open-weights flag. Data: https://epoch.ai/data/eci_scores.csv, CC BY.
 */
const PAGE = "https://epoch.ai/eci";
const DATA = "https://epoch.ai/data/eci_scores.csv";

export const ECI: Benchmark = {
  id: "epoch-eci", name: "Epoch Capabilities Index", shortName: "Epoch ECI", sourceId: "epoch-eci", url: PAGE,
  description: "Epoch AI's Capabilities Index: a single score per model fitted across many benchmarks (item-response model), so scores are comparable across models tested on different sets. About 100 is GPT-4.1 and about 150 is a current frontier model. Data: Epoch AI, CC BY.",
  unit: "score", higherIsBetter: true, category: "composite", versionPolicy: { kind: "fresh" }, defaultWeight: 0,
};

type RecordRow = Record<string, string>;
export function parseEci(csv: string): Pick<ScrapeResult, "benchmarks" | "rows" | "modelFlags" | "notes"> {
  const records = parse(csv, { columns: true, bom: true, skip_empty_lines: true, relax_column_count: true }) as RecordRow[];
  if (!records.length || !("eci" in records[0]) || !("Model" in records[0])) throw new Error("Epoch ECI export is missing required columns");
  const rows: RawRow[] = [], modelFlags: NonNullable<ScrapeResult["modelFlags"]> = [];
  for (const r of records) {
    const value = Number(r.eci), label = (r["Display name"] || r.Model || "").trim();
    if (!label || !Number.isFinite(value)) continue;
    const lo = r.eci_ci_low?.trim() ? Number(r.eci_ci_low) : NaN, hi = r.eci_ci_high?.trim() ? Number(r.eci_ci_high) : NaN;
    const effort = label.match(/\((none|minimal|low|medium|high|xhigh|max)(?:[ ,][^)]*)?\)/i)?.[1]?.toLowerCase();
    rows.push({
      benchmarkId: ECI.id, modelLabel: label, effort, value, sourceUrl: PAGE, labHint: r.Organization || undefined, releaseDateHint: r.date || undefined,
      ...(Number.isFinite(lo) && Number.isFinite(hi) ? { ci: [lo, hi] as [number, number] } : {}),
      note: [`Epoch AI (CC BY)`, r["Model accessibility"]].filter(Boolean).join("; "),
    });
    const group = r["Accessibility group"]?.trim();
    if (group === "Open weights" || group === "Closed weights") modelFlags.push({ modelLabel: label, labHint: r.Organization || undefined, openWeights: group === "Open weights" });
  }
  if (!rows.length) throw new Error("Epoch ECI export has no scores");
  return { benchmarks: [ECI], rows, modelFlags, notes: [`${rows.length} models, ${modelFlags.filter((f) => f.openWeights).length} open weights`] };
}

const source: Source = {
  id: "epoch-eci", name: "Epoch Capabilities Index · Epoch AI", url: PAGE,
  async scrape(ctx): Promise<ScrapeResult> {
    const csv = await ctx.fetchText(DATA);
    return { ...parseEci(csv), raw: { "eci_scores.csv": csv } };
  },
};
export default source;
