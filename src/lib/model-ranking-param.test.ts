import { describe, expect, it } from "vitest";
import { findRanking, rankParam } from "./model-ranking-param";

const options = [
  { key: "page:0", label: "AA-II (your page)" }, { key: "page:1", label: "WebDev Index" },
  { key: "builder:0", label: "AA-II" }, { key: "builder:2", label: "Adam's Capabilities Index" },
  { key: "preset:general", label: "General frontier" }, { key: "preset:aa", label: "Artificial Analysis" },
];

describe("ranking in the model page address", () => {
  it("names presets plainly and the visitor's own rankings by group and title, not by position", () => {
    expect(options.map(rankParam)).toEqual(["page-aa-ii", "page-webdev-index", "builder-aa-ii", "builder-adam-s-capabilities-index", "general", "aa"]);
    expect(new Set(options.map(rankParam)).size).toBe(options.length);
  });
  it("finds the option a shared link names, and nothing for an unknown or missing one", () => {
    expect(findRanking(options, "aa")?.label).toBe("Artificial Analysis");
    expect(findRanking(options, "builder-aa-ii")?.key).toBe("builder:0");
    expect(findRanking(options, "page-aa-ii")?.key).toBe("page:0");
    expect(findRanking(options, "nope")).toBeUndefined();
    expect(findRanking(options, null)).toBeUndefined();
  });
});
