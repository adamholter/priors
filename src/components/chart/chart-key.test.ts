import { describe, expect, it } from "vitest";
import type { Lab } from "@/data/types";
import type { RankedVariant } from "@/engine";
import { capRows, groupModels, isNeutralLab, keyData, type KeyDataInput } from "./chart-key";
import { EMPTY_HIDDEN } from "./chart-visibility";
import { LIGHT_PALETTE } from "./palette";
import type { ScatterPoint } from "./scatter-option";

const point = (model: string, effort: string, score: number, x: number, labId = "lab-a"): ScatterPoint => ({
  x, r: { model: { id: model, name: model.toUpperCase(), labId }, variant: { id: `${model}@${effort}`, effort }, score } as unknown as RankedVariant,
});
const lab = (id: string, name: string, color: string) => ({ id, name, color }) as Lab;
const labs = [lab("lab-a", "Alpha", "#112233"), lab("lab-b", "Beta", "#445566"), lab("grey-1", "Grey One", "#A3A39B"), lab("grey-2", "Grey Two", "#a3a39b")];

// a, b, c and d sit on the frontier (lower x is better); aLow and old do not, and old is a model of its own.
const a = point("a", "high", 80, 5), aLow = point("a", "low", 60, 6), b = point("b", "high", 70, 3, "lab-b"), c = point("c", "default", 40, 2, "grey-1"), d = point("d", "default", 30, 1, "grey-2"), old = point("old", "default", 20, 9);
const base = (over: Partial<KeyDataInput> = {}): KeyDataInput => ({
  pts: [a, aLow, b, c, d], allPoints: [a, aLow, b, c, d], chartPoints: [a, aLow, b, c, d, old], canTrim: true, trimmed: true, allModels: false,
  hidden: EMPTY_HIDDEN, frontier: [d, c, b, a], showFrontier: true, labs, pal: LIGHT_PALETTE, better: "lower", keep: [], ...over,
});

describe("chart key grouping", () => {
  it("groups efforts under their model, best score first, and marks frontier models", () => {
    const rows = groupModels([aLow, b, a], new Set(["a@high"]));
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
    expect(rows[0]).toMatchObject({ name: "A", labId: "lab-a", frontier: true });
    expect(rows[0].best).toBe(a);
    expect(rows[0].points).toEqual([aLow, a]);
    expect(rows[1].frontier).toBe(false);
  });
  it("knows the one neutral grey whatever its case", () => {
    expect(isNeutralLab(labs[2])).toBe(true);
    expect(isNeutralLab(labs[3])).toBe(true);
    expect(isNeutralLab(labs[0])).toBe(false);
    expect(isNeutralLab(undefined)).toBe(true);
  });
  it("caps the key at eight rows with one Other row at the end", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ id: `l${i}`, name: `L${i}`, color: `c${i}`, neutral: false }));
    const capped = capRows(rows);
    expect(capped).toHaveLength(8);
    expect(capped.slice(0, 7).map((r) => r.id)).toEqual(rows.slice(0, 7).map((r) => r.id));
    expect(capped[7]).toMatchObject({ id: "other", name: "Other" });
    expect(capRows(rows.slice(0, 8))).toHaveLength(8);
    const withGrey = capRows([...rows.slice(0, 8), { id: "g", name: "Other", color: "grey", neutral: true }]);
    expect(withGrey.at(-1)).toMatchObject({ id: "other", color: "grey" });
  });
});

describe("chart key data", () => {
  it("lists the labs on the chart best first, with the neutral greys as one Other row last", () => {
    const { labRows } = keyData(base());
    expect(labRows.map((r) => r.name)).toEqual(["Alpha", "Beta", "Other"]);
    expect(labRows[2].labIds).toEqual(["grey-1", "grey-2"]);
    expect(labRows[2].neutral).toBe(true);
  });
  it("names the models the default trim leaves out", () => {
    const k = keyData(base());
    expect(k.trimmedModels.map((m) => m.id)).toEqual(["old"]);
    expect(k.defaultOut).toBe(1);
    expect(k.removed).toEqual([]);
  });
  it("leaves nothing out when the trim is off, but still counts what it would hold back", () => {
    const k = keyData(base({ trimmed: false, allModels: true, allPoints: [a, aLow, b, c, d, old], pts: [a, aLow, b, c, d, old] }));
    expect(k.trimmedModels).toEqual([]);
    expect(k.defaultOut).toBe(1);
    expect(keyData(base({ trimmed: false, allModels: false, canTrim: false })).defaultOut).toBe(0);
  });
  it("keeps a starred model out of what the trim holds back", () => {
    const k = keyData(base({ trimmed: false, allModels: true, keep: ["old"], allPoints: [a, aLow, b, c, d, old], pts: [a, aLow, b, c, d, old] }));
    expect(k.defaultOut).toBe(0);
  });
  it("lists a removed model whole and one removed effort of a model that stays", () => {
    const k = keyData(base({ pts: [a, c, d], allPoints: [a, aLow, b, c, d], hidden: { models: ["b"], efforts: ["a@low", "b@high"] } }));
    expect(k.removed.map((r) => r.key)).toEqual(["m:b", "e:a@low"]);
    expect(k.removed[0]).toMatchObject({ label: "B", modelId: "b", labId: "lab-b" });
    expect(k.removed[1]).toMatchObject({ label: "A low", modelId: "a", labId: "lab-a" });
    expect(k.removed[1].model?.id).toBe("a");
  });
  it("names a removed model the data no longer holds from the highlight list, else by its id", () => {
    const named = keyData(base({ hidden: { models: ["gone"], efforts: [] }, nameOf: (id) => (id === "gone" ? "Gone 1" : undefined) }));
    expect(named.removed[0]).toMatchObject({ label: "Gone 1", modelId: "gone", model: undefined });
    expect(keyData(base({ hidden: { models: ["gone"], efforts: [] } })).removed[0].label).toBe("gone");
  });
  it("finds a model removed from the chart even when the trim had already left it out", () => {
    const k = keyData(base({ hidden: { models: ["old"], efforts: [] } }));
    expect(k.removed[0].model?.id).toBe("old");
  });
});
