import { describe, expect, it } from "vitest";
import type { RankedVariant } from "@/engine";
import { decodeIndex, encodeIndex } from "@/lib/url";
import { metricPanels, chartLabel, modelLabel } from "@/lib/metrics";
import { clientSnapshot } from "./client-snapshot";
import { SUBSCRIPTION_BENCHMARK } from "./subscription";
import { baseModelId, speedTierLegend, speedTierNote, speedTierRows, tierModelIds, withSpeedTiers } from "./speed-tiers";
import { hasComputedTime, hasMeasuredTime } from "./task-metrics";
import type { Snapshot } from "./types";

const STANDARD_MIX = { cache: 0.97, input: 0.025, output: 0.005 };
const plans = (fee: number, usd: number, plan: string) => ({ plan, feeUsd: fee, usdPerMtok: usd, confidence: "medium" });
/** The plan's token price over this list price gives Sol's share of API price; Pro 500 here is half of Pro 10x, so a test can tell which one a tier used. */
const sol = { mix: STANDARD_MIX, listPrice: { cached: 0.1, input: 2, output: 10 } };
const snapshot = {
  date: "2026-11-05", labs: [{ id: "openai", name: "OpenAI" }, { id: "anthropic", name: "Anthropic" }, { id: "google", name: "Google" }],
  models: [{ id: "gpt-6.1-sol", labId: "openai" }, { id: "claude-opus-5.5", labId: "anthropic" }, { id: "gemini-4", labId: "google" }],
  variants: [{ id: "gpt-6.1-sol@high", modelId: "gpt-6.1-sol", effort: "high" }, { id: "claude-opus-5.5@high", modelId: "claude-opus-5.5", effort: "high" }, { id: "gemini-4@high", modelId: "gemini-4", effort: "high" }],
  benchmarks: [{ id: SUBSCRIPTION_BENCHMARK }, { id: "aa-intelligence-index-v5.0.1" }],
  observations: [
    { benchmarkId: SUBSCRIPTION_BENCHMARK, variantId: "gpt-6.1-sol@high", value: 0.02, details: { plan: "ChatGPT Pro 10x", feeUsd: 100, confidence: "high", ...sol, plans: [plans(100, 0.02, "ChatGPT Pro 10x"), plans(500, 0.01, "ChatGPT Pro 500")] } },
    { benchmarkId: "aa-intelligence-index-v5.0.1", variantId: "gpt-6.1-sol@high", value: 50, details: { estimatedDecodeSecondsPerTask: 300 } },
    { benchmarkId: "aa-intelligence-index-v5.0.1", variantId: "gemini-4@high", value: 50, details: { estimatedDecodeSecondsPerTask: 100 } },
    { benchmarkId: "aa-intelligence-index-v5.0.1", variantId: "claude-opus-5.5@high", value: 50, details: { estimatedDecodeSecondsPerTask: 200 } },
  ],
  speedTiers: {
    rates: [
      { modelId: "gpt-6.1-sol", tier: "flex", priceMultiple: 0.5, speedMultiple: 1.1, speedSource: "Artificial Analysis, max effort", errorRate: 0.074 },
      { modelId: "gpt-6.1-sol", tier: "fast", priceMultiple: 2, speedMultiple: 1.5, speedSource: "Artificial Analysis, max effort" },
      { modelId: "gpt-6.1-sol", tier: "ultrafast", priceMultiple: 6, speedMultiple: 4, speedSource: "Artificial Analysis, max effort" },
      { modelId: "claude-opus-5.5", tier: "fast", priceMultiple: 2, speedMultiple: 2.4, speedSource: "OpenRouter, real traffic" },
    ],
    planRates: [
      { labId: "openai", tier: "fast", usageMultiple: 2.5, source: "doc" },
      { labId: "openai", tier: "ultrafast", usageMultiple: 8, plan: "ChatGPT Pro 500", source: "doc" },
    ],
  },
  series: [], sources: [],
} as unknown as Snapshot;

