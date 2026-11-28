import { describe, expect, it } from "vitest";
import { loadSnapshot } from "@/data/load";
import { modelDirectory } from "./model-directory";
import { sortModels } from "./model-list";

describe("model directory", () => {
  it("on today's snapshot: ranked models in index order with no gaps, counts, cost per task and efforts for known models", async () => {
    const snapshot = (await loadSnapshot())!;
    const { items, indexName } = modelDirectory(snapshot);
    expect(indexName).toBeTruthy();
    expect(items.length).toBeGreaterThan(100);
    const ranked = sortModels(items, "rank", "asc").filter((x) => x.rank != null);
    expect(ranked.map((x) => x.rank)).toEqual(ranked.map((_, i) => i + 1));
    expect(ranked.slice(0, 20).every((x, i) => i === 0 || x.score! <= ranked[i - 1].score!)).toBe(true);
    const opus = items.find((x) => x.id === "claude-opus-5.5")!;
    expect(opus).toMatchObject({ labName: "Anthropic" });
    expect(opus.benchmarks).toBeGreaterThan(20);
    expect(opus.costUsd).toBeGreaterThan(0);
    expect(opus.efforts!.length).toBeGreaterThan(1);
    expect(opus.efforts!.every((e, i) => i === 0 || e.score >= opus.efforts![i - 1].score)).toBe(true);
    expect(items.some((x) => "priceUsd" in x)).toBe(false);
    expect(items.some((x) => x.superseded)).toBe(true);
    expect(items.every((x) => snapshot.models.find((m) => m.id === x.id)?.kind === "llm")).toBe(true);
  });
  it("gives every unranked model that is not an older version a reason, and no ranked model one", async () => {
    const { items } = modelDirectory((await loadSnapshot())!);
    for (const x of items) {
      if (x.rank != null || x.superseded) expect(x.why, x.id).toBeUndefined();
      else expect(x.why, x.id).toBeDefined();
    }
  });
  it("keeps models whose variant id carries a board suffix, names labs properly, and lists one row per model", async () => {
    const { items } = modelDirectory((await loadSnapshot())!);
    expect(items.some((x) => x.id.startsWith("aa-ling-3-2-air") || x.id.startsWith("aa-k2-horizon"))).toBe(true);
    expect(items.filter((x) => x.labName === x.labId), "labs named by their id").toEqual([]);
    expect(items.filter((x) => /nemotron/i.test(x.name)).every((x) => x.labId === "nvidia")).toBe(true);
    const keys = items.map((x) => `${x.labId}|${x.name.toLowerCase().replace(/[^a-z0-9.]+/g, " ").trim()}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
