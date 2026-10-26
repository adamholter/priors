import { describe, expect, it } from "vitest";
import { compactVisibility, hiddenIds, toggleVisibility, HIDE_ALL, SHOW_ALL } from "./model-visibility";

const picker = Array.from({ length: 10 }, (_, i) => `m${i}`);

describe("model visibility", () => {
  it("keeps explicit exclusions when most models are hidden", () => {
    let vis = SHOW_ALL;
    for (const id of picker.slice(0, 6)) vis = { ...vis, ...toggleVisibility(vis, id, picker) };
    expect(vis.excludeModels).toEqual(picker.slice(0, 6));
    expect(vis.onlyModels).toBeUndefined();
  });
  it("returns to excludeModels when fewer than half are hidden", () => {
    let vis = HIDE_ALL;
    for (const id of picker.slice(0, 6)) vis = { ...vis, ...toggleVisibility(vis, id, picker) };
    expect(vis.excludeModels).toEqual(expect.arrayContaining(picker.slice(6)));
    expect(vis.excludeModels).toHaveLength(4);
    expect(vis.onlyModels).toBeUndefined();
  });
  it("converts a legacy allowlist into exclusions when edited", () => {
    const vis = toggleVisibility(HIDE_ALL, "m3", picker);
    expect(vis.onlyModels).toBeUndefined();
    expect(vis.excludeModels).toEqual(picker.filter((id) => id !== "m3"));
  });
  it("hiddenIds resolves both representations", () => {
    expect(hiddenIds({ excludeModels: ["m1"], onlyModels: undefined }, picker)).toEqual(new Set(["m1"]));
    expect(hiddenIds({ excludeModels: undefined, onlyModels: ["m1", "m2"] }, picker)).toEqual(new Set(["m0", ...picker.slice(3)]));
    expect(hiddenIds(HIDE_ALL, picker)).toEqual(new Set(picker));
  });
  it("compactVisibility keeps ids hidden outside the picker in excludeModels", () => {
    const vis = compactVisibility(new Set(["m1", "ghost"]), picker);
    expect(vis.excludeModels).toEqual(expect.arrayContaining(["m1", "ghost"]));
  });
  it("lets a newly added model appear in a saved selection", () => {
    const vis = compactVisibility(new Set(picker.slice(0, 9)), picker);
    expect(hiddenIds(vis, [...picker, "new-model"]).has("new-model")).toBe(false);
  });
});

describe("default view", () => {
  const auto = ["m1", "m2"];
  it("hides the automatic picks until the view is curated", () => {
    expect(hiddenIds({ excludeModels: undefined, onlyModels: undefined }, picker, auto)).toEqual(new Set(auto));
  });
  it("show all is an explicit choice that overrides them", () => {
    expect(hiddenIds(SHOW_ALL, picker, auto).size).toBe(0);
    expect(SHOW_ALL.excludeModels).toEqual([]);
  });
  it("toggling one model from the default keeps the others as hidden as shown", () => {
    const vis = toggleVisibility({ excludeModels: undefined, onlyModels: undefined }, "m1", picker, auto);
    expect(vis.excludeModels).toEqual(["m2"]);
  });
});
