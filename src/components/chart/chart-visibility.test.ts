import { describe, expect, it } from "vitest";
import type { RankedVariant } from "@/engine";
import type { ScatterPoint } from "./scatter-option";
import { EMPTY_HIDDEN, hideChartPoint, visiblePoints, readChartHidden, setChartHidden } from "./chart-visibility";

const point = (model: string, effort: string, source = ""): ScatterPoint => ({
  x: 5, r: { model: { id: model }, variant: { id: `${model}@${effort}${source}`, effort } } as RankedVariant,
});
const low = point("opus", "low"), high = point("opus", "high"), qualified = point("opus", "high", "~fallback"), other = point("sol", "high");
const points = [low, high, qualified, other];
describe("chart removals", () => {
  it("removes one model/effort combination across provenance variants and keeps the other efforts", () => {
    const hidden = hideChartPoint(EMPTY_HIDDEN, high);
    expect(visiblePoints(points, hidden)).toEqual([low, other]);
    expect(visiblePoints(points, EMPTY_HIDDEN)).toEqual(points);
  });
  it("removes every effort of a model without removing another model", () => {
    const hidden = hideChartPoint(hideChartPoint(EMPTY_HIDDEN, high), low, true);
    expect(visiblePoints(points, hidden)).toEqual([other]);
    expect(EMPTY_HIDDEN).toEqual({ efforts: [], models: [] });
  });
  it("round trips independent chart removals through a copied URL and clears only the undone chart", () => {
    const first = hideChartPoint(EMPTY_HIDDEN, high);
    const second = hideChartPoint(EMPTY_HIDDEN, other, true);
    const url = setChartHidden(setChartHidden(new URL("https://mypriors.com/builder?cs=linear#cost"), "cost", first), "time-per-task", second);
    const reloaded = new URL(url.toString());
    expect(visiblePoints(points, readChartHidden(reloaded.searchParams, "cost"))).toEqual([low, other]);
    expect(visiblePoints(points, readChartHidden(reloaded.searchParams, "time-per-task"))).toEqual([low, high, qualified]);
    expect(readChartHidden(reloaded.searchParams, "output-speed")).toEqual(EMPTY_HIDDEN);
    setChartHidden(reloaded, "cost", EMPTY_HIDDEN);
    expect(readChartHidden(reloaded.searchParams, "cost")).toEqual(EMPTY_HIDDEN);
    expect(readChartHidden(reloaded.searchParams, "time-per-task")).toEqual(second);
    expect(reloaded.searchParams.get("cs")).toBe("linear");
    expect(reloaded.hash).toBe("#cost");
  });
  it("ignores malformed URL state and deduplicates valid ids", () => {
    const params = new URLSearchParams();
    for (const value of ["{", '["cost",null,[]]', '["cost",["sol","sol",null],["opus@high","opus@high"]]']) params.append("ch", value);
    expect(readChartHidden(params, "cost")).toEqual({ models: ["sol"], efforts: ["opus@high"] });
  });
});
