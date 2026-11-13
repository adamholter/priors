import { describe, expect, it } from "vitest";
import type { Benchmark, Model, Observation, RawRow, Variant } from "../../src/data/types";
import { applyVersionSplits, versionedId, type FrozenVersion } from "./version-splits";

const bench = (version: string, extra: Partial<Benchmark> = {}): Benchmark => ({ id: "board", name: `Board v${version}`, sourceId: "src", url: "u", description: "d", unit: "score", higherIsBetter: true, category: "creative", eligibleForDefault: false, defaultWeight: 0, version, ...extra });
const row = (label: string, value: number, benchmarkId = "board"): RawRow => ({ benchmarkId, modelLabel: label, value, sourceUrl: "u" });

describe("benchmark version splits", () => {
  it("names a version's own id", () => {
    expect(versionedId("gamefeel", "v1.5")).toBe("gamefeel-v1.5");
    expect(versionedId("board-v1.5", "2")).toBe("board-v2");
  });
  it("freezes the old version under its id the first time the publisher's version changes, and files the new one separately", () => {
    const prev = {
      benchmarks: [bench("1.4")],
      observations: [{ benchmarkId: "board", variantId: "a@high", value: 40, observedAt: "t", sourceUrl: "u", note: "x; carried from 2026-11-10" }] as Observation[],
      variants: [{ id: "a@high", modelId: "a", effort: "high" }] as Variant[],
      models: [{ id: "a", name: "Model A", labId: "lab", kind: "llm", reasoning: true, aliases: [] }] as Model[],
    };
    const frozen = new Map<string, FrozenVersion>();
    const r = { benchmarks: [bench("1.5")], rows: [row("Model A", 20), row("Model B", 10)] };
    const out = applyVersionSplits("src", r, frozen, prev, "2026-11-13");
    expect(out.created.map((f) => [f.id, f.version])).toEqual([["board", "1.4"]]);
    expect(r.benchmarks.map((b) => [b.id, b.name, b.versionPolicy])).toEqual([["board-v1.5", "Board v1.5", { kind: "fresh", supersedes: "board" }], ["board", "Board v1.4", undefined]]);
    expect(r.rows.map((x) => [x.benchmarkId, x.modelLabel, x.value, x.effort])).toEqual([["board-v1.5", "Model A", 20, undefined], ["board-v1.5", "Model B", 10, undefined], ["board", "Model A", 40, "high"]]);
    expect(r.rows[2].note).toBe("x; frozen at v1.4");
    // Next run: the last snapshot now holds both, and the frozen copy keeps the split in place.
    const again = { benchmarks: [bench("1.5")], rows: [row("Model A", 21)] };
    expect(applyVersionSplits("src", again, frozen, { ...prev, benchmarks: [bench("1.4"), bench("1.5", { id: "board-v1.5" })] }, "2026-11-14").created).toEqual([]);
    expect(again.benchmarks.map((b) => b.id)).toEqual(["board-v1.5", "board"]);
  });
  it("leaves a benchmark alone while its version holds, and ignores sources without versions", () => {
    const r = { benchmarks: [bench("1.5"), { ...bench("1"), id: "other", version: undefined }], rows: [row("A", 1), row("A", 2, "other")] };
    const out = applyVersionSplits("src", r, new Map(), { benchmarks: [bench("1.5"), { ...bench("1"), id: "other", version: undefined }], observations: [], variants: [], models: [] }, "d");
    expect(out).toEqual({ created: [], moved: [] });
    expect(r.benchmarks.map((b) => b.id)).toEqual(["board", "other"]);
  });
});
