import { describe, expect, it } from "vitest";
import type { Snapshot } from "../data/types";
import { LABS } from "../data/normalize";
import { computeIndex, isBenchmarkRequired, selectVariants, chartVariantMode, type IndexConfig } from "./index";

function snap(): Snapshot {
  const models = [
    { id: "a", name: "A", labId: "anthropic", kind: "llm", reasoning: true, aliases: [], releaseDate: "2026-06-01" },
    { id: "b", name: "B", labId: "openai", kind: "llm", reasoning: true, aliases: [], releaseDate: "2026-05-01" },
    { id: "c", name: "C", labId: "google", kind: "llm", reasoning: false, aliases: [], releaseDate: "2026-07-01" },
    { id: "d", name: "D", labId: "moonshot", kind: "llm", reasoning: false, aliases: [], releaseDate: "2026-04-01" },
    { id: "img", name: "Img", labId: "openai", kind: "image", reasoning: false, aliases: [] },
  ] as Snapshot["models"];
  const variants = [
    { id: "a@high", modelId: "a", effort: "high" }, { id: "a@max", modelId: "a", effort: "max" },
    { id: "b@xhigh", modelId: "b", effort: "xhigh" }, { id: "c@default", modelId: "c", effort: "default" },
    { id: "d@default", modelId: "d", effort: "default" }, { id: "img@default", modelId: "img", effort: "default" },
  ] as Snapshot["variants"];
  const benchmarks = [
    { id: "swe", name: "SWE", sourceId: "s", url: "", description: "", unit: "percent", higherIsBetter: true, category: "coding" },
    { id: "term", name: "Term", sourceId: "s", url: "", description: "", unit: "percent", higherIsBetter: true, category: "agentic" },
    { id: "elo", name: "Elo", sourceId: "s", url: "", description: "", unit: "elo", higherIsBetter: true, category: "agentic" },
    { id: "deep11", name: "Deep 1.1", sourceId: "s", url: "", description: "", unit: "percent", higherIsBetter: true, category: "coding", versionPolicy: { kind: "fallback", fallbackTo: "deep1" } },
    { id: "deep1", name: "Deep 1", sourceId: "s", url: "", description: "", unit: "percent", higherIsBetter: true, category: "coding" },
    { id: "aa-cost-per-task-index", name: "Cost", sourceId: "s", url: "", description: "", unit: "usd", higherIsBetter: false, category: "cost" },
  ] as Snapshot["benchmarks"];
  const o = (benchmarkId: string, variantId: string, value: number, extra: Partial<Snapshot["observations"][0]> = {}) => ({ benchmarkId, variantId, value, observedAt: "", sourceUrl: "", ...extra });
  const observations = [
    o("swe", "a@high", 70), o("swe", "a@max", 80), o("swe", "b@xhigh", 75), o("swe", "c@default", 60), o("swe", "d@default", 40), o("swe", "img@default", 99),
    o("term", "a@high", 60), o("term", "a@max", 72), o("term", "b@xhigh", 78), o("term", "c@default", 55), // d missing term
    o("elo", "a@max", 1500), o("elo", "b@xhigh", 1450), o("elo", "c@default", 1300), o("elo", "d@default", 1200),
    o("deep11", "a@max", 65), o("deep1", "b@xhigh", 60), o("deep1", "c@default", 30), // a via 1.1, b/c via fallback
    o("aa-cost-per-task-index", "a@max", 12), o("aa-cost-per-task-index", "a@high", 4), o("aa-cost-per-task-index", "b@xhigh", 7), o("aa-cost-per-task-index", "c@default", 5), o("aa-cost-per-task-index", "d@default", 2),
  ];
  return { version: 1, date: "2026-09-05", generatedAt: "", labs: LABS, models, variants, benchmarks, observations, series: [], sources: [] };
}

const base: IndexConfig = { id: "t", name: "t", weights: { swe: 40, term: 40, elo: 20 }, required: [], cutoff: 5, estimateMissing: true, variants: "all", effortMatching: "strict" };

