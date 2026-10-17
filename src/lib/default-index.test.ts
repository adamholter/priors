import { describe, expect, it } from "vitest";
import type { Snapshot } from "../data/types";
import { defaultConfig, type IndexConfig } from "../engine";
import { decodeIndices, encodeIndices } from "./url";
import { DEFAULT_LABEL, REFERENCE_ID, indexNote, isPristineDefault, tabLabel, withoutPristineDefault } from "./default-index";

const base = defaultConfig({} as Snapshot);
const mine: IndexConfig = { ...base, id: "i1", name: "My priors", focus: "capabilities", weights: { a: 10, b: 20 } };

describe("the untouched default index", () => {
  it("is recognised only while nothing has changed", () => {
    expect(isPristineDefault(base)).toBe(true);
    expect(isPristineDefault({ ...base, highlight: [] })).toBe(true);
    expect(isPristineDefault({ ...base, name: "Mine now" })).toBe(false);
    expect(isPristineDefault({ ...base, weights: { ...base.weights, simplebench: 99 } })).toBe(false);
    expect(isPristineDefault({ ...base, excludeModels: ["gpt-5.5"] })).toBe(false);
    expect(isPristineDefault({ ...base, highlight: ["opus"] })).toBe(false);
  });
  it("steps aside when the visitor has their own index, and stays when it is the only one", () => {
    expect(withoutPristineDefault([base, mine])).toEqual([mine]);
    expect(withoutPristineDefault([mine, base])).toEqual([mine]);
    expect(withoutPristineDefault([base])).toEqual([base]);
    expect(withoutPristineDefault([{ ...base, name: "Edited" }, mine]).length).toBe(2);
  });
  it("still recognises it after a trip through a link, which drops the id", () => {
    const decoded = decodeIndices(encodeIndices([base, mine]));
    expect(decoded.map((i) => i.name)).toEqual(["General frontier", "My priors"]);
    expect(withoutPristineDefault(decoded).map((i) => i.name)).toEqual(["My priors"]);
  });
  it("keeps the reference a visitor asked for", () => {
    const ref = { ...base, id: REFERENCE_ID, name: DEFAULT_LABEL };
    expect(withoutPristineDefault([mine, ref])).toEqual([mine, ref]);
  });
  it("is labelled and described in plain words", () => {
    expect(tabLabel(base)).toBe("Default mix");
    expect(tabLabel(mine)).toBe("My priors");
    expect(indexNote(base, "yours")).toMatch(/not tuned to anyone/);
    expect(indexNote(mine, "yours")).toMatch(/your comparisons/);
    expect(indexNote(mine, "Adam")).toBe("Fitted from Adam's comparisons.");
    expect(indexNote({ ...mine, focus: undefined }, "yours")).toBeUndefined();
  });
});