const row = (modelId: string, labId: string, over: Partial<RankedVariant> = {}): RankedVariant => ({
  variant: { id: `${modelId}@high`, modelId, effort: "high" }, model: { id: modelId, labId, name: modelId }, score: 50, coverage: 1, measuredShare: 1, values: [], onFrontier: false, rank: 1, speed: 100, ...over,
} as unknown as RankedVariant);
/** On subscription pricing: $1 a task on the API, so $0.10 at a 0.1 share. */
const solOnPlan = (ratio: number) => row("gpt-6.1-sol", "openai", { costUsd: ratio, costPlan: { ratio, plan: "ChatGPT Pro 10x", confidence: "high" } });
const opusOnPlan = () => row("claude-opus-5.5", "anthropic", { costUsd: 0.05, costPlan: { ratio: 0.05, plan: "Claude Ultra", confidence: "high" } });
const close = (a: number | undefined, b: number) => expect(a).toBeCloseTo(b, 6);
/** Pro 10x's own share of API price at the test's mix, and Pro 500's, which is half. */
const blended = 0.97 * 0.1 + 0.025 * 2 + 0.005 * 10, proShare = 0.02 / blended, pro500Share = 0.01 / blended;

describe("what a tier does to a model", () => {
  it("leaves rows alone with nothing picked, or only standard", () => {
    const rows = [solOnPlan(proShare)];
    expect(withSpeedTiers(rows, snapshot, undefined)).toBe(rows);
    expect(withSpeedTiers(rows, snapshot, ["standard"])).toBe(rows);
  });
  it("on the API, moves cost by the tier's price and speed by its measured speed", () => {
    const [fast] = withSpeedTiers([row("gpt-6.1-sol", "openai", { costUsd: 1 })], snapshot, ["fast"]);
    expect(fast.costUsd).toBe(2);
    expect(fast.speed).toBe(150);
    expect(fast.score).toBe(50);
    expect(fast.costPlan).toBeUndefined();
    expect(fast.speedTier?.apiRates).toBeUndefined();
  });
  it("on a plan, Fast spends the allowance at 2.5x the plan's own price", () => {
    const [fast] = withSpeedTiers([solOnPlan(proShare)], snapshot, ["fast"]);
    close(fast.costUsd, proShare * 2.5);
    expect(fast.costPlan?.plan).toBe("ChatGPT Pro 10x");
    close(fast.costPlan?.ratio, proShare * 2.5 / 2);
    expect(fast.speedTier).toMatchObject({ usageMultiple: 2.5, plan: "ChatGPT Pro 10x" });
  });
  it("on a plan, Ultrafast is priced on Pro 500 whichever plan the chart uses, so it shows a subsidy", () => {
    const [ultra] = withSpeedTiers([solOnPlan(proShare)], snapshot, ["ultrafast"]);
    close(ultra.costUsd, pro500Share * 8);
    expect(ultra.costPlan?.plan).toBe("ChatGPT Pro 500");
    close(ultra.costPlan?.ratio, pro500Share * 8 / 6);
    expect(ultra.costUsd!).toBeLessThan(6);
  });
  it("carries limit resets over to Pro 500", () => {
    const [ultra] = withSpeedTiers([solOnPlan(proShare / 2)], snapshot, ["ultrafast"]);
    close(ultra.costUsd, pro500Share / 2 * 8);
  });
  it("bills Opus Fast at API rates even on subscription pricing, and says so", () => {
    const [fast] = withSpeedTiers([opusOnPlan()], snapshot, ["fast"]);
    close(fast.costUsd, 2);
    expect(fast.costPlan).toBeUndefined();
    expect(fast.speedTier?.apiRates).toBe(true);
    expect(modelLabel(fast)).toBe("claude-opus-5.5 Fast, API rates");
    expect(chartLabel(fast)).toBe("claude-opus-5.5 Fast high, API rates");
    expect(fast.costSource).toMatch(/billed at API rates/);
  });
  it("bills Flex at half the API price, more than the plan costs", () => {
    const [flex] = withSpeedTiers([solOnPlan(proShare)], snapshot, ["flex"]);
    close(flex.costUsd, 0.5);
    expect(flex.costUsd!).toBeGreaterThan(proShare);
    expect(flex.speedTier?.apiRates).toBe(true);
  });
  it("does not name API rates when the whole chart is on the API", () => {
    const [flex] = withSpeedTiers([row("gpt-6.1-sol", "openai", { costUsd: 1 })], snapshot, ["flex"]);
    expect(flex.costUsd).toBe(0.5);
    expect(modelLabel(flex)).toBe("gpt-6.1-sol Flex");
  });
  it("falls back to API rates when Pro 500 is not in the data, never to another plan's price", () => {
    const old = { ...snapshot, observations: snapshot.observations.map((o) => o.benchmarkId === SUBSCRIPTION_BENCHMARK ? { ...o, details: { ...o.details, plans: [plans(100, 0.02, "ChatGPT Pro 10x")] } } : o) } as Snapshot;
    const [ultra] = withSpeedTiers([solOnPlan(proShare)], old, ["ultrafast"]);
    close(ultra.costUsd, 6);
    expect(ultra.speedTier?.apiRates).toBe(true);
  });
  it("draws nothing for a free tier, which has no API cost to scale", () => {
    const free = row("gpt-6.1-sol", "openai", { costUsd: 0, costPlan: { ratio: 0, plan: "Free", confidence: "high" } });
    expect(withSpeedTiers([free], snapshot, ["fast"])).toEqual([free]);
  });
});

