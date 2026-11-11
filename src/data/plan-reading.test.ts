import { describe, expect, it } from "vitest";
import { planReadingSettings, planReadings, subscriptionPrices } from "./subscription";
import { decodeIndex, encodeIndex } from "@/lib/url";
import type { Snapshot } from "./types";

const readings = [
  { id: "shared", name: "Shared limit", ratio: 0.015135 * 2.4267, note: "shared" },
  { id: "own", name: "Fable only", ratio: 0.015135 * (3421 / 705), note: "own" },
];
const snapshot = {
  date: "2026-11-11", generatedAt: "2026-11-11T00:00:00Z", labs: [{ id: "anthropic", name: "Anthropic" }],
  models: [{ id: "claude-fable-5.2", name: "Claude Fable 5.2", labId: "anthropic" }],
  variants: [{ id: "claude-fable-5.2@max", modelId: "claude-fable-5.2" }],
  benchmarks: [{ id: "subscription-token-price", name: "Subscription token price" }],
  observations: [{ benchmarkId: "subscription-token-price", variantId: "claude-fable-5.2@max", value: readings[0].ratio, details: { plan: "Claude Ultra", feeUsd: 200, confidence: "medium", ratio: readings[0].ratio, readings, plans: [] } }],
} as unknown as Snapshot;

describe("plan rate readings", () => {
  it("defaults to the first reading (shared weekly limit) and switches to another by id", () => {
    expect(subscriptionPrices(snapshot).get("claude-fable-5.2")).toMatchObject({ ratio: readings[0].ratio, reading: "shared" });
    expect(subscriptionPrices(snapshot, {}, { reading: "own" }).get("claude-fable-5.2")!.ratio).toBeCloseTo(0.0734, 4);
    expect(subscriptionPrices(snapshot, {}, { reading: "nonsense" }).get("claude-fable-5.2")!.ratio).toBeCloseTo(0.03673, 5);
  });
  it("offers the toggle only when a model has readings, and stores nothing for the default", () => {
    expect(planReadings(snapshot)).toHaveLength(1);
    const picked: (string | undefined)[] = [];
    const settings = planReadingSettings(snapshot, undefined, (r) => picked.push(r))!;
    expect(settings.value).toBe("shared");
    settings.onChange("own"); settings.onChange("shared");
    expect(picked).toEqual(["own", undefined]);
    expect(planReadingSettings({ ...snapshot, observations: [] } as Snapshot, undefined, () => {})).toBeUndefined();
  });
  it("round-trips through the index link", () => {
    const base = decodeIndex("General|swe:50,term:50", "a")!, c = { ...base, planReading: "own" };
    expect(encodeIndex(c)).toContain("reading=own");
    expect(decodeIndex(encodeIndex(c), "a")).toEqual(c);
    expect(encodeIndex(base)).not.toContain("reading=");
  });
});
