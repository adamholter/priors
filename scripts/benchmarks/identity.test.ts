import { describe, expect, it } from "vitest";
import { identityBenchmark } from "./identity";

describe("model identity benchmark", () => {
  it("matches ordinary aliases, separates release/effort/configuration, and fixes the reported URL", () => {
    const report = identityBenchmark();
    expect(report.failures).toEqual([]);
    expect(report.pairs.falseMerges).toBe(0);
    expect(report.pairs.falseSplits).toBe(0);
    expect(report.reproduction.passed).toBe(true);
  });
  it("detects the frozen production regression", () => {
    const before = identityBenchmark(true);
    expect(before.reproduction.rows).toBe(18);
    expect(before.pairs.falseSplits).toBeGreaterThan(0);
    expect(before.passedAll).toBe(false);
  });
});
