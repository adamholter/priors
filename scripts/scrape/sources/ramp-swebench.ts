/**
 * Ramp SWE-Bench v2 (labs.ramp.com/swebench): 500 tasks built from work Ramp's engineers shipped to production, one attempt per
 * task (pass@1) at high reasoning effort with web tools off. Harness errors that survive retries and runs over 3.5 hours count as
 * failures. The page reads one CSV per board with a row per model and task, and the scores here are computed from those rows the way
 * the page does: tasks resolved over tasks run. The main board runs each model in its lab's own harness (v2.1); the variant runs them
 * all in the shared mini-swe-agent Bash harness (v2.0). A model that has not finished every task is left out until it has.
 */
import type { Benchmark, RawRow, ScrapeResult, Source } from "../../../src/data/types";

const SITE = "https://labs.ramp.com/swebench", DATA = "https://labs.ramp.com/swebench/v2/data";
export const RAMP_SWEBENCH_ID = "ramp-swebench-v2", RAMP_SWEBENCH_BASH_ID = "ramp-swebench-v2-bash";
const EFFORT = /-(none|minimal|low|medium|high|xhigh|max)$/;

/** RFC 4180 records: quoted fields may hold commas, quotes and newlines. */
function records(csv: string): string[][] {
  const out: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (quoted) { if (c !== '"') cell += c; else if (csv[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
    else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell.replace(/\r$/, "")); out.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  return out;
}
const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined;

export function parseRampSweBench(csv: string, benchmarkId: string): { rows: RawRow[]; updated?: string; tasks: number; skipped: string[] } {
  const [head, ...lines] = records(csv), at = new Map((head ?? []).map((h, i) => [h, i]));
  for (const name of ["instance_id", "model", "harness", "resolved", "timestamp", "agent_cost_usd", "agent_elapsed", "agent_completion_tokens"]) if (!at.has(name)) throw new Error(`Ramp SWE-Bench: column ${name} missing`);
  const get = (r: string[], name: string) => r[at.get(name)!] ?? "", num = (r: string[], name: string) => { const t = get(r, name); return t === "" || !Number.isFinite(Number(t)) ? undefined : Number(t); };
  const byModel = new Map<string, string[][]>();
  for (const r of lines) if (get(r, "model")) (byModel.get(get(r, "model")) ?? byModel.set(get(r, "model"), []).get(get(r, "model"))!).push(r);
  const tasks = new Set(lines.map((r) => get(r, "instance_id"))).size, rows: RawRow[] = [], skipped: string[] = [];
  let updated = "";
  for (const [model, runs] of byModel) {
    if (new Set(runs.map((r) => get(r, "instance_id"))).size < tasks) { skipped.push(model); continue; }
    const key = model.split("/").pop()!, effort = key.match(EFFORT)?.[1], solved = runs.filter((r) => /^(true|1)$/i.test(get(r, "resolved"))).length;
    const share = solved / runs.length, half = 1.96 * Math.sqrt(share * (1 - share) / runs.length) * 100, value = +(share * 100).toFixed(2), defined = (name: string) => runs.flatMap((r) => { const v = num(r, name); return v == null ? [] : [v]; });
    for (const r of runs) if (get(r, "timestamp") > updated) updated = get(r, "timestamp");
    const elapsed = mean(defined("agent_elapsed")), output = mean(defined("agent_completion_tokens")), cost = mean(defined("agent_cost_usd"));
    rows.push({
      benchmarkId, modelLabel: key.replace(EFFORT, ""), effort, value, ci: [Math.max(0, +(value - half).toFixed(2)), Math.min(100, +(value + half).toFixed(2))], sourceUrl: SITE, sourceModelId: model, harness: get(runs[0], "harness"), labHint: model.split("/")[0],
      ...(cost != null ? { costUsd: +cost.toFixed(4) } : {}), ...(elapsed != null ? { durationSec: Math.round(elapsed) } : {}), ...(output != null ? { outputTokens: Math.round(output) } : {}),
      note: `${solved} of ${runs.length} tasks resolved in one attempt; ${get(runs[0], "harness")}`,
    });
  }
  return { rows: rows.sort((a, b) => b.value - a.value), updated: updated.slice(0, 10) || undefined, tasks, skipped };
}

const board = (id: string, name: string, shortName: string, description: string, updated?: string, variant?: Pick<Benchmark, "variantOf" | "variantLabel">): Benchmark => ({
  id, name, shortName, sourceId: "ramp-swebench", url: SITE, description, unit: "percent", higherIsBetter: true, category: "coding", normalization: { kind: "linear", min: 0, max: 100 }, eligibleForDefault: false, defaultWeight: 0, ...(updated ? { lastUpdated: updated } : {}), ...variant,
});

const source: Source = {
  id: "ramp-swebench", name: "Ramp SWE-Bench", url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const [native, bash] = await Promise.all([ctx.fetchText(`${DATA}/v21/results.csv`), ctx.fetchText(`${DATA}/results.csv`)]);
    const a = parseRampSweBench(native, RAMP_SWEBENCH_ID), b = parseRampSweBench(bash, RAMP_SWEBENCH_BASH_ID);
    if (a.rows.length < 5 || b.rows.length < 5) throw new Error(`Ramp SWE-Bench: only ${a.rows.length} native and ${b.rows.length} Bash models`);
    return {
      benchmarks: [
        board(RAMP_SWEBENCH_ID, "Ramp SWE-Bench v2", "Ramp SWE-Bench", `${a.tasks} software tasks built from work Ramp's engineers shipped to production, each model in its lab's own coding harness. Share resolved in one attempt at high reasoning effort.`, a.updated),
        board(RAMP_SWEBENCH_BASH_ID, "Ramp SWE-Bench v2 (Bash harness)", "Ramp SWE-Bench Bash", `The same ${b.tasks} tasks with every model in one shared mini-swe-agent Bash harness. Share resolved in one attempt at high reasoning effort.`, b.updated, { variantOf: RAMP_SWEBENCH_ID, variantLabel: "Shared Bash harness" }),
      ],
      rows: [...a.rows, ...b.rows], raw: { "native-results.csv": native, "bash-results.csv": bash },
      notes: [`${a.rows.length} native and ${b.rows.length} Bash models over ${a.tasks} tasks${[...a.skipped, ...b.skipped].length ? `; unfinished: ${[...a.skipped, ...b.skipped].join(", ")}` : ""}`],
    };
  },
};
export default source;
