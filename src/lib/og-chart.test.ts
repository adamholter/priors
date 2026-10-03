import { describe, expect, it } from "vitest";
import type { Lab, Snapshot } from "../data/types";
import type { IndexConfig, RankedVariant } from "../engine";
import { LIGHT_PALETTE } from "../components/chart/theme";
import { costChart } from "./metrics";
import { renderChartPng, scatterSpec } from "./og-chart";

const labs: Lab[] = [
  { id: "anthropic", name: "Anthropic", color: "#C76B55" },
  { id: "openai", name: "OpenAI", color: "#547B65" },
];

function ranked(modelId: string, name: string, labId: string, effort: string, score: number, costUsd: number): RankedVariant {
  return {
    model: { id: modelId, name, labId },
    variant: { id: `${modelId}@${effort}`, effort },
    score,
    costUsd,
  } as unknown as RankedVariant;
}

const points = [
  ranked("alpha", "Alpha", "anthropic", "high", 91, 0.12),
  ranked("alpha", "Alpha", "anthropic", "low", 86, 0.08),
  ranked("beta", "Beta", "openai", "high", 83, 0.16),
  ranked("beta", "Beta", "openai", "low", 78, 0.1),
];

const index = (highlight: string[]): IndexConfig => ({
  id: "test", name: "Test", weights: {}, required: [], cutoff: 5,
  estimateMissing: true, variants: "all", paretoVariants: "all", highlight,
});

describe("share-card chart highlights", () => {
  it("carries model and exact-effort ids from the index into the preview spec", () => {
    const spec = scatterSpec({} as Snapshot, points, index(["alpha", "beta@low"]), "cost");

    expect(spec?.highlight).toEqual(["alpha", "beta@low"]);
    expect(spec?.pts.map((point) => point.r.variant.id)).toEqual(points.map((point) => point.variant.id));
  });

  it("renders model and exact-effort emphasis in scatter and bars previews", async () => {
    const spec = { title: "Score vs cost per task", chart: costChart, hasTitle: true, pts: points.map((r) => ({ x: r.costUsd!, r })) };
    const render = (highlight: string[] | undefined, kind: "scatter" | "bars") => renderChartPng({ ...spec, highlight }, labs, LIGHT_PALETTE, kind);

    for (const kind of ["scatter", "bars"] as const) {
      const plain = await render(undefined, kind);
      const model = await render(["beta"], kind);
      const effort = await render(["beta@low"], kind);

      expect(plain?.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(model && plain && Buffer.compare(model, plain)).not.toBe(0);
      expect(effort && model && Buffer.compare(effort, model)).not.toBe(0);
    }
  }, 30_000);
});
