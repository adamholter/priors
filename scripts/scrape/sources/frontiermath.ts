import { parse } from "csv-parse/sync";
import type { Benchmark, RawRow, ScrapeResult, Source } from "../../../src/data/types";

const ORIGIN = "https://epoch.ai";
const DATA = `${ORIGIN}/data/benchmarks.csv`;
const PAGE = `${ORIGIN}/frontiermath/tiers-1-4`;

type RecordRow = Record<string, string>;

function definition(task: string): Benchmark | undefined {
  const tier = task.match(/^FrontierMath-(Tiers-\d-\d|Tier-\d)-v(\d+)-Private$/);
  if (tier) {
    const id = `frontiermath-${tier[1].toLowerCase()}-v${tier[2]}`;
    return {
      id, name: `FrontierMath ${tier[1].replaceAll("-", " ")} (v${tier[2]})`.replace(/Tiers (\d) (\d)/, "Tiers $1–$2"),
      shortName: `FM ${tier[1].replaceAll("-", " ").replace(/Tiers (\d) (\d)/, "Tiers $1–$2")}`,
      sourceId: "frontiermath", url: `${ORIGIN}/benchmarks/${id}`,
      description: `Epoch AI's FrontierMath ${tier[1].replaceAll("-", " ")}, version ${tier[2]}: expert-written mathematics problems evaluated with Python tools. Accuracy on the private set, not the public sample questions. Data: Epoch AI, CC BY.`,
      unit: "percent", higherIsBetter: true, category: "math", versionPolicy: { kind: "fresh" }, defaultWeight: 0,
    };
  }
  if (task === "FrontierMath-Erdos") return {
    id: "frontiermath-erdos", name: "FrontierMath Erdős", shortName: "FM Erdős", sourceId: "frontiermath",
    url: `${ORIGIN}/benchmarks/frontiermath-erdos`,
    description: "Epoch AI's 68 open Erdős problems, formulated in Lean. Models must supply complete formal proofs or disproofs. Published solved fraction; distinct from FrontierMath difficulty tiers. Data: Epoch AI, CC BY.",
    unit: "percent", higherIsBetter: true, category: "math", versionPolicy: { kind: "fresh" }, defaultWeight: 0,
  };
}

export function parseFrontierMath(csv: string): Pick<ScrapeResult, "benchmarks" | "rows" | "notes"> {
  const records = parse(csv, { columns: true, bom: true, skip_empty_lines: true }) as RecordRow[];
  if (!records.length || !("task" in records[0]) || !("mean_score" in records[0]) || !("model" in records[0]) || !("Status" in records[0])) throw new Error("Epoch export is missing required benchmark columns");
  const latest = new Map<string, RecordRow>();
  for (const r of records) {
    if (!definition(r.task) || r.Status !== "Success" || !r.model?.trim() || !r.mean_score?.trim()) continue;
    const value = Number(r.mean_score);
    if (!Number.isFinite(value) || value < 0 || value > 1) continue;
    const key = `${r.task}|${r.model}`;
    const previous = latest.get(key);
    if (!previous || (r.started_at ?? "") > (previous.started_at ?? "")) latest.set(key, r);
  }
  const benchmarks = new Map<string, Benchmark>();
  const rows: RawRow[] = [];
  for (const r of latest.values()) {
    const b = definition(r.task)!;
    benchmarks.set(b.id, b);
    const effort = r.model.match(/_(none|minimal|low|medium|high|xhigh|max)$/i)?.[1]?.toLowerCase();
    const assumedMax = !effort && latest.has(`${r.task}|${r.model}_none`);
    const standardError = r.stderr?.trim() ? Number(r.stderr) : undefined;
    rows.push({
      benchmarkId: b.id, modelLabel: (r["Display name"] || r["Unique display name"] || r.Model || r.model).trim(),
      effort: effort ?? (assumedMax ? "max" : undefined), value: Number(r.mean_score) * 100, sourceUrl: b.url,
      labHint: r.Organization || undefined, releaseDateHint: r["Version release date"] || undefined,
      harness: "Epoch AI",
      note: [
        `Epoch AI (CC BY); dataset ${r.task}; run ${r.id_runs}; evaluated ${r.started_at || "date unspecified"}`,
        r["task version"] && `task version ${r["task version"]}`,
        standardError != null && Number.isFinite(standardError) && `standard error ${standardError * 100} percentage points`,
        r.comments,
        assumedMax && "effort unspecified; assumed maximum, separate from the explicit no-reasoning run",
      ].filter(Boolean).join("; "),
    });
  }
  if (!rows.length) throw new Error("Epoch export contains no usable FrontierMath results");
  return { benchmarks: [...benchmarks.values()], rows, notes: [`${rows.length} successful model/effort results across ${benchmarks.size} FrontierMath sets; public examples and obsolete v1 sets excluded`] };
}

const source: Source = {
  id: "frontiermath", name: "FrontierMath · Epoch AI", url: PAGE,
  async scrape(ctx): Promise<ScrapeResult> {
    const [csv, page] = await Promise.all([ctx.fetchText(DATA), ctx.fetchText(PAGE)]);
    const result = parseFrontierMath(csv);
    for (const id of ["frontiermath-tier-4-v2", "frontiermath-tiers-1-3-v2"]) {
      if (!result.benchmarks.some((b) => b.id === id)) throw new Error(`Epoch export is missing ${id}; review upstream version changes`);
    }
    return { ...result, raw: { "benchmarks.csv": csv, "tiers.html": page, "frontiermath.json": JSON.stringify(result) } };
  },
};
export default source;
