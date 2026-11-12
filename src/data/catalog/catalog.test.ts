import { describe, expect, it } from "vitest";
import type { Benchmark } from "../types";
import { CATEGORY_IDS, categoriesOf, categoryName, normalizeCategory } from "../categories";
import { CATALOG, applyCatalog, withCatalog } from "./index";

const bench = (over: Partial<Benchmark>): Benchmark => ({ id: "x", name: "X", sourceId: "s", url: "https://x.test", description: "Source words.", unit: "percent", higherIsBetter: true, category: "other", ...over });

describe("benchmark catalog", () => {
  it("every entry has known categories and a plain description", () => {
    for (const [id, e] of Object.entries(CATALOG)) {
      expect(e.c.length, id).toBeGreaterThan(0);
      for (const c of e.c) expect(CATEGORY_IDS, `${id}: ${c}`).toContain(c);
      if (!e.d) continue;
      expect(e.d, id).not.toMatch(/[—–]/);
      expect(e.d.length, id).toBeGreaterThan(40);
      expect(e.d.length, id).toBeLessThan(420);
      expect(e.d, id).toMatch(/[.?]$/);
    }
  });
  it("puts a benchmark in several categories, the first being its main one", () => {
    const b = withCatalog(bench({ id: "aa-critpt-v2-hard", category: "reasoning" }));
    expect(b.category).toBe("science");
    expect(b.categories).toEqual(["science", "reasoning"]);
    expect(b.description).toMatch(/^The 40 hardest CritPt v2 problems: research-level physics/);
  });
  it("writes a family's descriptions from its pattern", () => {
    expect(withCatalog(bench({ id: "arena-text-chinese", name: "Arena Text · Chinese" }))).toMatchObject({ category: "preference", categories: ["preference", "multilingual"] });
    expect(withCatalog(bench({ id: "bh-matharena-arxivmath-2027-01", name: "ArXivMath 01/2027 (MathArena)" })).description).toContain("arXiv papers of January 2027");
    expect(withCatalog(bench({ id: "aa-omniscience-v1-1-law" })).categories).toEqual(["knowledge", "professional"]);
  });
  it("keeps a source's own words where it has none, and names what is missing", () => {
    const { benchmarks, missing } = applyCatalog([bench({ id: "brand-new", category: "economics" as never, categories: ["agentic"] }), bench({ id: "arc-agi-1" })]);
    expect(missing).toEqual(["brand-new"]);
    expect(benchmarks[0]).toMatchObject({ description: "Source words.", category: "professional", categories: ["professional", "agentic"] });
  });
  it("credits the dashboard a board was collected from, once", () => {
    const once = withCatalog(bench({ id: "bg-gsm8k", sourceId: "boggs" }));
    expect(once.description).toMatch(/Collected by Jake Boggs' benchmark dashboard\.$/);
    expect(withCatalog(once).description).toBe(once.description);
  });
  it("is stable when applied twice, as a snapshot is at build and again on load", () => {
    const source = bench({ id: "aa-personality-warmth", description: "AA-PersonalityBench Warmth index: friendly, humorous. Percentile rank (1 to 100)." });
    const once = withCatalog(source);
    expect(once.description).toContain("friendly, humorous");
    expect(withCatalog(once)).toEqual(once);
  });
});

describe("categories", () => {
  it("reads snapshots saved under the old names", () => {
    expect(normalizeCategory("economics")).toBe("professional");
    expect(normalizeCategory("instruction")).toBe("behavior");
    expect(normalizeCategory("nonsense")).toBe("other");
    expect(categoryName("agentic")).toBe("Agents & computer use");
    expect(categoriesOf({ category: "economics" as never })).toEqual(["professional"]);
    expect(categoriesOf({ category: "science", categories: ["science", "agentic"] })).toEqual(["science", "agentic"]);
  });
});
