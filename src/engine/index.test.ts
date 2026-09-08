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
    const r = computeIndex(s, { ...base, weights: { swe: 50, term: 50 }, effortMatching: "calibrated" });
    expect(r.ranked.some((r) => r.variant.id === "a@high")).toBe(false);
  });
  it("strictness controls automatic requirements while manual choices win", () => {
    expect(isBenchmarkRequired({ ...base, strictness: 0 }, "term", 20)).toBe(false);
    expect(isBenchmarkRequired({ ...base, strictness: 80 }, "term", 20)).toBe(true);
    expect(isBenchmarkRequired({ ...base, strictness: 100, optional: ["term"] }, "term", 20)).toBe(false);
    expect(isBenchmarkRequired({ ...base, strictness: 0, required: ["term"] }, "term", 1)).toBe(true);
    const r = computeIndex(snap(), { ...base, strictness: 100, optional: ["term"] });
    expect(r.ranked.some((r) => r.model.id === "d")).toBe(true);
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
    expect(r.excluded.find((x) => x.model.id === "d")?.missing).toContain("term");
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
    const config = { ...base, weights: { swe: 50, term: 50 }, variants: "best" as const };
    const r = computeIndex(s, config);
    expect(r.ranked.find((x) => x.model.id === "a")?.variant.id).toBe("a@high");
    expect(r.excluded.find((x) => x.variant.id === "a@max")?.missing).toEqual(["term"]);
  });
  it("ranks variants, excludes non-LLMs, implicit required via cutoff", () => {
    const r = computeIndex(snap(), base);
    expect(r.ranked.map((x) => x.variant.id)).not.toContain("img@default");
    // term has 40% share > 5% cutoff -> required; d lacks term -> excluded
    expect(r.excluded.map((x) => x.variant.id)).toContain("d@default");
    expect(r.ranked[0].variant.id).toBe("a@max"); // 80.8 vs b 77.9
    expect(r.excluded.map((x) => x.variant.id)).toContain("a@high"); // missing elo (20% share)
    expect(r.ranked[0].rank).toBe(1);
  });
  it("elo is min-max normalized to 0-100", () => {
    const r = computeIndex(snap(), base);
    const a = r.ranked.find((x) => x.variant.id === "a@max")!.values.find((v) => v.benchmarkId === "elo")!;
    expect(a.value).toBe(100);
    expect(r.ranked.find((x) => x.variant.id === "c@default")!.values.find((v) => v.benchmarkId === "elo")!.value).toBeCloseTo(33.3, 0);
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
    // costs: c 5 (52.7), b 7 (77.9), a@max 12 (80.8): each cheaper point scores lower -> all on frontier
    expect(f).toEqual(["a@max", "b@xhigh", "c@default"]);
    const r2 = computeIndex(snap(), { ...base, weights: { swe: 100 } }); // a@high (4, 70) now eligible; c (5, 60) dominated
    expect(r2.ranked.find((x) => x.variant.id === "c@default")!.onFrontier).toBe(false);
    expect(r2.ranked.find((x) => x.variant.id === "a@high")!.onFrontier).toBe(true);
  });
  it("best-variant mode collapses efforts", () => {
    const r = computeIndex(snap(), { ...base, variants: "best" });
    expect(r.ranked.filter((x) => x.model.id === "a").length).toBe(1);
  });
});
