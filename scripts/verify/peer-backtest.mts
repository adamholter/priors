/**
 * Leave-one-out backtest for peer estimates: hide one measured score, let the engine estimate it from a
 * three-benchmark mix, and compare with the truth. Run: npx tsx scripts/verify/peer-backtest.mts [snapshot.json]
 * Reads data/snapshots/latest.json.gz unless given a path to a snapshot (or {snapshot}) JSON file.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { computeIndex, type IndexConfig } from "../../src/engine/index";
import type { Snapshot } from "../../src/data/types";

const path = process.argv[2] ?? "data/snapshots/latest.json.gz";
const raw = path.endsWith(".gz") ? gunzipSync(readFileSync(path)).toString() : readFileSync(path, "utf8");
const parsed = JSON.parse(raw);
const snap: Snapshot = parsed.snapshot ?? parsed;

const pct = snap.benchmarks.filter((b) => b.unit === "percent" && b.higherIsBetter && !b.proxy && !["cost", "speed", "composite"].includes(b.category));
const byBench = new Map<string, typeof snap.observations>();
for (const o of snap.observations) { if (!pct.some((b) => b.id === o.benchmarkId)) continue; (byBench.get(o.benchmarkId) ?? byBench.set(o.benchmarkId, []).get(o.benchmarkId)!).push(o); }
const targets = [...byBench.entries()].filter(([, o]) => new Set(o.map((x) => x.variantId.split("@")[0])).size >= 12).sort((a, b) => b[1].length - a[1].length).slice(0, 12);
const count = (vid: string) => pct.filter((b) => byBench.get(b.id)?.some((o) => o.variantId === vid)).map((b) => b.id);

type Row = { bench: string; variant: string; truth: number; mix: number; blend: number; low: number; high: number };
const rows: Row[] = [];
for (const [bid, obs] of targets) {
  const sample = obs.filter((_, i) => i % Math.max(1, Math.floor(obs.length / 14)) === 0).slice(0, 14);
  for (const o of sample) {
    const mixIds = count(o.variantId).filter((b) => b !== bid).sort((a, b) => byBench.get(b)!.length - byBench.get(a)!.length).slice(0, 3);
    if (mixIds.length < 3) continue;
    const hidden: Snapshot = { ...snap, observations: snap.observations.filter((x) => !(x.benchmarkId === bid && x.variantId === o.variantId)) };
    const cfg: IndexConfig = { id: "bt", name: "bt", weights: { [bid]: 25, ...Object.fromEntries(mixIds.map((b) => [b, 25])) }, required: [], optional: [bid], cutoff: 1000, estimateMissing: true, variants: "all", effortMatching: "strict", strictness: 50, releasedAfter: "" };
    const pick = (method: "mix" | "blend") => computeIndex(hidden, cfg, { peerMethod: method }).ranked.find((r) => r.variant.id === o.variantId)?.values.find((v) => v.benchmarkId === bid);
    const a = pick("mix"), b = pick("blend");
    if (a?.estimateKind !== "peer" || b?.estimateKind !== "peer" || !b.estimateRange) continue;
    rows.push({ bench: bid, variant: o.variantId, truth: o.value, mix: a.value, blend: b.value, low: b.estimateRange[0], high: b.estimateRange[1] });
  }
}
const mean = (x: number[]) => x.reduce((a, c) => a + c, 0) / x.length;
const err = (f: (r: Row) => number) => rows.map((r) => Math.abs(f(r) - r.truth));
const inside = rows.filter((r) => r.truth >= r.low && r.truth <= r.high).length / rows.length;
console.log(`n=${rows.length} across ${new Set(rows.map((r) => r.bench)).size} benchmarks`);
console.log(`mean abs error  mix ${mean(err((r) => r.mix)).toFixed(2)}  blend ${mean(err((r) => r.blend)).toFixed(2)}`);
console.log(`median abs error mix ${err((r) => r.mix).sort((a, b) => a - b)[Math.floor(rows.length / 2)].toFixed(2)}  blend ${err((r) => r.blend).sort((a, b) => a - b)[Math.floor(rows.length / 2)].toFixed(2)}`);
console.log(`truth inside blend range: ${(inside * 100).toFixed(0)}%  mean half-width ${mean(rows.map((r) => (r.high - r.low) / 2)).toFixed(2)}`);
for (const [bid] of targets) { const r = rows.filter((x) => x.bench === bid); if (r.length) console.log(bid.padEnd(40), r.length, "mix", mean(r.map((x) => Math.abs(x.mix - x.truth))).toFixed(2), "blend", mean(r.map((x) => Math.abs(x.blend - x.truth))).toFixed(2)); }
