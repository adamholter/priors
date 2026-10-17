import { describe, expect, it } from "vitest";
import { filterEfforts, rankingRows } from "./index";
import type { IndexConfig } from "./index";
import { modelLine, supersededModelIds } from "./superseded";
import type { RankedVariant } from "./index";

const row = (name: string, score: number, costUsd: number | undefined, onFrontier = false, labId = "lab", releaseDate?: string, effort = "high"): RankedVariant =>
  ({ model: { id: `${labId}-${name}`, name, labId, releaseDate }, variant: { id: `${name}@${effort}`, effort }, score, costUsd, onFrontier }) as unknown as RankedVariant;
const id = (name: string, labId = "lab") => `${labId}-${name}`;

describe("modelLine", () => {
  it("shares a line across versions of the same name", () => {
    expect(modelLine("o", "GPT-6.1 Sol")?.key).toBe(modelLine("o", "GPT-6 Sol")?.key);
    expect(modelLine("o", "GPT-6 Sol")?.key).not.toBe(modelLine("o", "GPT-6 Luna")?.key);
    expect(modelLine("o", "GPT-6.1 Sol")!.version).toBeGreaterThan(modelLine("o", "GPT-6 Sol")!.version);
  });
  it("does not read sizes or dated builds as versions", () => {
    expect(modelLine("m", "Llama 3 70b")?.key).toBe("m|llama # 70b");
    expect(modelLine("m", "Codestral 2508")).toBeUndefined();
  });
  it("keeps labs apart", () => { expect(modelLine("a", "Flash 2")?.key).not.toBe(modelLine("b", "Flash 2")?.key); });
});

describe("supersededModelIds", () => {
  it("drops an older version that is off the frontier", () => {
    const ranked = [row("GPT-6.1 Sol", 60, 1, true), row("GPT-6 Sol", 55, 2, false)];
    expect([...supersededModelIds(ranked)]).toEqual([id("GPT-6 Sol")]);
  });
  it("keeps an older version that is on the frontier", () => {
    const ranked = [row("GPT-6.1 Sol", 60, 2, true), row("GPT-6 Sol", 50, 0.5, true)];
    expect(supersededModelIds(ranked).size).toBe(0);
  });
  it("keeps an older model when its variant is on the frontier at any effort", () => {
    const ranked = [row("GPT-6.1 Sol", 60, 2, true), row("GPT-6 Sol", 40, 3, false, "lab", undefined, "low"), row("GPT-6 Sol", 52, 0.5, true, "lab", undefined, "max")];
    expect(supersededModelIds(ranked).size).toBe(0);
  });
  it("never judges a model with no measured cost", () => {
    expect(supersededModelIds([row("GPT-6.1 Sol", 60, 1, true), row("GPT-6 Sol", 55, undefined)]).size).toBe(0);
  });
  it("leaves different lines and labs alone", () => {
    const ranked = [row("GPT-6.1 Sol", 60, 1, true), row("GPT-6 Luna", 30, 2), row("GPT-6 Sol", 30, 2, false, "other")];
    expect(supersededModelIds(ranked).size).toBe(0);
  });
  it("needs the newer version to be no older by release date", () => {
    const ranked = [row("Opus 99", 60, 1, true, "lab", "2024-01-01"), row("Opus 5", 55, 2, false, "lab", "2026-05-01")];
    expect(supersededModelIds(ranked).size).toBe(0);
  });
  it("never drops a kept (highlighted) model", () => {
    const ranked = [row("GPT-6.1 Sol", 60, 1, true), row("GPT-6 Sol", 55, 2)];
    expect(supersededModelIds(ranked, [id("GPT-6 Sol")]).size).toBe(0);
  });
});

describe("filterEfforts", () => {
  const rows = ["none", "minimal", "low", "medium", "high", "xhigh", "max", "default"].map((e) => row("M", 1, 1, false, "l", undefined, e));
  const efforts = (list: RankedVariant[]) => list.map((r) => r.variant.effort);
  it("leaves out none by default and always keeps default", () => {
    expect(efforts(filterEfforts(rows))).toEqual(["minimal", "low", "medium", "high", "xhigh", "max", "default"]);
  });
  it("shows exactly the chosen efforts, minimal following low", () => {
    expect(efforts(filterEfforts(rows, ["none", "low"]))).toEqual(["none", "minimal", "low", "default"]);
    expect(efforts(filterEfforts(rows, []))).toEqual(["default"]);
  });
});

describe("the default view on the real snapshot", () => {
  it("leaves out superseded versions only for an uncurated page view, and never changes scores", async () => {
    const { loadSnapshot } = await import("../data/load");
    const { computeIndex, defaultConfig, PAGE_VIEW } = await import("./index");
    const snapshot = (await loadSnapshot())!;
    const config = { ...defaultConfig(snapshot), variants: "all" as const };
    const everything = computeIndex(snapshot, config);
    const page = computeIndex(snapshot, config, PAGE_VIEW);
    expect(everything.autoHidden).toEqual([]);
    expect(page.autoHidden.length).toBeGreaterThan(0);
    const shown = new Set(page.ranked.map((r) => r.model.id));
    for (const id of page.autoHidden) expect(shown.has(id)).toBe(false);
    expect(page.ranked.length).toBeLessThan(everything.ranked.length);
    const score = new Map(everything.ranked.map((r) => [r.variant.id, r.score]));
    for (const r of page.ranked) expect(r.score).toBe(score.get(r.variant.id));
    expect(page.ranked.map((r) => r.rank)).toEqual(page.ranked.map((_, i) => i + 1));
    // Every older version that stays is on the frontier, has no newer sibling, or has no measured cost.
    const curated = computeIndex(snapshot, { ...config, excludeModels: [] }, PAGE_VIEW);
    expect(curated.ranked.length).toBe(everything.ranked.length);
    expect(curated.autoHidden).toEqual([]);
  });
});

describe("rankingRows", () => {
  const rows = [row("A", 90, 1, false, "l", undefined, "high"), row("A", 80, 1, false, "l", undefined, "low"), row("B", 70, 1, false, "l", undefined, "none"), row("B", 60, 1, false, "l", undefined, "default")];
  const config = (extra: Partial<IndexConfig>) => ({ id: "x", name: "x", weights: {}, required: [], cutoff: 5, estimateMissing: true, variants: "all", ...extra }) as IndexConfig;
  it("shows each model's best effort, none included, until efforts are chosen", () => {
    expect(rankingRows(rows, config({})).map((r) => r.variant.id)).toEqual(["A@high", "B@none"]);
  });
  it("limits the list to the chosen efforts, then picks the best of what is left", () => {
    expect(rankingRows(rows, config({ rankingEfforts: ["low"] })).map((r) => r.variant.id)).toEqual(["A@low", "B@default"]);
    expect(rankingRows(rows, config({ rankingEfforts: ["low"], rankingVariants: "all" })).map((r) => r.variant.id)).toEqual(["A@low", "B@default"]);
  });
});
