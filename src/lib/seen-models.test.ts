import { describe, expect, it } from "vitest";
import { newModels } from "./seen-models";

describe("newModels", () => {
  it("labels nothing on a first visit, and remembers every model", () => {
    const { fresh, save } = newModels(["a", "b"], null);
    expect([...fresh]).toEqual([]);
    expect(JSON.parse(save)).toEqual(["a", "b"]);
  });

  it("labels only models added since the last visit", () => {
    const { fresh, save } = newModels(["a", "b", "c"], JSON.stringify(["a", "b"]));
    expect([...fresh]).toEqual(["c"]);
    expect(JSON.parse(save)).toEqual(["a", "b", "c"]);
  });

  it("the next visit no longer labels them", () => {
    const first = newModels(["a", "c"], JSON.stringify(["a"]));
    expect([...newModels(["a", "c"], first.save).fresh]).toEqual([]);
  });

  it("keeps models that have left the data, so one coming back is not new", () => {
    const { save } = newModels(["a"], JSON.stringify(["a", "gone"]));
    expect([...newModels(["a", "gone"], save).fresh]).toEqual([]);
  });

  it("treats a damaged value as a first visit", () => {
    expect([...newModels(["a"], "{not json").fresh]).toEqual([]);
    expect([...newModels(["a"], "{}").fresh]).toEqual([]);
  });
});
