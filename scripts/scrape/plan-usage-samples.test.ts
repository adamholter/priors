import { describe, expect, it } from "vitest";
import { planUsageEstimates, PLAN_USAGE_SAMPLES, type PlanUsageSample } from "./sources/subscription-overrides";

const base = PLAN_USAGE_SAMPLES.find((s) => s.modelId === "qwen-4-max")!, sample = (extra: Partial<PlanUsageSample>): PlanUsageSample => ({ ...base, ...extra });

describe("plan usage samples", () => {
  const estimate = (id: string, plan?: string) => planUsageEstimates().find((e) => e.modelId === id && (!plan || e.plan === plan))!;
  it("turns one user's full allowance into the share of API price paid", () => {
    const e = estimate("qwen-4-max");
    expect(1 / e.ratio).toBeCloseTo(87.76 / 18, 6);
    expect(e.preliminary).toMatchObject({ label: "Preliminary, 1 user", credit: "@SSHCodes", samples: 1 });
  });
  it("matches each sample's tokens at its list prices", () => {
    for (const { tokens: t, listPrice: p, apiUsd, by } of PLAN_USAGE_SAMPLES) expect(Math.abs((t.cached * p.cached + t.input * p.input + (t.cacheWrite ?? 0) * (p.cacheWrite ?? 0) + t.output * p.output) / 1e6 / apiUsd - 1), by).toBeLessThan(0.002);
  });
  it("prices Gemini 4 Neon across Google AI Pro, Ultra 5x, and Ultra 20x from direct readings", () => {
    const pro = estimate("gemini-4-neon", "Google AI Pro");
    const u5 = estimate("gemini-4-neon", "Google AI Ultra 5x");
    const u20 = estimate("gemini-4-neon", "Google AI Ultra 20x");
    expect(1 / pro.ratio).toBeCloseTo(20.8, 1);
    expect(1 / u5.ratio).toBeCloseTo(24.0, 1);
    expect(1 / u20.ratio).toBeCloseTo(48.0, 1);
    expect(pro.preliminary.label).toBe("Preliminary, 2 users");
    expect(pro.preliminary.sources).toEqual([{ by: "Ash", counted: true }, { by: "@Bolmercl", counted: true }]);
    expect(u5.preliminary.sources).toEqual([{ by: "Adam", counted: true }]);
    expect(u20.preliminary.sources).toEqual([{ by: "Pyrmi", counted: true }]);
  });
  it("takes Qwen3.8-Max's median user, says the usage was rescaled and links everyone", () => {
    const e = estimate("qwen-3.8-max");
    expect(1 / e.ratio).toBeCloseTo(7.81, 2);
    expect(e.preliminary.label).toBe("Preliminary, 3 users");
    expect(e.preliminary.short).toContain("Usage from August 2026, rescaled to today's quotas.");
    expect(e.preliminary.sources!.map((s) => s.by)).toEqual(["u/DertekAn", "u/Particular_Dingo_210", "u/Weak_Lock_4076"]);
  });
  it("mentions the Qwen4-Max-Preview reading without counting it", () => {
    const e = estimate("qwen-4-max");
    expect(e.preliminary.sources).toContainEqual({ by: "mamaruo", url: "https://github.com/Fei2411/real-api-pricing/issues/240", counted: false });
    expect(e.preliminary.note).toContain("retires November 25, 2026");
  });
  it("scales partial use up and keeps other models and plans apart", () => {
    const [e] = planUsageEstimates([base, sample({ by: "@b", apiUsd: 30, usedShare: 0.5 }), sample({ by: "@c", apiUsd: 180 })], []);
    expect(1 / e.ratio).toBeCloseTo(87.76 / 18, 6);
    expect(e.preliminary.short).toBe("From 3 users' data (@SSHCodes, @b, @c), pending larger-scale data.");
    expect(planUsageEstimates([base, sample({ modelId: "other" }), sample({ plan: "Qwen Token Plan Pro", feeUsd: 43 })], [])).toHaveLength(3);
  });
});
