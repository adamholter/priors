import { describe, expect, it } from "vitest";
import { planUsageEstimates, PLAN_USAGE_SAMPLES, type PlanUsageSample } from "./sources/subscription-overrides";

const base = PLAN_USAGE_SAMPLES[0], sample = (extra: Partial<PlanUsageSample>): PlanUsageSample => ({ ...base, ...extra });

describe("plan usage samples", () => {
  it("turns one user's full allowance into the share of API price paid", () => {
    const [e] = planUsageEstimates([base]);
    expect(1 / e.ratio).toBeCloseTo(87.76 / 18, 6);
    expect(e.preliminary).toMatchObject({ label: "Preliminary", credit: "@SSHCodes", samples: 1 });
  });
  it("matches the tokens at the stated list prices", () => {
    const { tokens: t, listPrice: p, apiUsd } = base;
    expect((t.cached * p.cached + t.input * p.input + t.output * p.output) / 1e6).toBeCloseTo(apiUsd, 0);
  });
  it("scales partial use up to a full allowance, takes the median person and credits everyone", () => {
    const [e] = planUsageEstimates([base, sample({ by: "@b", apiUsd: 30, usedShare: 0.5 }), sample({ by: "@c", apiUsd: 180 })]);
    expect(1 / e.ratio).toBeCloseTo(87.76 / 18, 6);
    expect(e.preliminary.short).toBe("From 3 users' data (@SSHCodes, @b, @c), pending larger-scale data.");
  });
  it("keeps other Qwen models and other plans as their own estimates", () => {
    expect(planUsageEstimates([base, sample({ modelId: "qwen-3.8-max" }), sample({ plan: "Qwen Token Plan Pro", feeUsd: 43 })])).toHaveLength(3);
  });
});
