import { describe, expect, it } from "vitest";
import { INDEX_CONFIG_FIELDS, storableIndex } from "../../convex/validators";
import { defaultConfig, type IndexConfig } from "../engine";
import { decodeIndex, encodeIndex } from "./url";
import { loadSnapshot } from "../data/load";

// Every way the app produces an index must produce only fields the database stores. A new runtime
// key (like `focus` was) fails here instead of failing the user's "Save to my page" in production.
const fields = new Set<string>(INDEX_CONFIG_FIELDS);
const unknownKeys = (c: object) => Object.keys(c).filter((k) => !fields.has(k));

const maximal: IndexConfig = {
  id: "i0", name: "Everything", weights: { "deepswe-1.1": 40, simplebench: 60 }, required: ["deepswe-1.1"], optional: [], cutoff: 5, estimateMissing: false,
  variants: "all", effortMatching: "strict", strictness: 70, rankingVariants: "all", paretoVariants: "best", costSource: "terminalbench-4", timeSource: "deepswe-1.1",
  labs: ["openai"], excludeModels: ["gpt-5.5"], releasedAfter: "", focus: "knowledge", highlight: ["claude-opus-5", "gpt-6-astra@low"],
};

describe("stored index configs", () => {
  it("default, URL-decoded and onboarding configs carry no fields the database rejects", async () => {
    const snapshot = (await loadSnapshot())!;
    const decoded = decodeIndex(encodeIndex(maximal), "i0")!;
    for (const c of [defaultConfig(snapshot), decoded, maximal, { ...defaultConfig(snapshot), focus: "capabilities" as const }]) expect(unknownKeys(c)).toEqual([]);
  });
  it("round-trips every stored field and drops transient keys before a write", () => {
    expect(storableIndex(maximal)).toEqual(maximal);
    const withTransient = { ...maximal, draft: true, view: { x: 1 } } as unknown as IndexConfig;
    expect(storableIndex(withTransient)).toEqual(maximal);
  });
});
