import { describe, expect, it } from "vitest";
import { clickColumn, DIRECTORY_SORTS, dirNames, naturalDir, sortDirectory, withQualityAdjustments, type SortableBenchmark } from "./benchmark-directory-sort";

const b = (name: string, extra: Partial<SortableBenchmark> = {}): SortableBenchmark => ({ name, models: 10, quality: 50, uses: 0, stars: 0, factors: {}, ...extra });
const names = (xs: SortableBenchmark[]) => xs.map((x) => x.name);

describe("benchmark directory sorting", () => {
  const items = [b("Beta", { models: 30, leader: { name: "Opus" } }), b("alpha", { models: 5, leader: { name: "Fable" } }), b("Gamma", { models: 120 })];
  it("sorts names A to Z first and numbers biggest first", () => {
    expect(names(sortDirectory(items, "name"))).toEqual(["alpha", "Beta", "Gamma"]);
    expect(names(sortDirectory(items, "models"))).toEqual(["Gamma", "Beta", "alpha"]);
    expect(naturalDir("name")).toBe("asc");
    expect(naturalDir("stars")).toBe("desc");
  });
  it("reverses on the other direction", () => {
    expect(names(sortDirectory(items, "name", "desc"))).toEqual(["Gamma", "Beta", "alpha"]);
    expect(names(sortDirectory(items, "models", "asc"))).toEqual(["alpha", "Beta", "Gamma"]);
  });
  it("keeps boards with no top model last either way", () => {
    expect(names(sortDirectory(items, "leader"))).toEqual(["alpha", "Beta", "Gamma"]);
    expect(names(sortDirectory(items, "leader", "desc"))).toEqual(["Beta", "alpha", "Gamma"]);
  });
  it("sorts by a part of the quality score, unknown parts last", () => {
    const f = [b("A", { factors: { size: 40 } }), b("B"), b("C", { factors: { size: 90 } })];
    expect(names(sortDirectory(f, "size"))).toEqual(["C", "A", "B"]);
  });
  it("starts a new column in its natural direction and flips the current one", () => {
    expect(clickColumn({ sort: "recommended", dir: "desc" }, "name")).toEqual({ sort: "name", dir: "asc" });
    expect(clickColumn({ sort: "name", dir: "asc" }, "name")).toEqual({ sort: "name", dir: "desc" });
    expect(clickColumn({ sort: "name", dir: "desc" }, "models")).toEqual({ sort: "models", dir: "desc" });
    expect(clickColumn({ sort: "models", dir: "desc" }, "models")).toEqual({ sort: "models", dir: "asc" });
  });
  it("offers every column and every quality part as a sort", () => {
    const ids = DIRECTORY_SORTS.map((s) => s.id);
    for (const id of ["name", "leader", "models", "uses", "quality", "stars", "saturation", "testSet", "recency", "objectivity", "frontier", "size", "efforts", "breadth"]) expect(ids).toContain(id);
  });
  it("switches between adjusted and base quality scores when bonuses and penalties are toggled", () => {
    const rows = [
      b("Boosted", { quality: 85, baseQuality: 70 }),
      b("Plain", { quality: 78, baseQuality: 78 }),
      b("Penalized", { quality: 55, baseQuality: 80 }),
    ];
    expect(names(sortDirectory(withQualityAdjustments(rows, true), "quality"))).toEqual(["Boosted", "Plain", "Penalized"]);
    expect(names(sortDirectory(withQualityAdjustments(rows, false), "quality"))).toEqual(["Penalized", "Plain", "Boosted"]);
    expect(withQualityAdjustments(rows, false).map((r) => r.quality)).toEqual([70, 78, 80]);
  });
  it("sorts by newest release, not latest results: undated boards last either way", () => {
    const row = (name: string, released?: string, lastUpdated?: string) => ({ name, models: 1, quality: 50, uses: 0, stars: 0, factors: {}, ...(released ? { released } : {}), ...(lastUpdated ? { lastUpdated } : {}) });
    const items = [row("old, updated today", "2024-03-01", "2026-11-27"), row("new", "2026-11-25", "2026-11-25"), row("undated", undefined, "2026-11-26"), row("mid", "2026-06-01")];
    expect(sortDirectory(items, "newest").map((x) => x.name)).toEqual(["new", "mid", "old, updated today", "undated"]);
    expect(sortDirectory(items, "newest", "asc").map((x) => x.name)).toEqual(["old, updated today", "mid", "new", "undated"]);
    expect(sortDirectory(items, "updated")[0].name).toBe("old, updated today");
    expect(dirNames("newest")).toEqual(["Newest first", "Oldest first"]);
    expect(DIRECTORY_SORTS.find((x) => x.id === "newest")?.name).toBe("Newest");
  });
});
