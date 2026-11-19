// Turns the researched facts (one JSON array per batch, see docs/data.md "Benchmark facts") into the RESEARCHED table of
// src/data/benchmark-facts.ts. A batch's checked file (`batch-NN.verified.json`) wins over its first pass (`batch-NN.json`).
// Usage: node scripts/research/benchmark-facts.mjs <dir with batch-*.json> [--write]
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const dir = process.argv[2], write = process.argv.includes("--write");
if (!dir) { console.error("usage: node scripts/research/benchmark-facts.mjs <dir> [--write]"); process.exit(1); }
const files = readdirSync(dir).filter((f) => /^batch-\d+(\.verified)?\.json$/.test(f)).sort();
const batches = new Map();
for (const f of files) { const n = f.match(/^batch-(\d+)/)[1]; if (!batches.has(n) || f.includes("verified")) batches.set(n, f); }
const TEST = new Set(["public", "partial", "private"]), GRADING = new Set(["automatic", "llm-judge", "human-judge", "human-votes", "mixed"]);
const today = new Date().toISOString().slice(0, 10);
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const facts = {}, skipped = [];
for (const [n, f] of [...batches].sort()) {
  let rows;
  try { rows = JSON.parse(readFileSync(path.join(dir, f), "utf8")); } catch (e) { skipped.push(`${f}: ${e.message}`); continue; }
  if (!Array.isArray(rows)) { skipped.push(`${f}: not an array`); continue; }
  for (const r of rows) {
    if (!r || typeof r.id !== "string") continue;
    const out = {};
    // A guess nobody could confirm is left unknown.
    const sure = r.confidence !== "low" || r.verified === true;
    if (TEST.has(r.openness) && sure) {
      out.test = r.openness;
      const note = clean(r.openness_note); if (note) out.testNote = note.length > 240 ? `${note.slice(0, 237)}...` : note;
      if (/^https?:\/\/\S+$/.test(clean(r.openness_url))) out.testUrl = clean(r.openness_url);
    }
    if (r.task_set === "refreshed") out.refreshed = true;
    const d = clean(r.release_date);
    if (/^\d{4}-\d{2}(-\d{2})?$/.test(d) && d >= "2015" && d <= today) out.released = d;
    if (GRADING.has(r.grading)) out.grading = r.grading;
    if (r.runs === "self-reported") out.selfReported = true;
    if (Object.keys(out).length) facts[r.id] = out;
  }
  void n;
}
const ids = Object.keys(facts).sort();
const count = (k, v) => ids.filter((id) => facts[id][k] === v).length;
console.log(`${ids.length} benchmarks from ${batches.size} batches (${[...batches.values()].filter((f) => f.includes("verified")).length} checked)`);
console.log(`test set: ${count("test", "public")} public, ${count("test", "partial")} partial, ${count("test", "private")} private, ${ids.filter((id) => !facts[id].test).length} unknown`);
console.log(`released: ${ids.filter((id) => facts[id].released).length}; grading: ${ids.filter((id) => facts[id].grading).length}; refreshed: ${count("refreshed", true)}; self-reported: ${count("selfReported", true)}`);
if (skipped.length) console.log(`skipped: ${skipped.join("; ")}`);
if (write) {
  const file = path.resolve("src/data/benchmark-facts.ts"), src = readFileSync(file, "utf8");
  const body = ids.map((id) => `  ${JSON.stringify(id)}: ${JSON.stringify(facts[id])},`).join("\n");
  const next = src.replace(/(\/\/ GENERATED-START[^\n]*\n)[\s\S]*?(\/\/ GENERATED-END)/, (_, a, b) => `${a}const RESEARCHED: Record<string, BenchmarkFacts> = {\n${body}\n};\n${b}`);
  if (next === src) { console.error("markers not found"); process.exit(1); }
  writeFileSync(file, next);
  console.log(`wrote ${file}`);
}
