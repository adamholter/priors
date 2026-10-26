import { describe, expect, it } from "vitest";
import type { Snapshot } from "../data/types";
import { LABS } from "../data/normalize";
import { computeIndex, type IndexConfig } from "./index";

/** T has no score on `g`. X1/X2 match T on the two mix benchmarks but differ everywhere else; Y1/Y2 are the reverse. */
function fixture(): Snapshot {
  const ids = ["t", "x1", "x2", "y1", "y2"];
  const models = ids.map((id) => ({ id, name: id.toUpperCase(), labId: "openai", kind: "llm", reasoning: false, aliases: [] })) as Snapshot["models"];
  const variants = ids.map((id) => ({ id: `${id}@default`, modelId: id, effort: "default" })) as Snapshot["variants"];
  const bench = (id: string) => ({ id, name: id, sourceId: "s", url: "", description: "", unit: "percent", higherIsBetter: true, category: "coding" });
  const panelIds = Array.from({ length: 10 }, (_, i) => `p${i}`);
  const benchmarks = ["m1", "m2", "g", ...panelIds].map(bench) as Snapshot["benchmarks"];
  const observations: Snapshot["observations"] = [];
  const put = (variant: string, benchmarkId: string, value: number) => observations.push({ benchmarkId, variantId: `${variant}@default`, value, observedAt: "", sourceUrl: "" });
  const rows: Record<string, { mix: number; panel: number; g?: number }> = {
    t: { mix: 50, panel: 40 }, x1: { mix: 50, panel: 80, g: 20 }, x2: { mix: 51, panel: 82, g: 22 }, y1: { mix: 60, panel: 40, g: 45 }, y2: { mix: 61, panel: 42, g: 47 },
  };
  for (const [id, r] of Object.entries(rows)) {
    put(id, "m1", r.mix); put(id, "m2", r.mix);
    panelIds.forEach((p) => put(id, p, r.panel));
    if (r.g != null) put(id, "g", r.g);
  }
  return { version: 1, date: "2026-09-05", generatedAt: "", labs: LABS, models, variants, benchmarks, observations, series: [], sources: [] };
}
const config: IndexConfig = { id: "t", name: "t", weights: { m1: 30, m2: 30, g: 40 }, required: [], optional: ["g"], cutoff: 5, estimateMissing: true, variants: "all", effortMatching: "strict", strictness: 50, releasedAfter: "" };
const gOf = (view?: Parameters<typeof computeIndex>[2]) => computeIndex(fixture(), config, view).ranked.find((r) => r.model.id === "t")!.values.find((v) => v.benchmarkId === "g")!;

describe("peer estimates", () => {
  it("matching on the whole panel pulls the estimate toward the models T resembles elsewhere", () => {
    const mix = gOf({ peerMethod: "mix" }), blend = gOf();
    expect(mix.value).toBeLessThan(30); // the two models closest on the mix
    expect(blend.value).toBeGreaterThan(mix.value + 8);
    expect(blend.value).toBeLessThan(46);
  });
  it("reports the donors that produced it, heaviest first, and a range around the value", () => {
    const v = gOf();
    expect(v).toMatchObject({ estimated: true, estimateKind: "peer" });
    expect(v.donors!.map((d) => d.variantId.split("@")[0]).sort()).toEqual(["x1", "x2", "y1", "y2"]);
    expect(v.donors!.reduce((a, d) => a + d.weight, 0)).toBeCloseTo(1, 5);
    expect(v.donors![0].weight).toBeGreaterThanOrEqual(v.donors![1].weight);
    const [lo, hi] = v.estimateRange!;
    expect(lo).toBeLessThanOrEqual(v.value); expect(hi).toBeGreaterThanOrEqual(v.value);
    expect(hi - lo).toBeGreaterThanOrEqual(3);
  });
  it("needs eight shared panel benchmarks, otherwise the blend is the mix match", () => {
    const s = fixture();
    s.observations = s.observations.filter((o) => !/^p[3-9]$/.test(o.benchmarkId));
    const v = computeIndex(s, config).ranked.find((r) => r.model.id === "t")!.values.find((x) => x.benchmarkId === "g")!;
    expect(v.value).toBeCloseTo(gOf({ peerMethod: "mix" }).value, 5);
  });
  it("never estimates when strictness is 100", () => {
    const r = computeIndex(fixture(), { ...config, strictness: 100 }).ranked.find((x) => x.model.id === "t");
    expect(r?.values.some((x) => x.estimated) ?? false).toBe(false);
  });
});
