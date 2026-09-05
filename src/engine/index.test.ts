import { describe, expect, it } from "vitest";
import type { Snapshot } from "../data/types";
import { LABS } from "../data/normalize";
import { computeIndex, type IndexConfig } from "./index";

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

const base: IndexConfig = { id: "t", name: "t", weights: { swe: 40, term: 40, elo: 20 }, required: [], cutoff: 5, estimateMissing: true, variants: "all" };

describe("computeIndex", () => {
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
