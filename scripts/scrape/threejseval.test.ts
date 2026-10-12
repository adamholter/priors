import { describe, expect, it } from "vitest";
import source from "./sources/threejseval";
import { normalizeLabel } from "../../src/data/normalize";

const payload = {
  computedAt: "2026-10-12T11:37:56.062Z", allVotes: 24348,
  models: [
    { rank: 1, modelId: "claude-opus-5-5-high", label: "Opus 5.5 High", rating: 2074.35, costUsd: 2.666, totalTokens: 1261569, battles: 1041, released: "2026-09-22" },
    { rank: 2, modelId: "gpt-6-astra", label: "GPT-6 Astra Medium", rating: 1886.2, costUsd: 0.767, totalTokens: 58693, battles: 1247, released: "2026-09-03" },
    { rank: 3, modelId: "ox-alpha", label: "Ox Alpha", rating: 1390.1, costUsd: 0.008, totalTokens: 421000, battles: 1310, released: "2026-08-26" },
    { rank: 4, modelId: "unrated", label: "Unrated", rating: null, battles: 0 },
  ],
  prompts: [{ evalId: "eiffel-tower", countsTowardOverall: true }, { evalId: "new", countsTowardOverall: false }],
};
const ctx = (data: unknown) => ({ fetchJson: async () => data }) as unknown as Parameters<typeof source.scrape>[0];

describe("threejseval", () => {
  it("publishes the Elo rating per model, with the estimated cost kept out of measured cost", async () => {
    const r = await source.scrape(ctx(payload));
    expect(r.rows.map((x) => [x.modelLabel, x.value, x.rank])).toEqual([["Opus 5.5 High", 2074.35, 1], ["GPT-6 Astra Medium", 1886.2, 2], ["Ox Alpha", 1390.1, 3]]);
    expect(r.rows.every((x) => x.costUsd === undefined)).toBe(true);
    expect(r.rows[0].details).toMatchObject({ battles: 1041, averageCostUsd: 2.666, costEstimated: true, tokensPerEval: 1261569 });
    expect(r.benchmarks[0]).toMatchObject({ id: "threejseval", unit: "elo", higherIsBetter: true, category: "creative", defaultWeight: 0, eligibleForDefault: false, lastUpdated: "2026-10-12" });
    expect(r.notes?.[0]).toContain("1 prompts count");
  });
  it("uses labels the normalizer reads as model plus effort", () => {
    expect(normalizeLabel("Opus 5.5 High")).toMatchObject({ ok: true, modelId: "claude-opus-5.5", effort: "high" });
    expect(normalizeLabel("Grok 4.7 Extra High")).toMatchObject({ ok: true, modelId: "grok-4.7", effort: "xhigh" });
  });
  it("rejects an empty ranking", async () => {
    await expect(source.scrape(ctx({ models: [] }))).rejects.toThrow();
  });
});
