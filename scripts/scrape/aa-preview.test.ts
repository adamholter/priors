import { describe, expect, it } from "vitest";
import { resolveAAIdentity } from "./aa-identity";
import { AA_PREVIEW, pendingPreviews } from "./aa-preview";

describe("AA announced-but-unlisted results", () => {
  it("stands in for the missing model, one record per effort, with the same identity AA's own rows get", () => {
    const rows = pendingPreviews([{ name: "GPT-6.1 Sol" }]);
    expect(rows).toHaveLength(AA_PREVIEW[0].efforts.length);
    const ids = rows.map((r) => resolveAAIdentity(r.ev, r.tbl).variantId);
    expect(ids).toEqual(["max", "xhigh", "high", "medium", "low", "none"].map((e) => `gpt-6.1-terra@${e}`));
    const max = rows[0];
    expect(max.ev.intelligenceIndex).toBe(48);
    expect(max.ev.omniscienceBreakdown).toEqual({ accuracy: 0.49, hallucinationRate: 0.38 });
    expect(max.tbl.price1mBlended0To3To1).toBe(2);
    expect(max.ev.previewNote).toMatch(/not yet on artificialanalysis\.ai/);
  });
  it("only the max effort carries per-evaluation results", () => {
    const rows = pendingPreviews([]);
    expect(rows.filter((r) => r.ev.terminalBench40 !== undefined)).toHaveLength(1);
  });
  it("steps aside entirely once AA lists the model at any effort", () => {
    expect(pendingPreviews([{ name: "GPT-6.1 Terra", effort: { slug: "low" } }])).toEqual([]);
  });
});