describe("computeIndex", () => {
  it("reduces missing lower-effort scores using paired results from other benchmarks", () => {
    const s = snap();
    s.observations = s.observations.filter((o) => !(o.benchmarkId === "term" && o.variantId === "a@high"));
    const r = computeIndex(s, { ...base, weights: { swe: 50, term: 50 }, effortMatching: "calibrated" });
    const a = r.ranked.find((x) => x.variant.id === "a@high")!;
    expect(a.values.find((v) => v.benchmarkId === "term")).toMatchObject({ value: 63, raw: 72, estimated: true, effortFactor: 0.875, evidence: ["swe"] });
    expect(a.coverage).toBe(0.5);
    expect(a.costUsd).toBe(4);
  });
  it("combines multiple measured effort ratios, including unselected benchmarks", () => {
    const s = snap();
    s.observations = s.observations.filter((o) => !(o.benchmarkId === "term" && o.variantId === "a@high"));
    s.observations.push({ benchmarkId: "deep1", variantId: "a@high", value: 40, observedAt: "", sourceUrl: "" }, { benchmarkId: "deep1", variantId: "a@max", value: 80, observedAt: "", sourceUrl: "" });
    const r = computeIndex(s, { ...base, weights: { swe: 50, term: 50 }, effortMatching: "calibrated" });
    const v = r.ranked.find((x) => x.variant.id === "a@high")!.values.find((v) => v.benchmarkId === "term")!;
    expect(v.value).toBeCloseTo(72 * (70 + 40) / (80 + 80));
    expect(v.evidence).toHaveLength(2);
  });
  it("does not copy a maximum score when no paired effort evidence exists", () => {
    const s = snap();
    s.observations = s.observations.filter((o) => !(o.variantId === "a@high" && o.benchmarkId !== "swe") && !(o.variantId === "a@max" && o.benchmarkId === "swe"));
    // term cannot be fabricated for a@high; with only 40% measured it falls below the floor.
    const r = computeIndex(s, { ...base, weights: { swe: 40, term: 60 }, effortMatching: "calibrated" });
    expect(r.ranked.some((r) => r.variant.id === "a@high")).toBe(false);
  });
  it("required is explicit only — strictness and optional no longer gate benchmarks", () => {
    expect(isBenchmarkRequired({ ...base, strictness: 0 }, "term")).toBe(false);
    expect(isBenchmarkRequired({ ...base, strictness: 80 }, "term")).toBe(false);
    expect(isBenchmarkRequired({ ...base, strictness: 100, optional: ["term"] }, "term")).toBe(false);
    expect(isBenchmarkRequired({ ...base, strictness: 0, required: ["term"] }, "term")).toBe(true);
  });
  it("higher strictness requires more effort evidence and maximum disables estimates", () => {
    const s = snap();
    s.observations = s.observations.filter((o) => !(o.benchmarkId === "term" && o.variantId === "a@high"));
    const cfg = { ...base, weights: { swe: 50, term: 50 }, effortMatching: "calibrated" as const };
    expect(computeIndex(s, { ...cfg, strictness: 50 }).ranked.some((r) => r.variant.id === "a@high")).toBe(true);
    expect(computeIndex(s, { ...cfg, strictness: 80 }).ranked.some((r) => r.variant.id === "a@high")).toBe(false);
    expect(computeIndex(s, { ...cfg, strictness: 100 }).ranked.some((r) => r.variant.id === "a@high")).toBe(false);
  });
  it("bar and Pareto effort modes are independent and selecting does not mutate results", () => {
    const r = computeIndex(snap(), { ...base, weights: { swe: 100 } });
    const before = structuredClone(r.ranked);
    expect(chartVariantMode(base, "ranking")).toBe("best");
    expect(chartVariantMode(base, "pareto")).toBe("all");
    expect(selectVariants(r.ranked, "best").filter((r) => r.model.id === "a")).toHaveLength(1);
    expect(selectVariants(r.ranked, "all").filter((r) => r.model.id === "a")).toHaveLength(2);
    expect(r.ranked).toEqual(before);
  });
  it("fills effort gaps by default, without inventing scores or borrowing another model", () => {
    const s = snap();
    s.observations = s.observations.filter((o) => !(o.benchmarkId === "term" && o.variantId === "a@max"));
    const r = computeIndex(s, { ...base, weights: { swe: 50, term: 50 }, effortMatching: undefined });
    const a = r.ranked.find((x) => x.variant.id === "a@max")!;
    expect(a).toBeDefined();
    expect(a.score).toBeCloseTo((80 + 60 * 80 / 70) / 2);
    expect(a.values.find((v) => v.benchmarkId === "term")).toMatchObject({ raw: 60, estimated: true, substituted: true, sourceVariantId: "a@high", evidence: ["swe"] });
    expect(a.costUsd).toBe(12);
    expect(a.mixedEfforts).toBe(true);
    // d has only swe measured (50% >= 50% floor): ranked on swe alone, term left out.
    expect(r.ranked.find((x) => x.model.id === "d")?.values.map((v) => v.benchmarkId)).toEqual(["swe"]);
  });
  it("prefers exact effort and picks nearest effort deterministically, not the highest score", () => {
    const s = snap();
    s.variants.push({ id: "a@xhigh", modelId: "a", effort: "xhigh" });
    s.observations.push({ benchmarkId: "swe", variantId: "a@xhigh", value: 75, observedAt: "", sourceUrl: "https://example.com/eval" });
    const cfg = { ...base, weights: { swe: 50, term: 50 }, effortMatching: "nearest" as const };
    const r = computeIndex(s, cfg);
    const a = r.ranked.find((x) => x.variant.id === "a@xhigh")!;
    expect(a.values.find((v) => v.benchmarkId === "term")).toMatchObject({ raw: 60, sourceVariantId: "a@high", substituted: true });
    expect(a.values.find((v) => v.benchmarkId === "swe")).toMatchObject({ raw: 75, sourceVariantId: "a@xhigh", substituted: false, sourceUrl: "https://example.com/eval" });
    expect(a.costUsd).toBeUndefined();
  });
  it("keeps version fallback independent from effort matching", () => {
    const s = snap();
    s.observations.push({ benchmarkId: "deep1", variantId: "a@high", value: 45, observedAt: "", sourceUrl: "" });
    const r = computeIndex(s, { ...base, weights: { deep11: 100 }, effortMatching: "nearest" });
    expect(r.ranked.find((x) => x.variant.id === "a@high")?.values[0]).toMatchObject({ raw: 45, from: "deep1", substituted: false });
  });
  it("does not combine a high-effort score with a max-effort score to pass requirements", () => {
    const s = snap();
    s.observations = s.observations.filter((o) => !(o.benchmarkId === "term" && o.variantId === "a@max"));
    const config = { ...base, weights: { swe: 50, term: 50 }, variants: "best" as const, required: ["term"] };
    const r = computeIndex(s, config);
    expect(r.ranked.find((x) => x.model.id === "a")?.variant.id).toBe("a@high");
    expect(r.excluded.find((x) => x.variant.id === "a@max")?.missing).toEqual(["term"]);
  });
  it("ranks variants, excludes non-LLMs, and applies the coverage floor", () => {
    const r = computeIndex(snap(), base);
    expect(r.ranked.map((x) => x.variant.id)).not.toContain("img@default");
    expect(r.ranked[0].variant.id).toBe("a@max"); // 80.8 vs b 77.9
    expect(r.ranked.map((x) => x.variant.id)).toContain("d@default"); // swe+elo = 60% measured
    expect(r.ranked.map((x) => x.variant.id)).toContain("a@high"); // swe+term = 80% measured
    expect(r.ranked[0].rank).toBe(1);
  });
  it("elo becomes a win rate against the median model, so the leader is not pinned at 100", () => {
    const r = computeIndex(snap(), base);
    const elo = (id: string) => r.ranked.find((x) => x.variant.id === id)!.values.find((v) => v.benchmarkId === "elo")!.value;
    expect(elo("a@max")).toBeGreaterThan(50);
    expect(elo("a@max")).toBeLessThan(100);
    expect(elo("a@max")).toBeGreaterThan(elo("c@default"));
  });
  it("estimates a small-share missing benchmark instead of excluding", () => {
    const cfg = { ...base, weights: { swe: 60, elo: 36, term: 4 } }; // term share 4% < cutoff
    const r = computeIndex(snap(), cfg);
    const d = r.ranked.find((x) => x.variant.id === "d@default")!;
    expect(d).toBeTruthy();
    const t = d.values.find((v) => v.benchmarkId === "term")!;
    expect(t.estimated).toBe(true);
    expect(t.value).toBeGreaterThan(20); expect(t.value).toBeLessThan(70);
    expect(d.coverage).toBeCloseTo(0.96, 2);
  });
  it("renormalizes instead of estimating when disabled", () => {
    const cfg = { ...base, weights: { swe: 60, elo: 36, term: 4 }, estimateMissing: false };
    const d = computeIndex(snap(), cfg).ranked.find((x) => x.variant.id === "d@default")!;
    expect(d.values.some((v) => v.estimated)).toBe(false);
    expect(d.values.length).toBe(2);
  });
  it("explicit required overrides cutoff", () => {
    const cfg = { ...base, weights: { swe: 60, elo: 36, term: 4 }, required: ["term"] };
    expect(computeIndex(snap(), cfg).excluded.map((x) => x.variant.id)).toContain("d@default");
  });
  it("fallback version chain resolves", () => {
    const cfg = { ...base, weights: { deep11: 100 } };
    const r = computeIndex(snap(), cfg);
    const b = r.ranked.find((x) => x.variant.id === "b@xhigh")!;
    expect(b.values[0].from).toBe("deep1");
    expect(r.ranked.find((x) => x.variant.id === "a@max")!.values[0].from).toBe("deep11");
  });
  it("uses explicit paired calibration as estimated evidence and strict mode rejects it", () => {
    const s = snap();
    s.benchmarks.push({ id: "preferred", name: "Preferred", sourceId: "s", url: "", description: "", unit: "score", higherIsBetter: true, category: "coding", normalization: { kind: "linear", min: 0, max: 100 }, estimationRoutes: [{ sourceId: "term", factor: 0.5, method: "paired-average", pairedCount: 8, evidenceId: "calibration:test" }] });
    const loose = computeIndex(s, { ...base, weights: { preferred: 100 }, cutoff: 101 });
    const fallback = loose.ranked.find((r) => r.variant.id === "a@max")?.values[0];
    expect(fallback).toMatchObject({ value: 36, estimated: true, estimateKind: "calibrated-fallback", from: "term", evidence: ["calibration:test", "8 paired configurations"] });
    expect(fallback?.raw).toBeUndefined();
    expect(loose.ranked.find((r) => r.variant.id === "a@max")?.mixedEfforts).toBe(false);
    const strict = computeIndex(s, { ...base, weights: { preferred: 100 }, strictness: 100, optional: ["preferred"] });
    expect(strict.ranked).toHaveLength(0);
  });
  it("marks pareto frontier by measured cost", () => {
    const r = computeIndex(snap(), base);
    const f = r.ranked.filter((x) => x.onFrontier).map((x) => x.variant.id).sort();
    // costs: d 2 (26.7), a@high 4 (65), c 5 (52.7, dominated by a@high), b 7 (77.9), a@max 12 (80.8)
    expect(f).toEqual(["a@high", "a@max", "b@xhigh", "d@default"]);
    const r2 = computeIndex(snap(), { ...base, weights: { swe: 100 } }); // a@high (4, 70) now eligible; c (5, 60) dominated
    expect(r2.ranked.find((x) => x.variant.id === "c@default")!.onFrontier).toBe(false);
    expect(r2.ranked.find((x) => x.variant.id === "a@high")!.onFrontier).toBe(true);
  });
  it("best-variant mode collapses efforts", () => {
    const r = computeIndex(snap(), { ...base, variants: "best" });
    expect(r.ranked.filter((x) => x.model.id === "a").length).toBe(1);
  });
  it("excludes variants below the strictness coverage floor", () => {
    const s = snap();
    // c keeps only swe (40% of weight): below the 50% floor; d keeps swe+elo (60%).
    s.observations = s.observations.filter((o) => o.variantId !== "c@default" || o.benchmarkId === "swe");
    const r = computeIndex(s, base);
    const c = r.excluded.find((x) => x.variant.id === "c@default");
    expect(c?.reason).toBe("coverage");
    expect(c?.measuredShare).toBeCloseTo(0.4);
    expect(r.ranked.map((x) => x.variant.id)).toContain("d@default");
    expect(r.ranked.find((x) => x.variant.id === "d@default")?.measuredShare).toBeCloseTo(0.6);
  });
  it("strictness 0 ranks a variant with a single measured benchmark", () => {
    const s = snap();
    s.observations = s.observations.filter((o) => o.variantId !== "c@default" || o.benchmarkId === "swe");
    const r = computeIndex(s, { ...base, strictness: 0 });
    expect(r.ranked.map((x) => x.variant.id)).toContain("c@default");
  });
  it("required still excludes even when coverage passes", () => {
    const r = computeIndex(snap(), { ...base, required: ["term"] });
    const d = r.excluded.find((x) => x.variant.id === "d@default");
    expect(d?.reason).toBe("required");
    expect(d?.missing).toEqual(["term"]);
    expect(d?.measuredShare).toBeCloseTo(0.6);
  });
  it("defaults the release filter to six months before the snapshot date", () => {
    const s = snap();
    s.models.find((m) => m.id === "b")!.releaseDate = "2026-02-01"; // ~7 months before the 2026-09-05 snapshot
    s.models.find((m) => m.id === "d")!.releaseDate = "2026-04-10"; // ~5 months before
    const r = computeIndex(s, base);
    expect(r.ranked.map((x) => x.model.id)).not.toContain("b");
    expect(r.ranked.map((x) => x.model.id)).toContain("d");
    const all = computeIndex(s, { ...base, releasedAfter: "" });
    expect(all.ranked.map((x) => x.model.id)).toContain("b");
  });
});

it("onlyModels allowlist ranks only those models but keeps the candidate pool", () => {
  const r = computeIndex(snap(), { ...base, onlyModels: ["a"] });
  expect(new Set(r.ranked.map((x) => x.model.id))).toEqual(new Set(["a"]));
  expect(r.candidateModelIds).toEqual(expect.arrayContaining(["a", "b", "c", "d"]));
});
