import { describe, expect, it } from "vitest";
import type { Snapshot } from "../data/types";
import { defaultConfig, type IndexConfig } from "../engine";
import { aaIndexMix } from "../onboarding/defaults";
import { decodeIndices, encodeIndices } from "./url";
import { REFERENCE_ID, indexNote, isAAWeights, isOldDefault, isPristineDefault, restorable, withoutPristineDefault } from "./default-index";

const aa = (version: string) => ({ benchmarks: [{ id: `aa-intelligence-index-${version}` }] }) as unknown as Pick<Snapshot, "benchmarks">;
const base = aaIndexMix(aa("v5.0.1"));
const old = defaultConfig({} as Snapshot);
const mine: IndexConfig = { ...base, id: "i1", name: "My priors", focus: "capabilities", weights: { a: 10, b: 20 } };

describe("the opening mix", () => {
  it("is AA's composite, named for its version", () => {
    expect(base.name).toBe("Artificial Analysis Index v5.0.1");
    expect(base.weights).toEqual({ "aa-intelligence-index-v5.0.1": 100 });
    expect(base.focus).toBeUndefined();
    expect(aaIndexMix(aa("v5.1")).name).toBe("Artificial Analysis Index v5.1");
  });
  it("still counts as untouched at a later version", () => {
    expect(isPristineDefault(aaIndexMix(aa("v5.1")))).toBe(true);
  });
});

describe("the untouched default index", () => {
  it("is recognised only while nothing has changed", () => {
    expect(isPristineDefault(base)).toBe(true);
    expect(isPristineDefault({ ...base, highlight: [] })).toBe(true);
    expect(isPristineDefault({ ...base, name: "Mine now" })).toBe(false);
    expect(isPristineDefault({ ...base, weights: { ...base.weights, simplebench: 99 } })).toBe(false);
    expect(isPristineDefault({ ...base, excludeModels: ["gpt-5.5"] })).toBe(false);
    expect(isPristineDefault({ ...base, highlight: ["opus"] })).toBe(false);
  });
  it("tells weights the visitor changed from a model they hid", () => {
    expect(isAAWeights({ ...base, excludeModels: ["gpt-5.5"] })).toBe(true);
    expect(isAAWeights({ ...base, weights: { ...base.weights, simplebench: 99 } })).toBe(false);
    expect(isAAWeights({ ...base, weights: {} })).toBe(false);
  });
  it("steps aside when the visitor has their own index, and stays when it is the only one", () => {
    expect(withoutPristineDefault([base, mine])).toEqual([mine]);
    expect(withoutPristineDefault([mine, base])).toEqual([mine]);
    expect(withoutPristineDefault([base])).toEqual([base]);
    expect(withoutPristineDefault([{ ...base, name: "Edited" }, mine]).length).toBe(2);
  });
  it("still recognises it after a trip through a link, which drops the id", () => {
    const decoded = decodeIndices(encodeIndices([base, mine]));
    expect(decoded.map((i) => i.name)).toEqual(["Artificial Analysis Index v5.0.1", "My priors"]);
    expect(withoutPristineDefault(decoded).map((i) => i.name)).toEqual(["My priors"]);
  });
  it("keeps the reference a visitor asked for", () => {
    const ref = { ...base, id: REFERENCE_ID };
    expect(withoutPristineDefault([mine, ref])).toEqual([mine, ref]);
  });
  it("is described in plain words", () => {
    expect(indexNote(base, "yours")).toBe("As published by Artificial Analysis.");
    expect(indexNote(mine, "yours")).toMatch(/your comparisons/);
    expect(indexNote(mine, "Adam")).toBe("Fitted from Adam's comparisons.");
    expect(indexNote({ ...mine, focus: undefined }, "yours")).toBeUndefined();
  });
});

describe("what a returning browser restores", () => {
  it("recognises the old default whatever order its weights are saved in", () => {
    const reordered = { ...old, weights: Object.fromEntries(Object.entries(old.weights).reverse()) };
    expect(isOldDefault(old)).toBe(true);
    expect(isOldDefault(reordered)).toBe(true);
    expect(isOldDefault({ ...old, weights: { ...old.weights, simplebench: 5 } })).toBe(false);
  });
  it("drops saved defaults, so nobody is pinned to an old index, and keeps their own", () => {
    expect(restorable([old])).toEqual([]);
    expect(restorable([aaIndexMix(aa("v5.0"))])).toEqual([]);
    expect(restorable([old, mine])).toEqual([mine]);
    expect(restorable([{ ...old, weights: { a: 1 } }]).length).toBe(1);
  });
});
