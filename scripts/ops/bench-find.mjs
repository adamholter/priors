#!/usr/bin/env node
/**
 * Step one of "add this benchmark": is it already here, and where? `npm run bench:find -- gamefeel [hydrogen]`
 * searches the source files, config boards and catalog for the first word, then the live snapshot's benchmarks for it, with
 * row count, last update and version; any further words are models to look for in each match. Also starts the screenshot-to-live
 * timer (`npm run live:wait` reads it) unless --no-timer.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const [query, ...models] = args;
if (!query) { console.error("usage: npm run bench:find -- <benchmark words> [model ...] [--no-timer]"); process.exit(1); }
export const TIMER = path.join(homedir(), ".cache", "priors-bench-timer");
if (!process.argv.includes("--no-timer")) {
  mkdirSync(path.dirname(TIMER), { recursive: true });
  writeFileSync(TIMER, `${Date.now()}\n`);
  console.log(`timer started ${new Date().toLocaleTimeString()}`);
}

const q = query.toLowerCase().replace(/[^a-z0-9]+/g, "");
const grep = (dirs) => { try { return execFileSync("git", ["grep", "-il", "-E", query.replace(/[\s-]+/g, "[ -]?"), "--", ...dirs], { encoding: "utf8" }).trim().split("\n").filter(Boolean); } catch { return []; } };
console.log("\nfiles:");
for (const f of grep(["scripts/scrape/sources", "scripts/scrape/boards", "src/data/catalog"]).filter((f) => !f.endsWith(".test.ts")).slice(0, 15)) console.log(`  ${f}`);

// The live data: the scrape checkout's latest snapshot is what the site serves.
const snapPath = [process.env.PRIORS_SNAPSHOT, path.join(homedir(), "priors-scrape/data/snapshots/latest.json.gz"), "data/snapshots/latest.json.gz"].find((p) => p && existsSync(p));
if (!snapPath) { console.log("\nno snapshot found"); process.exit(0); }
const snap = JSON.parse(gunzipSync(readFileSync(snapPath)).toString("utf8"));
const flat = (s) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const hits = snap.benchmarks.filter((b) => flat(b.id).includes(q) || flat(b.name).includes(q) || flat(b.shortName).includes(q));
const variant = new Map(snap.variants.map((v) => [v.id, v]));
console.log(`\nlive benchmarks (${snap.date}, ${snapPath}):`);
if (!hits.length) console.log("  none: new benchmark (try `npm run board:try -- <url>` for a config-only board)");
for (const b of hits) {
  const obs = snap.observations.filter((o) => o.benchmarkId === b.id);
  console.log(`  ${b.id}  "${b.name}"  source=${b.sourceId}  rows=${obs.length}${b.version ? `  v${b.version}` : ""}${b.lastUpdated ? `  updated ${b.lastUpdated}` : ""}  ${b.url}`);
  for (const m of models) {
    const mm = flat(m), found = obs.filter((o) => flat(variant.get(o.variantId)?.modelId).includes(mm) || flat(o.variantId).includes(mm));
    console.log(`    ${m}: ${found.length ? found.map((o) => `${o.variantId} ${+o.value.toFixed(2)}`).join(", ") : "MISSING"}`);
  }
}
const run = snap.sources.find((r) => hits.some((b) => b.sourceId === r.sourceId));
if (run) console.log(`\nsource ${run.sourceId}: ${run.status}${run.error ? ` (${run.error})` : ""}${run.unknownLabels?.length ? `, unresolved: ${run.unknownLabels.slice(0, 8).join(" | ")}` : ""}`);
