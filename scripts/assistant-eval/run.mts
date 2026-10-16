// Assistant eval: npx tsx scripts/assistant-eval/run.mts [--model openai/gpt-6-luna] [--cases a,b] [--repeat 1] [--budget 3]
// Runs every case through the real agent loop on the pinned snapshot, checks hard requirements, asks
// the LLM grader whether the response is reasonable, and writes results to scripts/assistant-eval/results/.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
for (const l of readFileSync(".env.local", "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const { loadSnapshot } = await import("../../src/data/load");
const { AGENT_MODEL } = await import("../../src/agent/agent");
const { CASES, EVAL_SNAPSHOT, configFor } = await import("./cases");
const { runCase } = await import("./harness");
const { judge, describeRun, JUDGE_MODEL } = await import("./judge");

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const model = arg("model") ?? AGENT_MODEL, only = arg("cases")?.split(","), repeat = Number(arg("repeat") ?? 1), spend = { left: Number(arg("budget") ?? 3) };
const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) throw new Error("OPENROUTER_API_KEY missing from .env.local");
const snapshot = (await loadSnapshot(EVAL_SNAPSHOT))!;
const cases = CASES.filter((c) => !only || only.includes(c.id));

type Row = { id: string; kind: string; run: number; pass: boolean; checks: string[]; score: number; issues: string[]; costUsd: number; seconds: number; transcript: string; tools: string[]; calls: { name: string; args: Record<string, unknown>; result: string }[] };
const rows: Row[] = [];
const queue = cases.flatMap((c) => Array.from({ length: repeat }, (_, run) => ({ c, run })));
async function worker() {
  for (let job = queue.shift(); job; job = queue.shift()) {
    const { c, run } = job, config = configFor(c, snapshot), env = { snapshot, config };
    const r = await runCase({ snapshot, config, prompt: c.prompt, history: c.history, view: { page: "builder", theme: "bone", mode: "system", ...c.view }, model, apiKey: apiKey!, spend });
    const failed = c.checks.map((check) => check(r, env)).filter((x): x is string => !!x);
    const facts = c.facts ? await c.facts(env) : "";
    const v = await judge(c, r, facts, snapshot, apiKey!);
    const row = { id: c.id, kind: c.kind, run, pass: !failed.length && v.pass, checks: failed, score: v.score, issues: v.issues, costUsd: r.costUsd, seconds: r.seconds, transcript: describeRun(r, snapshot), tools: r.tools.map((t) => t.name), calls: r.tools.map((t) => ({ name: t.name, args: t.args, result: JSON.stringify(t.result).slice(0, 600) })) };
    rows.push(row);
    console.log(`${row.pass ? "PASS" : "FAIL"} ${c.id}${repeat > 1 ? ` #${run + 1}` : ""}  grade ${v.score}/5  $${r.costUsd.toFixed(4)}  ${r.seconds.toFixed(0)}s  [${row.tools.join(" → ")}]${failed.length ? `\n     checks: ${failed.join("; ")}` : ""}${!v.pass || v.score < 4 ? `\n     grader: ${v.issues.join("; ")}` : ""}`);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));

const passed = rows.filter((r) => r.pass).length, cost = rows.reduce((s, r) => s + r.costUsd, 0), mean = rows.reduce((s, r) => s + r.score, 0) / rows.length;
console.log(`\n${model}: ${passed}/${rows.length} passed · mean grade ${mean.toFixed(2)} · agent cost $${cost.toFixed(3)} · median ${[...rows].sort((a, b) => a.seconds - b.seconds)[Math.floor(rows.length / 2)]?.seconds.toFixed(0)}s · grader ${JUDGE_MODEL}`);
mkdirSync("scripts/assistant-eval/results", { recursive: true });
const file = `scripts/assistant-eval/results/${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}-${model.replace(/\//g, "_")}.json`;
writeFileSync(file, JSON.stringify({ model, snapshot: EVAL_SNAPSHOT, judge: JUDGE_MODEL, passed, total: rows.length, meanGrade: +mean.toFixed(2), costUsd: +cost.toFixed(4), rows: rows.sort((a, b) => a.id.localeCompare(b.id) || a.run - b.run) }, null, 2));
console.log(`results: ${file}`);
if (passed < rows.length) process.exitCode = 1;
