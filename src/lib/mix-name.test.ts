import { describe, expect, it } from "vitest";
import type { IndexConfig } from "@/engine";
import { derivedMixName } from "./mix-name";

const snap = { benchmarks: [
  { id: "aime", name: "AIME 2025", shortName: "AIME" }, { id: "crit", name: "CritPt" }, { id: "x", name: "X" }, { id: "y", name: "Y" },
] };
const mix = (weights: Record<string, number>) => ({ weights }) as IndexConfig;

describe("derivedMixName", () => {
  it("names a mix by its benchmarks, heaviest first, using short names", () => {
    expect(derivedMixName(snap, mix({ crit: 70, aime: 30 }), [])).toBe("CritPt + AIME");
  });
  it("counts the rest once there are more than three", () => {
    expect(derivedMixName(snap, mix({ aime: 4, crit: 3, x: 2, y: 1 }), [])).toBe("AIME + 3 more");
  });
  it("ignores zero weights and falls back to the id of an unknown benchmark", () => {
    expect(derivedMixName(snap, mix({ aime: 0, nope: 5 }), [])).toBe("nope");
  });
  it("calls a copy of AA's index My mix, and an empty one New mix", () => {
    expect(derivedMixName(snap, mix({ "aa-intelligence-index-v5": 100 }), [])).toBe("My mix");
    expect(derivedMixName(snap, mix({}), [])).toBe("New mix");
  });
  it("numbers a name that is taken", () => {
    expect(derivedMixName(snap, mix({ aime: 1 }), ["AIME", "AIME 2"])).toBe("AIME 3");
  });
  it("keeps a long name to 60 characters", () => {
    const long = { benchmarks: [{ id: "l", name: "L".repeat(90) }] };
    expect(derivedMixName(long, mix({ l: 1 }), [])).toHaveLength(60);
  });
});
