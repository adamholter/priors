import { describe, expect, it } from "vitest";
import { labelCollisions, swallowedTiers, type LabeledRow } from "./label-collisions";

const row = (label: string, value: number, over: Partial<LabeledRow> = {}): LabeledRow => ({ benchmarkId: "frontiercode-2.0-main", variantId: "swe-2@max", label, value, ...over });

describe("rows the build would drop", () => {
  it("reports a tier word landing on another model's row: how SWE-2 Flash lost its max row", () => {
    expect(labelCollisions([row("SWE-2", 23.78), row("SWE-2 Flash", 24)])).toEqual([{ benchmarkId: "frontiercode-2.0-main", variantId: "swe-2@max", dropped: "SWE-2 Flash", kept: "SWE-2" }]);
  });
  it("ignores the same name written two ways, and repeats of one value", () => {
    expect(labelCollisions([row("SWE-2 (max)", 23.78), row("swe-2 high", 20)])).toEqual([]);
    expect(labelCollisions([row("SWE-2", 24), row("SWE-2 Flash", 24)])).toEqual([]);
  });
  it("ignores runs of one model named by their settings, and rows on different benchmarks", () => {
    expect(labelCollisions([row("GPT-6 Astra (xhigh, $200 wallet)", 44), row("GPT-6 Astra (xhigh, $10 wallet)", 37)])).toEqual([]);
    expect(labelCollisions([row("SWE-2", 23), row("SWE-2 Flash", 24, { benchmarkId: "other" })])).toEqual([]);
  });
  it("does not take a size for a tier", () => {
    expect(labelCollisions([row("Qwen 3 32B", 70), row("Qwen 3 7B", 60)])).toEqual([]);
  });
  it("reads a line the same from one run to the next, with no value in it to change", () => {
    expect(JSON.stringify(labelCollisions([row("SWE-2", 23.78), row("SWE-2 Flash", 24)]))).not.toContain("24");
  });
});

describe("a tier its model does not have", () => {
  const model = (id: string, name: string, aliases: string[]) => ({ id, name, aliases });
  it("finds Flash on SWE-2 before any row collides", () => {
    expect(swallowedTiers([model("swe-2", "SWE 2", ["swe-2", "swe-2 flash"])])).toEqual([{ modelId: "swe-2", label: "swe-2 flash", word: "flash" }]);
  });
  it("finds it on a base of any age", () => {
    expect(swallowedTiers([model("swe-1.6", "SWE 1.6", ["swe-1.6 flash"])])).toHaveLength(1);
  });
  it("leaves a model's own tier, effort words and bracketed notes alone", () => {
    expect(swallowedTiers([model("gemini-3.8-flash", "Gemini 3.8 Flash", ["gemini 3.8 flash (high)"]), model("swe-2", "SWE 2", ["swe-2 (max)", "swe-2 (*using devin)", "swe-2 (flash harness)"])])).toEqual([]);
  });
});
