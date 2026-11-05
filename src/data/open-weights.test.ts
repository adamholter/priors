import { describe, expect, it } from "vitest";
import { applyOpenWeights, STATED_PARAMS } from "./open-weights";
import type { Snapshot } from "./types";

const snapshot = (id: string, parameters: number, active: number) => ({
  models: [{ id, name: id, labId: "other", kind: "llm", reasoning: true, aliases: [] }],
  variants: [{ id: `${id}@high`, modelId: id, effort: "high", sourceModel: { id, slug: id, name: id, url: "", metadata: { parameters, activeParams: active } } }],
}) as unknown as Snapshot;
const model = (id: string, parameters: number, active: number) => applyOpenWeights(snapshot(id, parameters, active), new Map()).models[0];

describe("parameter counts", () => {
  it("use the lab's stated total over the safetensors count, and say so", () => {
    const small = model("inkling-small", 266, 12);
    expect(small).toMatchObject({ paramsB: 276, activeParamsB: 12 });
    expect(small.paramsNote).toMatch(/266B/);
  });
  it("hold a lab's backbone figure when the files are larger, and name what the number is", () => {
    const flash = model("deepseek-v4.1-flash-1017", 763, 16);
    expect(flash.paramsB).toBe(552);
    expect(flash.paramsNote).toMatch(/Backbone.*763B/);
  });
  it("give SWE-2 Flash the size Cognition states, with no source to read it from", () => {
    expect(STATED_PARAMS["swe-2-flash"]).toMatchObject({ paramsB: 276, activeB: 12 });
  });
  it("leave a model the lab states nothing for at the source's count, with no note", () => {
    const other = model("other-model", 100, 10);
    expect(other).toMatchObject({ paramsB: 100, activeParamsB: 10 });
    expect(other.paramsNote).toBeUndefined();
  });
});
