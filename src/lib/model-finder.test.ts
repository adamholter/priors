import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Snapshot } from "../data/types";
import { decodeIndex } from "./url";
import { affordableModels, buildModelFinder, type ModelFinderVariant } from "./model-finder";

function latestSnapshot(): Snapshot {
  return JSON.parse(gunzipSync(readFileSync("data/snapshots/latest.json.gz")).toString("utf8")) as Snapshot;
}

const row = (id: string, modelId: string, effort: ModelFinderVariant["effort"], score: number, costUsd: number): ModelFinderVariant => ({
  id, modelId, name: modelId, effort, score, measuredBenchmarks: [], measuredShare: 1, costUsd, color: "#000000", labName: "Lab", labId: "other",
});

describe("model finder data", () => {
  it("builds two strictness-50 measured mixes per use case from current benchmarks", () => {
    const snapshot = latestSnapshot();
    const finder = buildModelFinder(snapshot);
    const modelKinds = new Map(snapshot.models.map((model) => [model.id, model.kind]));

    expect(finder.date).toBe(snapshot.date);
    expect(finder.groups.map((group) => group.id)).toEqual(["multimodal", "overall", "coding", "knowledge"]);
    for (const group of finder.groups) {
      expect(group.mixes).toHaveLength(2);
      for (const mix of group.mixes) {
        expect(mix.benchmarks.length).toBeGreaterThan(0);
        expect(mix.benchmarks.reduce((sum, benchmark) => sum + benchmark.share, 0)).toBeCloseTo(100);
        expect(mix.variants.length).toBeGreaterThan(0);
        expect(mix.variants.every((variant) => modelKinds.get(variant.modelId) === "llm")).toBe(true);
        expect(mix.variants.every((variant) => Number.isFinite(variant.costUsd) && variant.costUsd >= 0)).toBe(true);
        const shares = new Map(mix.benchmarks.map((benchmark) => [benchmark.id, benchmark.share]));
        for (const variant of mix.variants) {
          expect(variant.measuredBenchmarks.length).toBeGreaterThan(0);
          expect(variant.measuredBenchmarks.every((id) => shares.has(id))).toBe(true);
          expect(variant.measuredBenchmarks.reduce((sum, id) => sum + (shares.get(id) ?? 0), 0)).toBeGreaterThanOrEqual(50 - 1e-8);
        }

        const encoded = new URL(mix.builderUrl, "https://mypriors.com").searchParams.get("i");
        const config = encoded && decodeIndex(encoded, mix.id);
        expect(config).toMatchObject({ strictness: 50, estimateMissing: false, effortMatching: "strict", variants: "all", releasedAfter: "" });
      }

      const hasEffortCostTradeoff = group.mixes.some((mix) => {
        const byModel = new Map<string, ModelFinderVariant[]>();
        for (const variant of mix.variants) byModel.set(variant.modelId, [...(byModel.get(variant.modelId) ?? []), variant]);
        return [...byModel.values()].some((variants) => new Set(variants.map((variant) => variant.id)).size > 1
          && new Set(variants.map((variant) => variant.costUsd)).size > 1);
      });
      expect(hasEffortCostTradeoff, group.id).toBe(true);
    }
  });

  it("uses a common current coding benchmark instead of ranking disjoint partial mixes", () => {
    const snapshot = latestSnapshot();
    const mixes = buildModelFinder(snapshot).groups.find((group) => group.id === "coding")!.mixes;
    for (const mix of mixes) {
      const config = decodeIndex(new URL(mix.builderUrl, "https://mypriors.com").searchParams.get("i")!, mix.id)!;
      expect(config.required).toHaveLength(1);
      expect(config.required[0]).toMatch(/^aa-terminalbench-v/);
      expect(mix.variants.every((variant) => variant.measuredBenchmarks.includes(config.required[0]))).toBe(true);
      expect(mix.benchmarks.some((benchmark) => ["deepswe-1.1", "weirdml-v2"].includes(benchmark.id))).toBe(false);
    }
  });

  it("lets a half-measured model into the ranking at strictness 50, but only if it measures the shared coding benchmark", () => {
    // Was a live-snapshot assertion that the top five were fully measured; it broke deploys the day a new model
    // (Kimi K3.1, terminal-bench only) scored into the top five. Strictness 50 admits it by design.
    const partial = { ...row("kimi@default", "kimi", "default", 90, 1), measuredShare: 0.5, measuredBenchmarks: ["aa-terminalbench-v4-0"] };
    const full = { ...row("sonnet@max", "sonnet", "max", 80, 2), measuredBenchmarks: ["aa-terminalbench-v4-0", "vals-vibe-code-v1-1"] };
    const ranked = affordableModels([full, partial], null);
    expect(ranked.map((v) => v.modelId)).toEqual(["kimi", "sonnet"]);
    expect(ranked.every((v) => v.measuredBenchmarks.includes("aa-terminalbench-v4-0"))).toBe(true);
  });

  it("moves coding mixes to a new benchmark release instead of reusing old-only observations", () => {
    const snapshot = latestSnapshot();
    const terminal = snapshot.benchmarks.find((benchmark) => benchmark.id === "aa-terminalbench-v4-0")!;
    const future = { ...snapshot, benchmarks: [...snapshot.benchmarks, { ...terminal, id: "aa-terminalbench-v99-0" }] };
    const mixes = buildModelFinder(future).groups.find((group) => group.id === "coding")!.mixes;
    for (const mix of mixes) {
      expect(mix.benchmarks.some((benchmark) => benchmark.id === "aa-terminalbench-v99-0")).toBe(true);
      // None of the old observations can satisfy the new required benchmark.
      expect(mix.variants).toHaveLength(0);
    }
  });

  it("keeps only budget-eligible measured costs and selects one best effort per model", () => {
    const variants = [
      row("a@high", "a", "high", 96, 8),
      row("a@low", "a", "low", 90, 4),
      row("a@medium", "a", "medium", 90, 2),
      row("b@high", "b", "high", 87, 3),
      row("b@low", "b", "low", 87, 1),
      row("c@default", "c", "default", 99, Number.NaN),
    ];

    expect(affordableModels(variants, 4).map((variant) => variant.id)).toEqual(["a@medium", "b@low"]);
    expect(affordableModels(variants, null).map((variant) => variant.id)).toEqual(["a@high", "b@low"]);
    expect(affordableModels(variants, Number.NaN)).toEqual([]);
  });
});
