import { defaultConfig } from "../engine";
import type { Snapshot } from "../data/types";
import { describe, expect, it } from "vitest";
import { decodeIndex, decodeIndices, encodeIndex, encodeIndices, pageIndexId, pageRef, prettyQuery, type FromPage } from "./url";

describe("effort matching URL state", () => {
  it("round trips strictness, both requirement overrides, and independent chart modes", () => {
    const c = { ...decodeIndex("General|swe:50,term:50", "a")!, strictness: 65, required: ["swe"], optional: ["term"], rankingVariants: "best" as const, paretoVariants: "all" as const };
    expect(decodeIndex(encodeIndex(c), "a")).toEqual(c);
  });
  it("keeps old links on the new default", () => {
    expect(decodeIndex("General|swe:50,term:50", "a")?.effortMatching).toBeUndefined();
  });
  it.each(["strict", "nearest", "calibrated"] as const)("round trips %s matching", (effortMatching) => {
    const c = { ...decodeIndex("General|swe:50,term:50", "a")!, effortMatching };
    expect(decodeIndex(encodeIndex(c), "a")).toEqual(c);
  });
});

it("starts with the exact shared General frontier configuration", () => {
  const shared = decodeIndex("General%20frontier|deepswe-1.1:43,terminalbench-4:54,arc-agi-3:9,simplebench:38,bsbench-v2:12,aa-humanitys-last-exam:37,aa-omniscience:24,frontiermath-tier-4-v2:42|opt=deepswe-1.1|strict=50|var=best", "general");
  expect(defaultConfig({} as Snapshot)).toEqual(shared);
});

it("round trips the onboarding focus", () => {
  const c = { ...decodeIndex("General|swe:50,term:50", "a")!, focus: "knowledge" as const };
  expect(decodeIndex(encodeIndex(c), "a")).toEqual(c);
  expect(encodeIndex(c)).toContain("focus=knowledge");
  expect(decodeIndex("General|swe:50|focus=bogus", "a")?.focus).toBeUndefined();
});

it("preserves namespaced benchmark weights in shared results", () => {
  const config = { ...decodeIndex("Custom|swe:20", "a")!, weights: { "vals:terminal-bench-2-1": 23, "deepswe-1.1": 29 }, optional: ["vals:terminal-bench-2-1"] };
  expect(decodeIndex(encodeIndex(config), "a")).toEqual(config);
});

it("moves retired Real Index weights onto the live benchmarks", () => {
  const c = decodeIndex("Old|real-index:deepswe-1-1:20,deepswe-1.1:10,real-index:hle:30|req=real-index:hle", "a")!;
  expect(c.weights).toEqual({ "deepswe-1.1": 30, "aa-humanitys-last-exam": 30 });
  expect(c.required).toEqual(["aa-humanitys-last-exam"]);
});

describe("model visibility params", () => {
  it("round trips an onlyModels allowlist", () => {
    const c = { ...decodeIndex("General|swe:50", "a")!, onlyModels: ["a", "b"] };
    const encoded = encodeIndex(c);
    expect(encoded).toContain("only=a,b");
    expect(decodeIndex(encoded, "a")).toEqual(c);
  });
  it("round trips an empty allowlist (hide all)", () => {
    const c = { ...decodeIndex("General|swe:50", "a")!, onlyModels: [] as string[] };
    const encoded = encodeIndex(c);
    expect(encoded).toContain("only=");
    expect(decodeIndex(encoded, "a")?.onlyModels).toEqual([]);
  });
  it("still decodes legacy excludeModels", () => {
    expect(decodeIndex("General|swe:50|ex=a,b", "a")?.excludeModels).toEqual(["a", "b"]);
  });
});

describe("readable links", () => {
  const index = { ...decodeIndex("x|a:1", "i0")!, name: "Adam's 50% / Capabilities, v2 | test", weights: { "aa-scicode": 10, "vals:rsi": 2.5 }, required: ["aa-scicode"], excludeModels: ["m-1", "m-2"] };
  it("keeps colons, commas and equals signs readable and parses back to the same index", () => {
    const pretty = prettyQuery(encodeIndices([index, { ...index, name: "Second one" }]));
    expect(pretty).toContain("aa-scicode:10,vals:rsi:2.5");
    expect(pretty).toContain("req=aa-scicode");
    expect(pretty).toContain("i=Second+one%7C");
    expect(pretty).not.toMatch(/%3A|%2C|%3D|%2520|\|/);
    const back = decodeIndices(new URLSearchParams(pretty));
    expect(back).toEqual([{ ...index, id: "i0" }, { ...index, id: "i1", name: "Second one" }]);
  });
  it("carries the page an index came from only when asked", () => {
    const from: FromPage = { ...index, page: pageRef("adamholter", "i-9f2c", "k3y") };
    expect(encodeIndex(from)).not.toContain("page=");
    const back = decodeIndices(new URLSearchParams(prettyQuery(encodeIndices([from], true))))[0] as FromPage;
    expect(pageIndexId(back, "adamholter", "k3y")).toBe("i-9f2c");
  });
  it("trusts a page reference only with this tab's key and for this page", () => {
    const ref = (page: string): FromPage => ({ ...index, page });
    expect(pageIndexId(ref("adamholter.i.with.dots.k3y"), "adamholter", "k3y")).toBe("i.with.dots");
    // A link someone else wrote: no key, a guessed key, or no key stored in this tab.
    expect(pageIndexId(ref("adamholter.i0"), "adamholter", "k3y")).toBeUndefined();
    expect(pageIndexId(ref("adamholter.i0.guess"), "adamholter", "k3y")).toBeUndefined();
    expect(pageIndexId(ref("adamholter.i0.k3y"), "adamholter", null)).toBeUndefined();
    expect(pageIndexId(ref("adamholter.i0."), "adamholter", "")).toBeUndefined();
    // Another person's page, or a handle that only starts the same.
    expect(pageIndexId(ref("adam.i0.k3y"), "adamholter", "k3y")).toBeUndefined();
    expect(pageIndexId(ref("adamholter2.i0.k3y"), "adamholter", "k3y")).toBeUndefined();
    expect(pageIndexId(index, "adamholter", "k3y")).toBeUndefined();
  });
});

describe("effort and visibility codec", () => {
  const base = () => ({ ...decodeIndex("General|swe:50,term:50", "a")! });
  it("round-trips chosen efforts, including none chosen", () => {
    for (const efforts of [["low", "high"], ["none", "max"], []]) {
      const c = decodeIndex(encodeIndex({ ...base(), efforts }), "x")!;
      expect(c.efforts).toEqual(efforts);
    }
  });
  it("round-trips an explicit empty exclusion, which means show everything", () => {
    expect(decodeIndex(encodeIndex({ ...base(), excludeModels: [] }), "x")!.excludeModels).toEqual([]);
    expect(decodeIndex(encodeIndex(base()), "x")!.excludeModels).toBeUndefined();
  });
});