describe("which rows a pick draws", () => {
  const rows = [row("gpt-6.1-sol", "openai", { costUsd: 1 }), row("claude-opus-5.5", "anthropic", { costUsd: 1 }), row("gemini-4", "google", { costUsd: 1 })];
  const ids = (tiers: string[]) => withSpeedTiers(rows, snapshot, tiers).map((r) => r.model.id);
  it("replaces standard where a model has the tier, and keeps every other model", () => {
    expect(ids(["fast"])).toEqual(["gpt-6.1-sol+fast", "claude-opus-5.5+fast", "gemini-4"]);
    expect(ids(["ultrafast"])).toEqual(["gpt-6.1-sol+ultrafast", "claude-opus-5.5", "gemini-4"]);
  });
  it("keeps standard beside the tier when Standard stays on", () => {
    expect(ids(["standard", "fast"])).toEqual(["gpt-6.1-sol", "gpt-6.1-sol+fast", "claude-opus-5.5", "claude-opus-5.5+fast", "gemini-4"]);
  });
  it("gives a tier its own model and variant ids, so effort lines never cross tiers", () => {
    const [fast] = withSpeedTiers(rows, snapshot, ["fast"]);
    expect(fast.variant.id).toBe("gpt-6.1-sol+fast@high");
    expect(baseModelId(fast.model.id)).toBe("gpt-6.1-sol");
    expect(tierModelIds("gpt-6.1-sol")).toContain("gpt-6.1-sol+ultrafast");
  });
  it("keeps a model at standard on a speed chart when its tier has no measured speed", () => {
    const unmeasured = { ...snapshot, speedTiers: { rates: [{ modelId: "gemini-4", tier: "fast", priceMultiple: 2 }], planRates: [] } } as unknown as Snapshot;
    expect(withSpeedTiers(rows, unmeasured, ["fast"], {}, { chart: "speed" }).map((r) => r.model.id)).toEqual(["gpt-6.1-sol", "claude-opus-5.5", "gemini-4"]);
    expect(withSpeedTiers(rows, unmeasured, ["fast"], {}, { chart: "cost" }).map((r) => r.model.id)).toEqual(["gpt-6.1-sol", "claude-opus-5.5", "gemini-4+fast"]);
  });
});

