import { describe, expect, it } from "vitest";
import { AA_PERFORMANCE_V3, breaksFor, EPOCH_ECI_BAYESIAN, onAaPerformanceV3 } from "./series-breaks";
import { taskMetricDescription } from "./task-metrics";

describe("series breaks", () => {
  it("marks a mix or page that uses a changed benchmark, and no other", () => {
    expect(breaksFor(["aa-output-speed", "swe-bench"])).toEqual([AA_PERFORMANCE_V3]);
    expect(breaksFor(["aa-ttft"])).toEqual([AA_PERFORMANCE_V3]);
    expect(breaksFor(["swe-bench", "aa-intelligence-index-v5"])).toEqual([]);
    expect(breaksFor(["epoch-eci"])).toEqual([EPOCH_ECI_BAYESIAN]);
    expect(EPOCH_ECI_BAYESIAN.date).toBe("2026-11-04");
    expect(breaksFor(["epoch-eci", "aa-ttft"]).length).toBe(2);
  });
  it("splits AA's speed method at the first snapshot on it", () => {
    expect(onAaPerformanceV3("2026-11-03")).toBe(false);
    expect(onAaPerformanceV3("2026-11-04")).toBe(true);
    expect(onAaPerformanceV3()).toBe(true);
  });
  it("says AA's time per task is computed and leaves out tools, and an older snapshot keeps its own method", () => {
    const now = taskMetricDescription("aa", "time", "2026-11-04");
    expect(now).toMatch(/computed, not timed/);
    expect(now).toMatch(/without tool time/);
    expect(now).not.toMatch(/excluding first-token wait/);
    expect(taskMetricDescription("aa", "time", "2026-11-03")).toMatch(/excluding first-token wait/);
    expect(taskMetricDescription("deepswe-1.1", "time", "2026-11-04")).toMatch(/average task-run duration/);
  });
});
