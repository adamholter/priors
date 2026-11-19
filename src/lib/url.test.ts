import { defaultConfig, type IndexConfig } from "../engine";
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

it("starts on AA Intelligence Index v5's evaluations at AA's weights", () => {
  const shared = decodeIndex("General%20frontier|aa-briefcase:15,aa-automationbench-aa:5,aa-gdp-pdf:5,aa-frontiercode-2-0:15,aa-terminalbench-v4-0:10,aa-terminalbench-science:15,aa-critpt-v2-hard:10,aa-omniscience-v1-1-accuracy:10,aa-omniscience-v1-1-non-hallucination:5,aa-hle-diamond:10|strict=50|var=best", "general");
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
  it("round-trips the ranking list's efforts apart from the charts'", () => {
    const c = decodeIndex(encodeIndex({ ...base(), rankingEfforts: ["none", "high"], efforts: ["low"] }), "x")!;
    expect(c.rankingEfforts).toEqual(["none", "high"]);
    expect(c.efforts).toEqual(["low"]);
  });
  it("round-trips an explicit empty exclusion, which means show everything", () => {
    expect(decodeIndex(encodeIndex({ ...base(), excludeModels: [] }), "x")!.excludeModels).toEqual([]);
    expect(decodeIndex(encodeIndex(base()), "x")!.excludeModels).toBeUndefined();
  });
});

describe("scoring method", () => {
  const base: IndexConfig = { id: "i0", name: "Mine", weights: { "deepswe-1.1": 40, simplebench: 60 }, required: [], cutoff: 5, estimateMissing: true, variants: "all", strictness: 50 };
  it("round-trips IRT and ECI, and writes nothing for the weighted average", () => {
    for (const scoring of ["irt", "eci"] as const) {
      const encoded = encodeIndex({ ...base, scoring });
      expect(encoded).toContain(`score=${scoring}`);
      expect(decodeIndex(encoded, "i0")).toEqual({ ...base, scoring });
    }
    expect(encodeIndex(base)).not.toContain("score=");
    expect(encodeIndex({ ...base, scoring: undefined })).toBe(encodeIndex(base));
  });
  it("reads every link made before the method existed exactly as before: no method, so the weighted average", () => {
    // Links as the site wrote them before this field existed, old key spellings included, each with what the decoder on
    // main returned for it the day the field was added.
    const old: [string, IndexConfig][] = [
      ["General%20frontier|frontierswe-v2:25,terminalbench-4:25,deepswe-1.1:10|req=deepswe-1.1|cut=5|est=1|var=all",
        { id: "i0", name: "General frontier", weights: { "frontierswe-v2": 25, "terminalbench-4": 25, "deepswe-1.1": 10 }, required: ["deepswe-1.1"], cutoff: 5, estimateMissing: true, variants: "all" }],
      ["Mine|deepswe-1.1:40,simplebench:60|strict=70|bars=all|pareto=best|eff=high,max|reff=max|est=0|var=best|effort=strict|labs=openai|ex=gpt-5.5|after=|costsrc=terminalbench-4|costbasis=api|resets=on|free=off|plans=openai:ChatGPT%20Pro|timesrc=aa|focus=knowledge|hl=claude-opus-5",
        { id: "i0", name: "Mine", weights: { "deepswe-1.1": 40, simplebench: 60 }, required: [], cutoff: 5, estimateMissing: false, variants: "best", strictness: 70, rankingVariants: "all", paretoVariants: "best", efforts: ["high", "max"], rankingEfforts: ["max"], effortMatching: "strict", labs: ["openai"], excludeModels: ["gpt-5.5"], releasedAfter: "", costSource: "terminalbench-4", costBasis: "api", planResets: true, freeTiers: false, subscriptionPlans: { openai: "ChatGPT Pro" }, timeSource: "aa", focus: "knowledge", highlight: ["claude-opus-5"] }],
      ["Artificial Analysis Index v5.0|aa-intelligence-index-v5.0:100|strict=50|var=best",
        { id: "i0", name: "Artificial Analysis Index v5.0", weights: { "aa-intelligence-index-v5.0": 100 }, required: [], cutoff: 5, estimateMissing: true, variants: "best", strictness: 50 }],
      ["x|real-index:hle:10,real-index:scicode:5|opt=real-index:hle",
        { id: "i0", name: "x", weights: { "aa-humanitys-last-exam": 10, "aa-scicode": 5 }, required: [], cutoff: 5, estimateMissing: true, variants: "all", strictness: 50, optional: ["aa-humanitys-last-exam"] }],
    ];
    for (const [link, was] of old) {
      const decoded = decodeIndex(link, "i0")!;
      expect(decoded).toEqual(was);
      expect(Object.keys(decoded)).toEqual(Object.keys(was));
      expect(encodeIndex(decoded)).not.toContain("score=");
    }
  });
  it("ignores a method it does not know", () => {
    for (const bad of ["score=average", "score=", "score=IRT", "score=elo"]) expect("scoring" in decodeIndex(`Mine|simplebench:60|${bad}`, "i0")!).toBe(false);
  });
});
