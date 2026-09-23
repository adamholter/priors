import { describe, expect, it } from "vitest";
import { compactVisibility, hiddenIds, toggleVisibility, HIDE_ALL, SHOW_ALL } from "./model-visibility";

const picker = Array.from({ length: 10 }, (_, i) => `m${i}`);

describe("model visibility", () => {
  it("switches to an onlyModels allowlist when most models are hidden", () => {
    let vis = SHOW_ALL;
    for (const id of picker.slice(0, 6)) vis = { ...vis, ...toggleVisibility(vis, id, picker) };
    expect(vis.onlyModels).toEqual(picker.slice(6));
    expect(vis.excludeModels).toBeUndefined();
  });
  it("returns to excludeModels when fewer than half are hidden", () => {
    let vis = HIDE_ALL;
    for (const id of picker.slice(0, 6)) vis = { ...vis, ...toggleVisibility(vis, id, picker) };
    expect(vis.excludeModels).toEqual(expect.arrayContaining(picker.slice(6)));
    expect(vis.excludeModels).toHaveLength(4);
    expect(vis.onlyModels).toBeUndefined();
  });
  it("HIDE_ALL then toggling one model yields onlyModels [id]", () => {
    const vis = toggleVisibility(HIDE_ALL, "m3", picker);
    expect(vis.onlyModels).toEqual(["m3"]);
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
});
