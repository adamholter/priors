import { describe, expect, it } from "vitest";
import type { Snapshot } from "../../src/data/types";
import { applyLaunchClaims, LAUNCH_CLAIMS, type LaunchClaim } from "./launch-claims";

const claim: LaunchClaim = { model: "Gemini 4 Carbon", effort: "high", releaseDate: "2026-10-28", by: "Google", url: "https://example.com", published: "2026-10-28", scores: { "board-a": 50, "board-b": 70, "board-c": 1 } };
const snapshot = (): Snapshot => ({
  version: 1, date: "2026-10-28", generatedAt: "", labs: [], series: [], sources: [],
  models: [{ id: "gemini-4", name: "Gemini 4 Argon", labId: "google", kind: "llm", reasoning: true, aliases: [] }],
  variants: [{ id: "gemini-4@high", modelId: "gemini-4", effort: "high" }],
  benchmarks: ["board-a", "board-b"].map((id) => ({ id, name: id, sourceId: id, url: "", description: "", unit: "percent", higherIsBetter: true, category: "coding", defaultWeight: 0, eligibleForDefault: true })),
  observations: [{ benchmarkId: "board-a", variantId: "gemini-4@high", value: 40, observedAt: "", sourceUrl: "" }],
});

describe("launch claims", () => {
  it("fills tracked boards for a model nobody has listed, as its own model, never the sibling's", () => {
    const s = snapshot();
    const r = applyLaunchClaims(s, "2026-10-28", [claim]);
    expect(r.added).toEqual(["Gemini 4 Carbon board-a", "Gemini 4 Carbon board-b"]);
    expect(r.untracked).toEqual(["Gemini 4 Carbon board-c"]);
    expect(s.models.find((m) => m.id === "gemini-4-carbon")).toMatchObject({ name: "Gemini 4 Carbon", labId: "google", releaseDate: "2026-10-28" });
    expect(s.observations.filter((o) => o.variantId === "gemini-4-carbon@high").map((o) => o.value)).toEqual([50, 70]);
    expect(s.observations.find((o) => o.variantId === "gemini-4@high")?.value).toBe(40);
  });
  it("steps aside on any board that lists the model, at any effort", () => {
    const s = snapshot();
    s.variants.push({ id: "gemini-4-carbon@medium", modelId: "gemini-4-carbon", effort: "medium" });
    s.observations.push({ benchmarkId: "board-b", variantId: "gemini-4-carbon@medium", value: 66, observedAt: "", sourceUrl: "" });
    const r = applyLaunchClaims(s, "2026-10-28", [claim]);
    expect(r.replaced).toEqual(["Gemini 4 Carbon board-b"]);
    expect(s.observations.filter((o) => o.benchmarkId === "board-b").map((o) => o.value)).toEqual([66]);
  });
  it("does not double a claim carried from the last snapshot", () => {
    const s = snapshot();
    applyLaunchClaims(s, "2026-10-28", [claim]);
    applyLaunchClaims(s, "2026-10-29", [claim]);
    expect(s.observations.filter((o) => o.variantId === "gemini-4-carbon@high")).toHaveLength(2);
  });
  it("every claim names a model Priors recognizes", () => {
    expect(() => applyLaunchClaims(snapshot(), "2026-10-28", LAUNCH_CLAIMS)).not.toThrow();
  });
});
