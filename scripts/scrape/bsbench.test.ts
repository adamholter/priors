import { describe, expect, it } from "vitest";
import { clearRate } from "./sources/bsbench";

const row = (o: Record<string, string>) => ({ green_rate: "0.63", score_2: "63", nonsense_count: "100", refusal_count: "9", ...o });

describe("BullshitBench clear rate", () => {
  it("leaves refusals out, as the viewer ranks (Opus 5.5 low: 63 clear of 91 answered = 69.2%)", () => {
    expect(clearRate(row({}))! * 100).toBeCloseTo(69.23, 2);
    expect(clearRate(row({ score_2: "70", nonsense_count: "100", refusal_count: "11" }))! * 100).toBeCloseTo(78.65, 2);
  });
  it("matches green_rate when nothing was refused, and falls back to it without counts", () => {
    expect(clearRate(row({ score_2: "95", refusal_count: "0" }))).toBe(0.95);
    expect(clearRate({ green_rate: "0.4" })).toBe(0.4);
    expect(clearRate({ green_rate: "" })).toBeUndefined();
  });
});
