import { describe, expect, it } from "vitest";
import { parsePriorsBench } from "./sources/priorsbench";

const now = Date.parse("2026-11-22T00:00:00Z"), DAY = 86_400_000;
const models = ["a", "b", "c", "d", "e", "f"].map((id) => ({ id, name: `Model ${id.toUpperCase()}` }));
const rankings = Array.from({ length: 30 }, (_, i) => ({ lineup: i % 2 ? ["a", "b", "c", "d", "e", "f", "gone"] : ["b", "a", "c", "d", "e", "f"], focus: "general", createdAt: now - (i + 1) * DAY }));

describe("PriorsBench source", () => {
  it("files one row per rated model under its snapshot name, and drops ids the snapshot no longer has", () => {
    const { benchmarks, rows } = parsePriorsBench(rankings, models, now);
    expect(benchmarks[0]).toMatchObject({ id: "priorsbench", unit: "elo", eligibleForDefault: false, defaultWeight: 0, category: "preference" });
    expect(rows.map((r) => r.modelLabel).slice(2)).toEqual(["Model C", "Model D", "Model E", "Model F"]);
    expect(rows.map((r) => r.modelLabel).sort()).toEqual(models.map((m) => m.name));
    expect(rows[0].ci).toHaveLength(2);
  });
});
