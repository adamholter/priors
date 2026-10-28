import { describe, expect, it } from "vitest";
import { loadSnapshot } from "@/data/load";
import { benchmarkDescription, benchmarkStanding, renderBenchmarkCard, renderBenchmarkChart } from "./og-benchmark";
import { encodeIndex } from "./url";
import { benchmarkIndex, benchmarkSnapshot } from "./benchmark-page";

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

  it("draws the chart a copied link names, in its settings and scheme, instead of the general card", async () => {
    const id = "frontiercode-1.1-main", i = encodeIndex({ ...benchmarkIndex(benchmarkSnapshot(snap, id), id), costBasis: "api" });
    const general = renderBenchmarkCard(snap, id)!;
    for (const c of ["rankings", "cost"]) {
      const png = await renderBenchmarkChart(snap, id, new URLSearchParams({ c, i, scheme: "dark" }));
      expect(png?.subarray(1, 4).toString()).toBe("PNG");
      expect(png!.equals(general)).toBe(false);
    }
    // Light and dark differ: the card is drawn in the scheme it was copied in.
    const light = await renderBenchmarkChart(snap, id, new URLSearchParams({ c: "cost", i, scheme: "light" }));
    const dark = await renderBenchmarkChart(snap, id, new URLSearchParams({ c: "cost", i, scheme: "dark" }));
    expect(light!.equals(dark!)).toBe(false);
    expect(await renderBenchmarkChart(snap, "nope", new URLSearchParams({ c: "cost" }))).toBeNull();
  });
});
