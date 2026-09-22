import { defaultConfig } from "../engine";
import type { Snapshot } from "../data/types";
import { describe, expect, it } from "vitest";
import { decodeIndex, encodeIndex } from "./url";

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

it("preserves namespaced benchmark weights in shared results", () => {
  const config = { ...decodeIndex("Custom|swe:20", "a")!, weights: { "real-index:terminal-bench-2-1": 23, "deepswe-1.1": 29 }, optional: ["real-index:terminal-bench-2-1"] };
  expect(decodeIndex(encodeIndex(config), "a")).toEqual(config);
});
