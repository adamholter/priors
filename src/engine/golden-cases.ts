import type { Snapshot } from "../data/types";
import type { IndexConfig, ViewOptions } from "./index";

/** The configs held to golden outputs (`golden.test.ts`), written by `scripts/verify/engine-goldens.mts`. A change here or to the math regenerates them. */
export const GOLDEN_DATE = "2026-10-31";

const rng = (seed: number) => () => ((seed = Math.imul(seed ^ (seed >>> 15), 1 | seed)), ((seed + Math.imul(seed ^ (seed >>> 7), 61 | seed)) ^ seed) >>> 0) / 4294967296;

export function goldenConfigs(snap: Snapshot, base: IndexConfig, pageView: ViewOptions): { id: string; config: IndexConfig; view?: ViewOptions }[] {
  const B = snap.benchmarks, ids = B.map((b) => b.id);
  const pick = (f: (b: Snapshot["benchmarks"][number]) => boolean, n: number) => B.filter(f).slice(0, n).map((b) => b.id);
  const fallback = pick((b) => b.versionPolicy?.kind === "fallback", 6), routes = pick((b) => !!b.estimationRoutes?.length, 6), elo = pick((b) => b.unit === "elo", 3), usd = pick((b) => b.unit === "usd" || b.unit === "seconds", 3), score = pick((b) => b.unit === "score" || b.unit === "count", 6), pct = pick((b) => b.unit === "percent" && !b.proxy, 40);
  const w = (xs: string[], f = (i: number) => 10 + i * 7) => Object.fromEntries(xs.map((id, i) => [id, f(i)]));
  const wide = w([...fallback, ...routes, ...elo, ...score, ...pct.slice(0, 8)]);
  const llm = snap.models.filter((m) => m.kind === "llm").map((m) => m.id);
  const c = (id: string, o: Partial<IndexConfig>, view?: ViewOptions) => ({ id, config: { ...base, id, name: id, ...o }, view });
  const out = [
    c("default", {}), c("default-page", {}, pageView), c("default-mix", {}, { peerMethod: "mix" }),
    c("wide", { weights: wide }), c("wide-all", { weights: wide, variants: "all", rankingVariants: "all", paretoVariants: "best" }, pageView),
    c("required", { weights: wide, required: pct.slice(0, 2), strictness: 75 }),
    c("no-estimates-strict", { weights: wide, estimateMissing: false, effortMatching: "strict" }),
    c("strict100", { weights: wide, strictness: 100 }),
    c("strict0-alltime", { weights: wide, strictness: 0, variants: "all", releasedAfter: "" }),
    c("strict85", { weights: w(pct.slice(5, 20)), strictness: 85 }), c("strict95", { weights: w(pct.slice(5, 20)), strictness: 95 }), c("strict25", { weights: w(pct.slice(5, 20)), strictness: 25, releasedAfter: "2025-01-01" }),
    c("cutoff", { weights: w(pct.slice(2, 9)), strictness: undefined, cutoff: 1 }),
    c("api-terminalbench", { costBasis: "api", costSource: "terminalbench-4" }), c("subscription-deepswe", { costBasis: "subscription", costSource: "deepswe-1.1" }),
    c("resets", { planResets: true }), c("plans", { planResets: true, subscriptionPlans: { openai: "ChatGPT Pro 20x", anthropic: "Claude Max 20x", google: "Google AI Pro" } }),
    c("labs", { labs: ["openai", "anthropic"] }, pageView), c("exclude", { excludeModels: llm.slice(0, 8) }, pageView), c("only", { onlyModels: llm.slice(-12) }),
    c("highlight", { highlight: llm.slice(-3) }, pageView),
    c("cost-benchmark", { weights: wide }, { costBenchmark: ids.find((i) => snap.observations.some((o) => o.benchmarkId === i && o.costUsd != null)) }),
    c("single-elo", { weights: { [elo[0] ?? ids[0]]: 100 } }), c("single-usd", { weights: { [usd[0] ?? ids[0]]: 100 } }), c("single-alltime", { weights: { [ids[0]]: 1 }, releasedAfter: "", strictness: 0, estimateMissing: false }),
    c("unknown", { weights: { "no-such-benchmark": 5 } }), c("empty", { weights: {} }), c("zero", { weights: { [ids[0]]: 0 } }),
    c("all-benchmarks", { weights: Object.fromEntries(ids.map((i) => [i, 1])) }),
    c("all-benchmarks-probe", { weights: Object.fromEntries(ids.map((i, k) => [i, k % 7 ? 0.5 : 100])) }),
  ];
  const r = rng(12345);
  for (let k = 0; k < 16; k++) {
    const n = 1 + Math.floor(r() * 14), ws: Record<string, number> = {};
    for (let i = 0; i < n; i++) ws[ids[Math.floor(r() * ids.length)]] = 1 + Math.floor(r() * 100);
    out.push(c(`random-${k}`, { weights: ws, required: r() < 0.2 ? [Object.keys(ws)[0]] : [], strictness: [0, 25, 50, 50, 50, 75, 85, 95, 100][Math.floor(r() * 9)], estimateMissing: r() < 0.7, variants: r() < 0.5 ? "best" : "all", effortMatching: (["calibrated", "nearest", "strict", undefined] as const)[Math.floor(r() * 4)], costBasis: r() < 0.5 ? "api" : undefined, releasedAfter: r() < 0.4 ? "" : undefined }, r() < 0.3 ? pageView : undefined));
  }
  return out;
}

export function goldenHistories(snap: Snapshot, base: IndexConfig): { id: string; config: IndexConfig; mode: "fixed" | "adapting" }[] {
  const pct = snap.benchmarks.filter((b) => b.unit === "percent" && !b.proxy).map((b) => b.id), first = snap.models.find((m) => m.kind === "llm")!.id;
  const wide = Object.fromEntries(pct.slice(0, 10).map((id, i) => [id, 10 + i * 7]));
  return [
    { id: "default-fixed", config: base, mode: "fixed" }, { id: "default-adapting", config: base, mode: "adapting" },
    { id: "wide-fixed", config: { ...base, weights: wide }, mode: "fixed" }, { id: "wide-required", config: { ...base, weights: wide, required: [pct[0]] }, mode: "adapting" },
    { id: "alltime-all", config: { ...base, weights: wide, releasedAfter: "", rankingVariants: "all" }, mode: "fixed" },
    { id: "efforts", config: { ...base, rankingEfforts: ["high", "max"], strictness: 75, estimateMissing: false }, mode: "adapting" },
    { id: "labs", config: { ...base, labs: ["openai"], excludeModels: [first] }, mode: "fixed" },
  ];
}

/** A virtual clock, so a fit's path depends on how many times it looks at the time and not on how fast the engine is. */
export async function withVirtualClock<T>(run: () => Promise<T>): Promise<T> {
  const real = performance.now;
  let tick = 0;
  performance.now = () => ++tick;
  try { return await run(); } finally { performance.now = real; }
}
