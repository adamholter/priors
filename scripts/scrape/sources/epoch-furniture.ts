import { parse } from "csv-parse/sync";
import type { Benchmark, RawRow, ScrapeResult, Source } from "../../../src/data/types";

/** Epoch AI's Furniture Assembly benchmark, read from the same live CSV export as FrontierMath. */
const ORIGIN = "https://epoch.ai";
const DATA = `${ORIGIN}/data/benchmarks.csv`;
const PAGE = `${ORIGIN}/benchmarks/furniture-assembly`;
const TASK = "Furniture Assembly";

export const FURNITURE: Benchmark = {
  id: "epoch-furniture-assembly", name: "Furniture Assembly", shortName: "Furniture Assembly", sourceId: "epoch-furniture", url: PAGE,
  description: "Epoch AI's spatial-reasoning benchmark: from photos of IKEA builds (Ställ shoe cabinet, Tonstad bed, Gullaberg dresser) and the official manual, the model decides whether the build is correct and, if not, identifies and describes the mistaken step. Mean score. Data: Epoch AI, CC BY.",
  unit: "percent", higherIsBetter: true, category: "reasoning", versionPolicy: { kind: "fresh" }, defaultWeight: 0,
};

type RecordRow = Record<string, string>;

export function parseFurniture(csv: string): Pick<ScrapeResult, "benchmarks" | "rows" | "notes"> {
  const records = parse(csv, { columns: true, bom: true, skip_empty_lines: true, relax_column_count: true }) as RecordRow[];
  if (!records.length || !("task" in records[0]) || !("mean_score" in records[0]) || !("model" in records[0]) || !("Status" in records[0])) throw new Error("Epoch export is missing required benchmark columns");
  // Latest successful run per model/effort (repeats are re-evaluations, not best-of).
  const latest = new Map<string, RecordRow>();
  for (const r of records) {
    if (r.task !== TASK || r.Status !== "Success" || !r.model?.trim() || !r.mean_score?.trim()) continue;
    const value = Number(r.mean_score);
    if (!Number.isFinite(value) || value < 0 || value > 1) continue;
    const prev = latest.get(r.model);
    if (!prev || (r.started_at ?? "") > (prev.started_at ?? "")) latest.set(r.model, r);
  }
  const rows: RawRow[] = [];
  for (const r of latest.values()) {
    const effort = r.model.match(/_(none|minimal|low|medium|high|xhigh|max)$/i)?.[1]?.toLowerCase();
    const assumedMax = !effort && latest.has(`${r.model}_none`);
    const standardError = r.stderr?.trim() ? Number(r.stderr) : undefined;
    rows.push({
      benchmarkId: FURNITURE.id, modelLabel: (r["Display name"] || r["Unique display name"] || r.Model || r.model).trim(),
      effort: effort ?? (assumedMax ? "max" : undefined), value: Number(r.mean_score) * 100, sourceUrl: PAGE,
      labHint: r.Organization || undefined, releaseDateHint: r["Version release date"] || undefined, harness: "Epoch AI",
      note: [
        `Epoch AI (CC BY); run ${r.id_runs}; evaluated ${r.started_at || "date unspecified"}`,
        r["task version"] && `task version ${r["task version"]}`,
        standardError != null && Number.isFinite(standardError) && `standard error ${+(standardError * 100).toFixed(2)} percentage points`,
        r.comments,
        assumedMax && "effort unspecified; assumed maximum, separate from the explicit no-reasoning run",
      ].filter(Boolean).join("; "),
    });
  }
  if (!rows.length) throw new Error("Epoch export contains no usable Furniture Assembly results");
  return { benchmarks: [FURNITURE], rows, notes: [`${rows.length} successful model/effort results`] };
}

const source: Source = {
  id: "epoch-furniture", name: "Furniture Assembly · Epoch AI", url: PAGE,
  async scrape(ctx): Promise<ScrapeResult> {
    const csv = await ctx.fetchText(DATA);
    const result = parseFurniture(csv);
    return { ...result, raw: { "benchmarks.csv": csv, "furniture.json": JSON.stringify(result) } };
  },
};
export default source;
