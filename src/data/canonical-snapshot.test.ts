import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { canonicalizeSnapshot } from "./canonical-snapshot";
import type { Snapshot, Variant } from "./types";
import { computeIndex, defaultConfig } from "../engine";
import { clientSnapshot } from "./client-snapshot";
import { featuredPoints, type ScatterPoint } from "../components/chart/scatter-option";
const original = JSON.parse(gunzipSync(readFileSync("scripts/benchmarks/fixtures/builder-2026-10-06.json.gz")).toString()) as Snapshot;
const weights = { "aa-omniscience": 10, "frontiercode-1.1-extended": 10, "vals-vcb-1-100": 10, "vals-vibe-code-v1-1": 10 };

describe("canonical snapshot identities", () => {
  it("joins measured scores across sources instead of hiding duplicate ranking rows", () => {
    const snapshot = canonicalizeSnapshot(original);
    const result = computeIndex(snapshot, { ...defaultConfig(snapshot), weights, strictness: 0,
      variants: "all", estimateMissing: false, effortMatching: "strict" });
    const luna = result.ranked.find(r => r.variant.id === "gpt-5.6-luna@max")!;
    expect(luna.values.every(v => !v.estimated)).toBe(true);
    expect(luna.coverage).toBe(1);
    expect(luna.score).toBeCloseTo(((100 - 10.2833333333333) / 2 + 55.06 + 22.594 + 77.055) / 4, 10);
    const sonnet = result.ranked.find(r => r.variant.id === "claude-sonnet-5.5@max")!;
    expect(sonnet.coverage).toBe(0.75);
    expect(sonnet.score).toBeCloseTo(((100 + 32.3) / 2 + 59.09 + 92.392) / 3, 10);
    expect(sonnet.variant.sourceModel?.url).toMatch(/artificialanalysis/);
    expect(sonnet.variant.sourceModels?.some(s => s.id === "anthropic/claude-sonnet-5-5")).toBe(true);
  });

  it("preserves all measurement fields, source lineage, series and estimates", () => {
    const oldId = "claude-sonnet-5.5@max~vals-d123610543e5";
    const before: Snapshot = { ...original,
      series: [{ benchmarkId: "series", variantId: oldId, x: [1, 2], y: [3, 4], xLabel: "day", yLabel: "score", sourceUrl: "https://www.vals.ai" }],
      estimates: [{ benchmarkId: "estimated", variantId: oldId, value: 50, estimateKind: "cross-effort", sourceVariantId: oldId, evidence: ["paired measurements"] }],
    };
    const after = canonicalizeSnapshot(before);
    const omitId = ({ variantId: _id, ...measurement }: Snapshot["observations"][number]) => { void _id; return measurement; };
    expect(after.observations.map(omitId)).toEqual(before.observations.map(omitId));
    expect(after.series[0]).toEqual({ ...before.series[0], variantId: "claude-sonnet-5.5@max" });
    expect(after.estimates?.[0].sourceVariantId).toBe("claude-sonnet-5.5@max");
    const ids = new Set(after.variants.map(v => v.id));
    expect(after.observations.every(o => ids.has(o.variantId))).toBe(true);
  });

  it("is idempotent and variant-order independent, including client snapshots", () => {
    const after = canonicalizeSnapshot(original);
    expect(canonicalizeSnapshot(after)).toEqual(after);
    expect(canonicalizeSnapshot({ ...original, variants: [...original.variants].reverse() }).variants).toEqual(after.variants);
    expect(clientSnapshot(after).variants).toEqual(after.variants);
  });

  it("keeps saved source-qualified highlights attached to the corrected effort", () => {
    const snapshot = canonicalizeSnapshot(original);
    const result = computeIndex(snapshot, { ...defaultConfig(snapshot), weights, strictness: 0, variants: "all" });
    const pts: ScatterPoint[] = result.ranked.map(r => ({ r, x: r.costUsd ?? 1 }));
    const oldId = "claude-sonnet-5.5@max~vals-d123610543e5";
    expect(featuredPoints(pts, [oldId]).map(p => p.r.variant.id)).toEqual(["claude-sonnet-5.5@max"]);
    expect(featuredPoints(pts, [oldId, "claude-sonnet-5.5@max"]).length).toBe(1);
  });

  it("keeps old AA links working after a future scrape emits only canonical IDs", () => {
    const aa = original.variants.find(v => v.id === "claude-sonnet-5.5@max~aa-claude-sonnet-5-5-b171d979")!;
    const fresh: Snapshot = { ...original, variants: [{ ...aa, id: "claude-sonnet-5.5@max", configuration: undefined, aliases: undefined }], observations: [], series: [] };
    expect(canonicalizeSnapshot(fresh).variants[0].aliases).toContain(aa.id);
  });

  it("retains ambiguous source records rather than silently choosing a different score or cost", () => {
    const base: Variant = { id: "claude-sonnet-5.5@max", modelId: "claude-sonnet-5.5", effort: "max" };
    const scoped: Variant = { ...base, id: `${base.id}~vals-conflict`,
      sourceModel: { id: "anthropic/claude-sonnet-5-5", slug: "anthropic/claude-sonnet-5-5", name: "Claude Sonnet 5.5", url: "https://www.vals.ai" } };
    const s: Snapshot = { ...original, variants: [base, scoped], observations: [
      { benchmarkId: "same", variantId: base.id, value: 90, sourceModelId: "source-a", costUsd: 1, sourceUrl: "https://a.example", observedAt: "2026-10-06" },
      { benchmarkId: "same", variantId: scoped.id, value: 80, sourceModelId: "source-b", costUsd: 2, sourceUrl: "https://b.example", observedAt: "2026-10-06" },
    ] };
    const after = canonicalizeSnapshot(s);
    expect(after.variants.map(v => v.id)).toEqual([base.id, scoped.id]);
    expect(after.observations).toEqual(s.observations);
  });
});
