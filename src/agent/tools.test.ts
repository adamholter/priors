import { describe, expect, it } from "vitest";
import { loadSnapshot } from "../data/load";
import { aaIndexMix } from "../onboarding/defaults";
import { runTool, type ToolContext } from "./tools";

const context = async () => {
  const snapshot = (await loadSnapshot())!;
  return { snapshot, original: aaIndexMix(snapshot), charts: [] } as unknown as ToolContext;
};

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
