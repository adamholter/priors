import { describe, expect, it } from "vitest";
import { appendRealIndex, realIndexSupplement } from "./real-index";
import type { Snapshot } from "./types";
import resolved from "../../data/real-index-handoff-2026-09-08/resolved-benchmarks.json";

describe("Real Index supplement", () => {
  it("imports only recorded observations and preserves raw provenance", () => {
    const data = realIndexSupplement();
    expect(data.models).toHaveLength(18);
    expect(data.variants).toHaveLength(53);
    expect(data.benchmarks).toHaveLength(34);
    expect(data.observations.filter((o) => o.benchmarkId.startsWith("real-index:"))).toHaveLength(895);
    expect(data.estimates).toHaveLength(414);
    expect(data.estimates?.filter((e) => e.estimateKind === "performance")).toHaveLength(65);
    expect(data.estimates?.every((e) => e.evidence.length > 0 && e.benchmarkId.startsWith("real-index:"))).toBe(true);
    const row = data.observations.find((o) => o.benchmarkId.startsWith("real-index:"))!;
    expect(row.details?.realIndex).toMatchObject({ evidenceKind: "recorded-observation" });
    expect(row.sourceUrl).toMatch(/^https:\/\//);
    expect(row.observedAt).toMatch(/^2026-/);
  });

  it("matches every exported measured normalized value", () => {
    const observations = new Map(realIndexSupplement().observations.filter((o) => o.benchmarkId.startsWith("real-index:")).map((o) => [`${o.variantId}:${o.benchmarkId}`, o.value]));
    const measured = resolved.filter((r) => r.state === "measured");
    expect(measured).toHaveLength(895);
    for (const row of measured) {
      expect(observations.get(`real-index:${row.modelId}:real-index:${row.metricId}`), `${row.modelId} ${row.metricId}`).toBeCloseTo(row.normalizedValue, 10);
    }
  });

  it("crosswalks reviewed source releases at their native effort", () => {
    const data = realIndexSupplement();
    expect(data.observations.some((o) => o.variantId === "gpt-5.6-sol@max" && o.benchmarkId === "terminalbench-4")).toBe(true);
    expect(data.observations.some((o) => o.variantId === "gpt-6-astra@max" && o.benchmarkId === "terminalbench-4")).toBe(true);
    expect(data.observations.some((o) => o.variantId === "muse-spark-1.3@max" && o.benchmarkId === "deepswe-1.1")).toBe(true);
    expect(data.observations.find((o) => o.variantId === "muse-spark-1.3@max")?.details?.realIndex).toMatchObject({ sourceReleaseDate: "2026-07-22" });
  });

  it("adds calibrated raw fallback routes and appends at most once", () => {
    const data = realIndexSupplement();
    const route = data.benchmarks.find((b) => b.id === "real-index:terminal-bench-v4")?.estimationRoutes?.[0];
    expect(route).toMatchObject({ sourceId: "real-index:terminal-bench-2-1", method: "paired-average", pairedCount: 17 });
    expect(route!.factor).toBeGreaterThan(0);
    expect(route!.variantFactors?.["real-index:gpt-5-6-sol-max--low"]).toBe(route!.variantFactors?.["real-index:gpt-5-6-sol-max"]);
    expect(route!.variantFactors?.["real-index:gpt-5-6-sol-max"]).toBeCloseTo(39.8989898989899 / 76.02996254681639, 12);
    const empty: Snapshot = { version: 1, date: "2026-09-08", generatedAt: "", labs: [], models: [], variants: [], benchmarks: [], observations: [], series: [], sources: [] };
    const once = appendRealIndex(empty);
    expect(appendRealIndex(once)).toBe(once);
  });

  it("merges reviewed configurations into canonical variants and leaves historical snapshots untouched", () => {
    const base: Snapshot = {
      version: 1, date: "2026-09-08", generatedAt: "", labs: [],
      models: [{ id: "muse-spark-1.3", name: "Muse Spark 1.3", labId: "other", kind: "llm", reasoning: true, aliases: [] }],
      variants: [{ id: "muse-spark-1.3@max", modelId: "muse-spark-1.3", effort: "max" }],
      benchmarks: [], observations: [], series: [], sources: [],
    };
    const merged = appendRealIndex(base);
    expect(merged.models.filter((m) => /Muse Spark 1\.3/i.test(m.name))).toHaveLength(1);
    expect(merged.variants.filter((v) => v.modelId === "muse-spark-1.3" && v.effort === "max")).toHaveLength(1);
    expect(merged.observations.some((o) => o.variantId === "muse-spark-1.3@max" && o.benchmarkId.startsWith("real-index:"))).toBe(true);
    expect(merged.estimates?.some((o) => o.variantId === "muse-spark-1.3@max")).toBe(true);
    const historical = { ...base, date: "2026-09-07" };
    expect(appendRealIndex(historical)).toBe(historical);
  });

  it("maps reviewed evidence to a unique configured canonical variant", () => {
    const configured = "claude-fable-5.1@max~aa-claude-fable-5-1-3e87c73e";
    const base: Snapshot = {
      version: 1, date: "2026-09-08", generatedAt: "", labs: [],
      models: [{ id: "claude-fable-5.1", name: "Fable 5.1", labId: "anthropic", kind: "llm", reasoning: true, aliases: [] }],
      variants: [{ id: configured, modelId: "claude-fable-5.1", effort: "max" }],
      benchmarks: [], observations: [], series: [], sources: [],
    };
    const merged = appendRealIndex(base);
    expect(merged.models.filter((m) => /Fable 5\.1/i.test(m.name))).toHaveLength(1);
    expect(merged.observations.some((o) => o.variantId === configured && o.benchmarkId === "real-index:terminal-bench-v4")).toBe(true);
    expect(merged.observations.some((o) => o.variantId === "claude-fable-5.1@max")).toBe(false);
    expect(merged.estimates?.some((o) => o.variantId === configured)).toBe(true);
    const route = merged.benchmarks.find((b) => b.id === "real-index:terminal-bench-v4")?.estimationRoutes?.[0];
    expect(route?.variantFactors?.[configured]).toBeCloseTo(57.879999999999995 / 82.78, 12);
    expect(route?.variantFactors?.["real-index:claude-fable-5-1-max"]).toBeUndefined();
  });
});
