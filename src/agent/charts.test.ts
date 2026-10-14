import { describe, expect, it } from "vitest";
import { loadSnapshot } from "../data/load";
import { defaultConfig } from "../engine";
import { DataView } from "./data";
import { makeChart, queryData } from "./charts";
import { resolveBenchmark, resolveLab, resolveVariant } from "./resolve";
import { runTool, type ToolContext } from "./tools";
import { toShares } from "./solver";
import { formatMetric } from "../lib/answer-chart";

describe("assistant data tools on the real snapshot", async () => {
  const snapshot = (await loadSnapshot())!, config = defaultConfig(snapshot), view = new DataView(snapshot, config);
  const ctx = (): ToolContext => ({ snapshot, original: config, charts: [] });

  it("charts every value from the data, never from the model", () => {
    const r = makeChart(view, { type: "effort_delta", metric: "index" });
    expect(r.chart?.kind).toBe("bar");
    for (const item of r.chart!.kind === "bar" ? r.chart!.items : []) {
      const rows = view.pick([item.modelId], undefined, ["xhigh", "max"]).rows;
      const at = (e: string) => view.value({ key: "index", name: "", unit: "", better: "higher" }, rows.find((x) => x.variant.effort === e)!)!;
      expect(item.value).toBeCloseTo(at("max") - at("xhigh"), 6);
    }
  });

  it("treats the empty optional fields some models send as unset", () => {
    const a = makeChart(view, { type: "bar", metric: "index", top: 0, models: [], labs: [], efforts: ["best"], x_metric: "" } as never);
    expect(a.chart?.kind === "bar" && a.chart.items.length).toBe(12);
    expect((queryData(view, { metrics: ["speed"], efforts: ["best"], top: 10 }) as { rows: unknown[] }).rows.length).toBe(10);
  });

  it("filters by lab, including product names", () => {
    expect(resolveLab(snapshot, "Claude")).toBe("anthropic");
    const r = makeChart(view, { type: "bar", metric: "index", labs: ["OpenAI"] });
    expect(r.chart?.kind === "bar" && r.chart.items.every((i) => i.labId === "openai")).toBe(true);
  });

  it("resolves partial names to the user's mix and best-ranked model", () => {
    expect(resolveBenchmark(snapshot, "DeepSWE", config.weights)).toBe("deepswe-1.1");
    expect(resolveVariant(snapshot, "Opus 5.5 extra high", view.bestRank)).toEqual({ modelId: "claude-opus-5.5", variantId: "claude-opus-5.5@xhigh" });
  });

  it("pins an exact share and scales the rest into what's left", async () => {
    const c = ctx();
    await runTool(c, "propose", { weights: config.weights, pin: { "DeepSWE v1.1": 30 }, summary: "x" });
    expect(toShares(c.proposal!.weights)["deepswe-1.1"]).toBeCloseTo(0.3, 3);
    const alone = ctx();
    await runTool(alone, "propose", { weights: {}, pin: { "deepswe-1.1": 30 }, summary: "x" });
    expect(Object.keys(alone.proposal?.weights ?? {}).length).toBe(Object.keys(config.weights).length);
  });

  it("records highlights and theme changes for the client to apply", async () => {
    const c = ctx();
    await runTool(c, "highlight", { models: ["Opus 5.5 max", "Sonnet 5.5"], mode: "set" });
    expect(c.highlight).toEqual(["claude-opus-5.5@max", "claude-sonnet-5.5"]);
    expect(await runTool(c, "set_theme", { theme: "Midnight", mode: "light" })).toMatchObject({ note: expect.stringContaining("only comes in dark") });
    expect(c.theme).toEqual({ id: "midnight", mode: "light" });
  });

  it("formats values without stray zeros", () => {
    expect(formatMetric({ unit: "pts" }, 0.5)).toBe("0.5");
    expect(formatMetric({ unit: "$" }, 0.0845)).toBe("$0.08");
    expect(formatMetric({ unit: "pts" }, -0.09)).toBe("−0.09");
  });
});
