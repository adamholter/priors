import { describe, expect, it } from "vitest";
import { packSnapshot, unpackSnapshot } from "./packed-snapshot";
import type { Snapshot } from "./types";

const snap = (): Snapshot => ({
  version: 1, date: "2026-10-28", generatedAt: "2026-10-28T12:00:00Z", labs: [], models: [], variants: [], benchmarks: [], series: [], sources: [],
  observations: [
    { benchmarkId: "a", variantId: "m@high", value: 50, observedAt: "", sourceUrl: "https://a.example", ci: [48, 52], harness: "codex" },
    { benchmarkId: "a", variantId: "n@max", value: 40, observedAt: "", sourceUrl: "https://a.example", costUsd: 1.5, sourceModelId: "n", note: "estimated" },
    { benchmarkId: "b", variantId: "m@high", value: 7, observedAt: "", sourceUrl: "https://b.example", details: { priorsEstimate: 1 }, rank: 2, harness: "codex" },
  ],
});

describe("packed snapshot", () => {
  it("round-trips every observation field", () => {
    const s = snap();
    expect(unpackSnapshot(JSON.parse(JSON.stringify(packSnapshot(s))))).toEqual(s);
  });
  it("names each benchmark, variant and page once on the wire, and unpacked rows share those strings", () => {
    const packed = packSnapshot(snap());
    expect(packed.packed).toMatchObject({ benchmarks: ["a", "b"], variants: ["m@high", "n@max"], urls: ["https://a.example", "https://b.example"] });
    expect(JSON.stringify(packed)).not.toContain("observedAt");
    const out = unpackSnapshot(JSON.parse(JSON.stringify(packed)));
    expect(out.observations[0].harness).toBe(out.observations[2].harness);
  });
  it("passes a plain snapshot through", () => {
    const s = snap();
    expect(unpackSnapshot(s)).toBe(s);
  });
});
