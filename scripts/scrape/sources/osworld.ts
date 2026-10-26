/**
 * OSWorld (XLANG Lab): computer-use agents completing real desktop tasks in a VM.
 *   osworld-2         — OSWorld 2.0 official results JSON (the leaderboard's own data file). Uses the
 *                       newest task release on the full dataset at the default 500-step budget;
 *                       binary accuracy (task fully completed).
 *   osworld-verified  — OSWorld-Verified results workbook. General-model entries only (agent
 *                       frameworks and specialized agents aren't models); best success rate across
 *                       step budgets.
 */
import type { Benchmark, RawRow, ScrapeResult, Source } from "../../../src/data/types";
import { num, xlsxRows } from "../harness";

const V2_SITE = "https://osworld-v2.xlang.ai/";
const V2_DATA = "https://osworld-v2.xlang.ai/static/data/leaderboard/official-results.json";
const V1_SITE = "https://os-world.github.io/";
const V1_DATA = "https://os-world.github.io/static/data/osworld_verified_results.xlsx";

type V2Row = { model: string; reasoning?: string; toolSetting?: string; stepBudget?: number; releaseVersion?: string; datasetScope?: string; binaryAccuracy?: number; partialScore?: number; outputTokensPerTask?: number; estimatedCostUsd?: number | null; official?: boolean };
type V2Data = { benchmarkVersion?: string; releaseVersions?: string[]; defaultStepBudget?: number; updatedAt?: string; results: V2Row[] };
const EFFORTS = new Set(["none", "minimal", "low", "medium", "high", "xhigh", "max"]);

export function parseOsworld2(d: V2Data): RawRow[] {
  if (!Array.isArray(d?.results)) throw new Error("OSWorld 2.0 data has no results[]");
  const budget = d.defaultStepBudget ?? 500;
  const dated = (d.releaseVersions ?? []).filter((v) => /^v\d{4}\.\d{2}\.\d{2}$/.test(v)).sort();
  const latest = dated[dated.length - 1] ?? d.results.map((r) => r.releaseVersion).filter(Boolean).sort().pop();
  const rows: RawRow[] = [];
  for (const r of d.results) {
    if (r.official === false || r.releaseVersion !== latest || r.datasetScope !== "full" || r.stepBudget !== budget || !Number.isFinite(r.binaryAccuracy)) continue;
    const effort = r.reasoning && EFFORTS.has(r.reasoning.toLowerCase()) ? r.reasoning.toLowerCase() : undefined;
    rows.push({
      benchmarkId: "osworld-2", modelLabel: r.model.trim(), effort, value: r.binaryAccuracy!, sourceUrl: V2_SITE, harness: r.toolSetting,
      outputTokens: Number.isFinite(r.outputTokensPerTask) ? r.outputTokensPerTask : undefined, costUsd: r.estimatedCostUsd ?? undefined,
      note: `${d.benchmarkVersion ?? "OSWorld 2.0"} ${latest} · full set · ${budget} steps · ${r.toolSetting ?? ""} · partial score ${r.partialScore ?? "—"}%${d.updatedAt ? ` · updated ${d.updatedAt}` : ""}`,
    });
  }
  return rows;
}

export function parseOsworldVerified(records: Record<string, string>[]): RawRow[] {
  if (!records.length || !("Model" in records[0]) || !("Success rate" in records[0]) || !("Approach type" in records[0])) throw new Error("OSWorld-Verified workbook columns changed");
  const best = new Map<string, RawRow>();
  for (const r of records) {
    const value = num(r["Success rate"]);
    if (r["Approach type"] !== "General model" || value == null || !r.Model?.trim()) continue;
    const label = r.Model.replace(/\[[^\]]*\]\s*$/, "").trim(); // "claude-opus-5[1m]" → context-size tag dropped
    const row: RawRow = { benchmarkId: "osworld-verified", modelLabel: label, value, sourceUrl: V1_SITE, labHint: r.Institution || undefined, note: `${r["Max steps"] || "?"} max steps · ${r["Success/Total"] || ""}`.trim() };
    if (!best.has(label) || value > best.get(label)!.value) best.set(label, row);
  }
  return [...best.values()];
}

const BENCHMARKS: Benchmark[] = [
  { id: "osworld-2", name: "OSWorld 2.0", shortName: "OSWorld 2.0", sourceId: "osworld", url: V2_SITE, unit: "percent", higherIsBetter: true, category: "agentic", eligibleForDefault: true, defaultWeight: 0,
    description: "Computer use: agents complete long, realistic desktop tasks across apps in a VM. Binary accuracy (task fully completed) on the newest task release, full set, default step budget." },
  { id: "osworld-verified", name: "OSWorld-Verified", shortName: "OSWorld-Verified", sourceId: "osworld", url: V1_SITE, unit: "percent", higherIsBetter: true, category: "agentic", eligibleForDefault: true, defaultWeight: 0,
    description: "Computer use on 361 verified Ubuntu desktop tasks (Chrome, LibreOffice, GIMP, VS Code…). Success rate of general models, best across step budgets." },
];

const source: Source = {
  id: "osworld", name: "OSWorld", url: V2_SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const [v2text, xlsx] = await Promise.all([
      ctx.fetchText(V2_DATA),
      fetch(V1_DATA, { signal: AbortSignal.timeout(60_000) }).then((r) => { if (!r.ok) throw new Error(`${r.status} ${V1_DATA}`); return r.arrayBuffer(); }),
    ]);
    const v2 = parseOsworld2(JSON.parse(v2text) as V2Data), v1 = parseOsworldVerified(xlsxRows(Buffer.from(xlsx)));
    if (!v2.length || !v1.length) throw new Error(`OSWorld returned no usable rows (2.0: ${v2.length}, Verified: ${v1.length})`);
    return { benchmarks: BENCHMARKS, rows: [...v2, ...v1], raw: { "official-results.json": v2text }, notes: [`2.0: ${v2.length} rows`, `Verified: ${v1.length} rows`] };
  },
};
export default source;
