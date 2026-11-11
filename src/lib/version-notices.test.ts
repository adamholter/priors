import { describe, expect, it } from "vitest";
import type { Benchmark } from "../data/types";
import type { IndexConfig } from "../engine";
import { encodeIndex } from "./url";
import { findNotices, indexUpgrades, newestVersions, noticeCopy, noticeKey, ownSavedIndices, upgradeIndex, upgradesByIndex, versionLabel } from "./version-notices";

type B = Pick<Benchmark, "id" | "name" | "versionPolicy">;
const tb: B[] = [
  { id: "terminalbench-2.1", name: "Terminal-Bench 2.1", versionPolicy: { kind: "fresh" } },
  { id: "terminalbench-4", name: "Terminal-Bench 4.0", versionPolicy: { kind: "fresh", supersedes: "terminalbench-2.1" } },
  { id: "terminalbench-4.1", name: "Terminal-Bench 4.1", versionPolicy: { kind: "fresh", supersedes: "terminalbench-4" } },
  { id: "deepswe-1", name: "DeepSWE v1" },
  { id: "deepswe-1.1", name: "DeepSWE v1.1", versionPolicy: { kind: "fallback", fallbackTo: "deepswe-1" } },
  { id: "frontierswe-v1", name: "FrontierSWE v1", versionPolicy: { kind: "fresh" } },
  { id: "frontierswe-v2", name: "FrontierSWE v2", versionPolicy: { kind: "fresh", supersedes: "frontierswe-v1" } },
  { id: "gpqa", name: "GPQA Diamond" },
];
const idx = (name: string, weights: Record<string, number>, extra: Partial<IndexConfig> = {}): IndexConfig => ({ id: name.toLowerCase(), name, weights, required: [], cutoff: 5, estimateMissing: true, variants: "best", ...extra });

describe("newestVersions", () => {
  it("follows supersedes to the newest version", () => {
    const n = newestVersions(tb);
    expect(n.get("terminalbench-4")).toBe("terminalbench-4.1");
    expect(n.get("terminalbench-2.1")).toBe("terminalbench-4.1");
    expect(n.has("terminalbench-4.1")).toBe(false);
    // A future 4.2 moves the end of the chain.
    const later = newestVersions([...tb, { id: "terminalbench-4.2", name: "Terminal-Bench 4.2", versionPolicy: { kind: "fresh", supersedes: "terminalbench-4.1" } }]);
    expect(later.get("terminalbench-4")).toBe("terminalbench-4.2");
    expect(later.get("terminalbench-4.1")).toBe("terminalbench-4.2");
  });
  it("ignores fallback versions", () => {
    expect(newestVersions(tb).has("deepswe-1")).toBe(false);
  });
  it("leaves out ambiguous and cyclic links", () => {
    expect(newestVersions([{ id: "a2", versionPolicy: { kind: "fresh", supersedes: "a" } }, { id: "a3", versionPolicy: { kind: "fresh", supersedes: "a" } }]).has("a")).toBe(false);
    const cyc = newestVersions([{ id: "x", versionPolicy: { kind: "fresh", supersedes: "y" } }, { id: "y", versionPolicy: { kind: "fresh", supersedes: "x" } }]);
    expect(cyc.get("y")).toBe("x"); // terminates
  });
});

describe("indexUpgrades", () => {
  const n = newestVersions(tb);
  it("finds weighted old versions", () => {
    expect(indexUpgrades(idx("Coding", { "terminalbench-4": 3, gpqa: 2 }), n)).toEqual([{ from: "terminalbench-4", to: "terminalbench-4.1" }]);
  });
  it("skips an index that already weights the newest version", () => {
    expect(indexUpgrades(idx("Coding", { "terminalbench-4": 3, "terminalbench-4.1": 1 }), n)).toEqual([]);
  });
  it("ignores zero weights and fallback pairs", () => {
    expect(indexUpgrades(idx("Coding", { "terminalbench-4": 0, "deepswe-1": 5 }), n)).toEqual([]);
  });
});

describe("upgradeIndex", () => {
  it("moves weight, required and optional, in place, and keeps the rest", () => {
    const before = idx("Coding", { gpqa: 2, "terminalbench-4": 3, "frontierswe-v1": 1 }, { required: ["terminalbench-4"], optional: ["terminalbench-4"], excludeModels: ["m"], highlight: ["h"], strictness: 70 });
    const after = upgradeIndex(before, [{ from: "terminalbench-4", to: "terminalbench-4.1" }]);
    expect(Object.entries(after.weights)).toEqual([["gpqa", 2], ["terminalbench-4.1", 3], ["frontierswe-v1", 1]]);
    expect(after.required).toEqual(["terminalbench-4.1"]);
    expect(after.optional).toEqual(["terminalbench-4.1"]);
    expect({ ...after, weights: before.weights, required: before.required, optional: before.optional }).toEqual(before);
  });
  it("adds weights when two old versions meet at the newest", () => {
    const after = upgradeIndex(idx("C", { "terminalbench-2.1": 1, "terminalbench-4": 2 }), [{ from: "terminalbench-2.1", to: "terminalbench-4.1" }, { from: "terminalbench-4", to: "terminalbench-4.1" }]);
    expect(after.weights).toEqual({ "terminalbench-4.1": 3 });
  });
  it("returns the same object when nothing applies", () => {
    const i = idx("C", { gpqa: 1 });
    expect(upgradeIndex(i, [{ from: "terminalbench-4", to: "terminalbench-4.1" }])).toBe(i);
  });
});

