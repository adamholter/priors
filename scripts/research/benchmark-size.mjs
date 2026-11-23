// Turns the researched benchmark sizes (one JSON array per batch: {id, tasks, runs, kind, source, quote, confidence}) into the
// RESEARCHED table of src/data/benchmark-size.ts. Low-confidence counts are dropped, so the benchmark stays unknown (neutral).
// Usage: node scripts/research/benchmark-size.mjs <dir with out-*.json> [--write]
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const dir = process.argv[2], write = process.argv.includes("--write");
if (!dir) { console.error("usage: node scripts/research/benchmark-size.mjs <dir> [--write]"); process.exit(1); }
const rows = readdirSync(dir).filter((f) => /^out-\d+\.json$/.test(f)).sort().flatMap((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")));
const sizes = {};
for (const r of rows) {
  if (!r || typeof r.id !== "string" || !Number.isFinite(r.tasks) || r.tasks < 1 || r.confidence === "low") continue;
  if (r.kind !== "tasks" && r.kind !== "votes") continue;
  const out = { tasks: Math.round(r.tasks) };
  if (r.kind === "votes") out.votes = true;
  else if (Number.isFinite(r.runs) && r.runs > 1) out.runs = Math.round(r.runs);
  if (/^https?:\/\/\S+$/.test(String(r.source ?? "").trim())) out.url = String(r.source).trim();
  sizes[r.id] = out;
}
const ids = Object.keys(sizes).sort();
console.log(`${ids.length} sizes from ${rows.length} rows (${ids.filter((id) => sizes[id].votes).length} vote counts)`);
if (write) {
  const file = "src/data/benchmark-size.ts", src = readFileSync(file, "utf8");
  const body = ids.map((id) => `  ${JSON.stringify(id)}: ${JSON.stringify(sizes[id])},`).join("\n");
  const next = src.replace(/(\/\/ GENERATED-START[^\n]*\n)[\s\S]*?(\/\/ GENERATED-END)/, `$1const RESEARCHED: Record<string, BenchmarkSize> = {\n${body}\n};\n$2`);
  writeFileSync(file, next);
}
