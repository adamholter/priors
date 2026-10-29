import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import type { Snapshot } from "../data/types";
import { metricPanels, pickPoints } from "../lib/metrics";
import { computeIndex, defaultConfig, filterEfforts, PAGE_VIEW, type IndexResult, type RankedVariant } from "./index";
import { progressEstimates } from "./progress-estimate";

const P = "aa-progress-index-v1";
const model = (id: string) => ({ id, name: id, labId: "lab", kind: "llm" }) as RankedVariant["model"];
const variant = (id: string, effort = "high") => ({ id: `${id}@${effort}`, modelId: id, effort }) as RankedVariant["variant"];
const row = (id: string, score: number, effort = "high") => ({ model: model(id), variant: variant(id, effort), score }) as RankedVariant;
const left = (id: string, effort = "high", reason: "coverage" | "required" = "coverage"): IndexResult["excluded"][number] => ({ variant: variant(id, effort), model: model(id), missing: [], reason, measuredShare: 0.35 });
// Ten scored models on score = exp(0.02 × progress - 3): the shape AA's Progress Index has against its index.
const scored = Array.from({ length: 10 }, (_, i) => ({ id: `m${i}`, progress: 220 + i * 13 }));
const exact = (p: number) => Math.exp(0.02 * p - 3);
const snapshot = (extra: [string, number][] = []) => ({
  benchmarks: [{ id: P }],
  observations: [...scored.map((m) => ({ benchmarkId: P, variantId: `${m.id}@high`, value: m.progress })), ...extra.map(([variantId, value]) => ({ benchmarkId: P, variantId, value }))],
}) as unknown as Snapshot;
const ranked = scored.map((m) => row(m.id, exact(m.progress)));

describe("progressEstimates", () => {
  it("scores a model the index leaves out for coverage from its Progress Index", () => {
    const [e] = progressEstimates(snapshot([["old@high", 250]]), ranked, [left("old")], true);
    expect(e.model.id).toBe("old");
    expect(e.score).toBeCloseTo(exact(250), 6);
    expect(e.scoreEstimate).toMatchObject({ benchmarkId: P, progress: 250, pairs: 10 });
    expect(e.scoreEstimate!.r2).toBeCloseTo(1, 6);
  });
  it("leaves out a model excluded for a required benchmark, one the index already scores, and one above every paired model", () => {
    const snap = snapshot([["req@high", 250], ["m3@low", 240], ["new@high", 400]]);
    expect(progressEstimates(snap, ranked, [left("req", "high", "required"), left("m3", "low"), left("new")], true)).toEqual([]);
  });
  it("needs enough scored models and a close fit", () => {
    expect(progressEstimates(snapshot([["old@high", 250]]), ranked.slice(0, 7), [left("old")], true)).toEqual([]);
    const noisy = ranked.map((r, i) => ({ ...r, score: i % 2 ? 60 : 5 }));
    expect(progressEstimates(snapshot([["old@high", 250]]), noisy, [left("old")], true)).toEqual([]);
  });
  it("keeps each model's best effort unless every effort is wanted", () => {
    const snap = snapshot([["old@high", 250], ["old@low", 230]]);
    expect(progressEstimates(snap, ranked, [left("old"), left("old", "low")], true).map((e) => e.variant.id)).toEqual(["old@high"]);
    expect(progressEstimates(snap, ranked, [left("old"), left("old", "low")], false)).toHaveLength(2);
  });
});

describe("release-date chart on the checked-in snapshot", () => {
  const snap = JSON.parse(gunzipSync(readFileSync("data/snapshots/latest.json.gz")).toString("utf8")) as Snapshot;
  const config = { ...defaultConfig(snap), variants: "all" as const };
  const base = computeIndex(snap, config, PAGE_VIEW);
  // What the highlight menu offers (IndexPage's picker), less models whose every effort the charts' effort filter hides.
  const offered = [...new Set([...base.ranked.map((r) => r.model.id), ...base.candidateModelIds])]
    .filter((id) => snap.models.find((m) => m.id === id)?.releaseDate && filterEfforts(snap.variants.filter((v) => v.modelId === id).map((variant) => ({ variant })), config.efforts).length);

  it("draws every model the highlight menu offers once it is highlighted, estimated when the index cannot score it", () => {
    const r = computeIndex(snap, { ...config, highlight: offered }, PAGE_VIEW);
    const chart = metricPanels(snap, filterEfforts(r.ranked, config.efforts), "aa", filterEfforts(r.estimated, config.efforts)).find((p) => p.id === "date")!.chart!;
    const drawn = pickPoints(chart, filterEfforts(r.ranked, config.efforts), "best");
    expect(offered.filter((id) => !drawn.some((p) => p.r.model.id === id))).toEqual([]);
    expect(drawn.filter((p) => p.r.scoreEstimate).length).toBeGreaterThan(0);
  });
  it("never ranks an estimated model", () => {
    expect(base.estimated.every((e) => !base.ranked.some((r) => r.model.id === e.model.id))).toBe(true);
  });
});