describe("findNotices", () => {
  const coding = idx("Coding", { "terminalbench-4": 3 }), agents = idx("Agents", { "terminalbench-4": 1, "frontierswe-v1": 1 });
  it("lists each index and pair, keyed by scope, index and pair", () => {
    const items = findNotices([{ scope: "builder", indices: [coding], keyOf: (i) => i.name }, { scope: "page", indices: [agents] }], tb);
    expect(items.map((i) => i.key)).toEqual([
      "builder:Coding:terminalbench-4>terminalbench-4.1",
      "page:agents:terminalbench-4>terminalbench-4.1",
      "page:agents:frontierswe-v1>frontierswe-v2",
    ]);
    expect(upgradesByIndex(items, "page").get("agents")).toEqual([{ from: "terminalbench-4", to: "terminalbench-4.1" }, { from: "frontierswe-v1", to: "frontierswe-v2" }]);
  });
  it("drops dismissed pairs, but a newer version comes back", () => {
    const dismissed = new Set([noticeKey("page", "coding", { from: "terminalbench-4", to: "terminalbench-4.1" })]);
    expect(findNotices([{ scope: "page", indices: [coding] }], tb, dismissed)).toEqual([]);
    const withNext = [...tb, { id: "terminalbench-4.2", name: "Terminal-Bench 4.2", versionPolicy: { kind: "fresh" as const, supersedes: "terminalbench-4.1" } }];
    expect(findNotices([{ scope: "page", indices: [coding] }], withNext, dismissed).map((i) => i.to)).toEqual(["terminalbench-4.2"]);
  });
});

describe("noticeCopy", () => {
  const items = (list: IndexConfig[]) => findNotices([{ scope: "page", indices: list }], tb);
  it("one index, one benchmark", () => {
    expect(noticeCopy(items([idx("Coding", { "terminalbench-4": 1 })]), tb)).toEqual({ lead: "Terminal-Bench 4.1 is out.", detail: "Your index “Coding” uses 4.0." });
  });
  it("groups several indexes and benchmarks into one notice", () => {
    expect(noticeCopy(items([idx("Coding", { "terminalbench-4": 1 }), idx("Agents", { "terminalbench-4": 1 })]), tb).detail).toBe("Your indexes “Coding” and “Agents” use 4.0.");
    expect(noticeCopy(items([idx("Coding", { "terminalbench-4": 1, "frontierswe-v1": 1 })]), tb)).toEqual({ lead: "New versions are out: Terminal-Bench 4.1 and FrontierSWE v2.", detail: "Your index “Coding” uses older ones." });
    const many = items(["A", "B", "C", "D", "E"].map((n) => idx(n, { "terminalbench-4": 1 })));
    expect(noticeCopy(many, tb).detail).toBe("Your indexes “A”, “B” and 3 more use 4.0.");
  });
  it("never uses an em dash", () => {
    const all = items([idx("Coding", { "terminalbench-4": 1, "terminalbench-2.1": 1, "frontierswe-v1": 1 })]);
    expect(JSON.stringify(noticeCopy(all, tb))).not.toMatch(/—/);
  });
  it("versionLabel", () => {
    expect(versionLabel("Terminal-Bench 4.0", "Terminal-Bench 4.1")).toBe("4.0");
    expect(versionLabel("AA-Omniscience", "AA-Omniscience v1.1")).toBe("AA-Omniscience");
  });
});

describe("ownSavedIndices", () => {
  const saved = [encodeIndex(idx("Coding", { "terminalbench-4": 3 })), encodeIndex(idx("Agents", { gpqa: 1 }))];
  it("is the saved list when the address carries no index, or the same ones in any order", () => {
    expect(ownSavedIndices(saved, [])?.map((i) => i.name)).toEqual(["Coding", "Agents"]);
    expect(ownSavedIndices(saved, [saved[1], saved[0]])?.length).toBe(2);
  });
  it("is null on a link with other indices, or on a first visit that arrives by link", () => {
    expect(ownSavedIndices(saved, [encodeIndex(idx("Theirs", { gpqa: 1 }))])).toBeNull();
    expect(ownSavedIndices([], [saved[0]])).toBeNull();
    expect(ownSavedIndices([], [])).toEqual([]);
  });
});
