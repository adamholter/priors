import { describe, expect, it } from "vitest";
import { searchBenchmarks } from "./benchmark-search";
import type { Benchmark } from "@/data/types";

const b = (id: string, name: string, description: string, category = "coding", sourceId = "x"): Benchmark => ({ id, name, shortName: name, sourceId, url: "", description, unit: "percent", higherIsBetter: true, category: category as Benchmark["category"], eligibleForDefault: false, defaultWeight: 0 });
const list = [
  b("arena-webdev", "Arena WebDev", "Humans vote on web app builds; rewards good visual design."),
  b("design-arena", "Design Arena", "Preference votes on generated interfaces."),
  b("terminalbench", "Terminal-Bench", "Command-line tasks in a sandbox."),
  b("swe", "SWE Tasks", "Build features and fix bugs in real repositories."),
  b("harvey", "Harvey LAB", "Legal tasks.", "knowledge", "aa"),
];
const ids = (q: string) => searchBenchmarks(list, q).map((x) => x.id);

describe("benchmark search", () => {
  it("returns everything for an empty query", () => expect(ids("  ")).toHaveLength(5));
  it("ranks a name match above a description match", () => expect(ids("design")).toEqual(["design-arena", "arena-webdev"]));
  it("finds a benchmark by a word in its description", () => expect(ids("legal")).toEqual(["harvey"]));
  it("needs every word, in any field", () => expect(ids("arena vote")).toEqual(["arena-webdev", "design-arena"]));
  it("ignores spacing and punctuation in names", () => expect(ids("terminal bench")).toEqual(["terminalbench"]));
  it("matches whole description words from the start, not inside words", () => { expect(ids("ui")).toEqual([]); expect(ids("repos")).toEqual(["swe"]); });
  it("matches the lab or category name", () => { expect(searchBenchmarks(list, "knowledge", (c) => c).map((x) => x.id)).toEqual(["harvey"]); });
  describe("loose", () => {
    const loose = (q: string) => searchBenchmarks(list, q, (c) => c, { loose: true }).map((x) => x.id);
    it("still ranks full matches first, then partial ones instead of nothing", () => expect(loose("arena legal")).toEqual(["arena-webdev", "design-arena", "harvey"]));
    it("forgives one typo in a name", () => expect(loose("termnal")).toEqual(["terminalbench"]));
    it("meets other forms of a description word", () => expect(loose("fixing")).toEqual(["swe"]));
  });
});
