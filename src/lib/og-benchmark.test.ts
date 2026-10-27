import { describe, expect, it } from "vitest";
import { loadSnapshot } from "@/data/load";
import { benchmarkDescription, benchmarkStanding, renderBenchmarkCard } from "./og-benchmark";

describe("benchmark share card", async () => {
  const snap = (await loadSnapshot())!;

  it("previews the leaders with published values and the leader's plan cost against the API", () => {
    const s = benchmarkStanding(snap, "frontiercode-1.1-main")!;
    const text = benchmarkDescription(s);
    expect(text).toMatch(/^FrontierCode 1\.1 Main: .+ leads at \d+\.\d%/);
    expect(text).toMatch(/costs \$[\d.]+ per task, not \$[\d.]+ at API prices\./);
    expect(text).not.toMatch(/—/);
  });

  it("renders a PNG card with and without a cost chart, and nothing for an unknown id", () => {
    for (const id of ["frontiercode-1.1-main", "arena-text"]) {
      const png = renderBenchmarkCard(snap, id);
      expect(png?.subarray(1, 4).toString()).toBe("PNG");
    }
    expect(renderBenchmarkCard(snap, "nope")).toBeNull();
  });

  it("uses the benchmark's own published results only", () => {
    const s = benchmarkStanding(snap, "deepswe-1.1")!;
    expect(s.ranked.every((r) => r.values.every((v) => !v.estimated))).toBe(true);
  });
});
