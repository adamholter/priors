import { describe, expect, it } from "vitest";
import { loadSnapshot } from "../data/load";
import { aaIndexMix } from "../onboarding/defaults";
import { runTool, type ToolContext } from "./tools";

const context = async () => {
  const snapshot = (await loadSnapshot())!;
  return { snapshot, original: aaIndexMix(snapshot), charts: [] } as unknown as ToolContext;
};

describe("search_benchmarks", () => {
  type Listed = { complete?: boolean; total: number; shown?: number; note?: string; benchmarks: { id: string; name: string }[]; error?: string };
  const search = async (args: Record<string, unknown>) => runTool(await context(), "search_benchmarks", args) as Promise<Listed>;
  it("lists every benchmark with a word in its name, past the 15 a search shows", async () => {
    const ctx = await context(), seen = new Set(ctx.snapshot.observations.map((o) => o.benchmarkId));
    const want = ctx.snapshot.benchmarks.filter((b) => seen.has(b.id) && /arena/i.test(`${b.name} ${b.shortName ?? ""} ${b.id}`)).map((b) => b.id).sort();
    expect(want.length).toBeGreaterThan(15);
    const got = await search({ name: "Arena" });
    expect(got.complete).toBe(true);
    expect(got.total).toBe(want.length);
    expect(got.benchmarks.map((b) => b.id).sort()).toEqual(want);
  });
  it("lists a whole category and refuses an unknown one", async () => {
    expect((await search({ category: "math" })).total).toBeGreaterThan(15);
    expect((await search({ category: "astrology" })).error).toMatch(/Unknown category/);
  });
  it("says when a search shows only part of its matches", async () => {
    const got = await search({ query: "coding" });
    expect(got.benchmarks).toHaveLength(15);
    expect(got.total).toBeGreaterThan(15);
    expect(got.note).toMatch(/complete list/);
  });
});

describe("propose", () => {
  it("refuses a mix that changes nothing, rather than reporting it as applied", async () => {
    const ctx = await context(), id = Object.keys(ctx.original.weights)[0];
    // What the assistant sent: added benchmarks at 0, which are left out, so the mix stays 100% AA.
    const result = await runTool(ctx, "propose", { pin: { [id]: 55 }, weights: { [id]: 100, "aa-terminalbench-v4-0": 0 }, summary: "Added coding", fresh: true }) as { error?: string };
    expect(result.error).toMatch(/same as the current one/);
    expect(ctx.proposal).toBeUndefined();
  });

  it("applies a real change to the same mix", async () => {
    const ctx = await context(), id = Object.keys(ctx.original.weights)[0];
    const result = await runTool(ctx, "propose", { weights: { [id]: 55, "aa-terminalbench-v4-0": 45 }, summary: "Added coding", fresh: true }) as { applied?: boolean };
    expect(result.applied).toBe(true);
    expect(Object.keys(ctx.proposal!.weights).length).toBe(2);
  });
});