describe("time per task", () => {
  /** AA's computed decode time, which a tier scales: same tokens, faster. */
  const computed = [row("gpt-6.1-sol", "openai", { timeSec: 300, timeComputed: true }), row("claude-opus-5.5", "anthropic", { timeSec: 200, timeComputed: true }), row("gemini-4", "google", { timeSec: 100, timeComputed: true })];
  /** The mix's blend of measured runs, which a tier does not scale: it also holds the time tools take. */
  const measured = computed.map((r) => ({ ...r, timeComputed: false }));
  const time = (r: RankedVariant[]) => metricPanels(snapshot, r).find((p) => p.id === "tpt")?.chart?.points(r) ?? [];
  it("divides AA's computed time by the tier's speed: same tokens, faster", () => {
    const pts = time(withSpeedTiers(computed, snapshot, ["fast"], {}, { chart: "speed" }));
    expect(pts.map((p) => [p.r.model.id, p.x])).toEqual([["gpt-6.1-sol+fast", 300 / 1.5], ["claude-opus-5.5+fast", 200 / 2.4], ["gemini-4", 100]]);
  });
  it("does not scale a measured run, which also holds tool time", () => {
    // Gemini has no tier, so it stays standard and is the only row drawn.
    const pts = time(withSpeedTiers(measured, snapshot, ["fast"], {}, { chart: "speed" }));
    expect(pts.map((p) => [p.r.model.id, p.x])).toEqual([["gemini-4", 100]]);
  });
  it("offers tiers on a computed chart and withholds them on a measured one", () => {
    // The gallery and the share card both gate on this: `hasMeasuredTime` is the opposite test, and gating on it inverted both cases.
    expect(hasComputedTime(computed)).toBe(true);
    expect(hasComputedTime(measured)).toBe(false);
    expect(hasMeasuredTime(computed)).toBe(false);
    expect(hasMeasuredTime(measured)).toBe(true);
    // Mixed: the tier scales the computed row and replaces the measured one, which it cannot scale.
    const mixed = [{ ...computed[0] }, { ...measured[1] }];
    expect(hasComputedTime(mixed) && hasMeasuredTime(mixed)).toBe(true);
    const pts = time(withSpeedTiers(mixed, snapshot, ["fast"], {}, { chart: "speed" }));
    expect(pts.map((p) => [p.r.model.id, p.x])).toEqual([["gpt-6.1-sol+fast", 300 / 1.5]]);
  });
});

describe("what the page says", () => {
  it("lists each tier's price and how each lab bills it, from the data", () => {
    expect(speedTierRows(snapshot)).toEqual([
      { tier: "flex", name: "Flex", text: "0.5x API price, billed at API rates." },
      { tier: "fast", name: "Fast", text: "OpenAI: 2x API price, or 2.5x usage on a plan. Anthropic: 2x API price, billed at API rates." },
      { tier: "ultrafast", name: "Ultrafast", text: "6x API price, or 8x usage on ChatGPT Pro 500." },
    ]);
  });
  it("says under the chart what was billed how, only when a tier is drawn", () => {
    expect(speedTierLegend([opusOnPlan()], "cost")).toBe("");
    const legend = speedTierLegend(withSpeedTiers([solOnPlan(proShare), opusOnPlan()], snapshot, ["fast", "ultrafast", "flex"]), "cost");
    expect(legend).toContain("Ultrafast spends ChatGPT Pro 500's allowance at 8x.");
    expect(legend).toContain("Fast spends the plan's allowance at 2.5x.");
    expect(legend).toContain("Marks named API rates cost what the API charges, since no plan covers that tier.");
    expect(speedTierLegend(withSpeedTiers([solOnPlan(proShare)], snapshot, ["fast"], {}, { chart: "speed" }), "speed")).toContain("Artificial Analysis");
  });
  it("names API billing on a cost chart only", () => {
    const [cost] = withSpeedTiers([opusOnPlan()], snapshot, ["fast"], {}, { chart: "cost" }), [speed] = withSpeedTiers([opusOnPlan()], snapshot, ["fast"], {}, { chart: "speed" });
    expect(modelLabel(cost)).toBe("claude-opus-5.5 Fast, API rates");
    expect(modelLabel(speed)).toBe("claude-opus-5.5 Fast");
  });
  it("names failed requests in a tier's note when they matter", () => {
    const [flex] = withSpeedTiers([row("gpt-6.1-sol", "openai", { costUsd: 1 })], snapshot, ["flex"]);
    expect(speedTierNote(flex)).toBe("Flex: 0.5x API price, 1.1x speed (Artificial Analysis, max effort), 7% of requests failed");
  });
});

describe("what carries it", () => {
  it("round-trips through a link, dropping unknown tiers", () => {
    const base = decodeIndex("Test|a:100", "t")!;
    const again = decodeIndex(encodeIndex({ ...base, speedTiers: ["standard", "fast"] }), "t")!;
    expect(again.speedTiers).toEqual(["standard", "fast"]);
    expect(decodeIndex("Test|a:100|tier=warp", "t")!.speedTiers).toBeUndefined();
    expect(encodeIndex(base)).not.toContain("tier=");
  });
  it("reaches the browser in the client snapshot", () => expect(clientSnapshot(snapshot).speedTiers).toEqual(snapshot.speedTiers));
});
