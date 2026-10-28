import { describe, expect, it } from "vitest";
import { loadSnapshot } from "../data/load";
import { defaultConfig } from "../engine";
import { DataView } from "./data";
import { makeChart, queryData } from "./charts";
import { resolveBenchmark, resolveLab, resolveVariant } from "./resolve";
import { runTool, type ToolContext } from "./tools";
import { toShares } from "./solver";
import { chartLink, decodeSpec, encodeSpec, formatMetric } from "../lib/answer-chart";

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

  it("only accepts real effort names, since they become chart labels", () => {
    const r = makeChart(view, { type: "effort_compare", metric: "index", efforts: ["xhigh", "<img src=x onerror=alert(1)>", "max"] });
    expect(r.chart?.kind === "grouped" && r.chart.series).toEqual(["xhigh", "max"]);
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
    expect(Object.keys(alone.proposal?.weights ?? {}).length).toBe(new Set([...Object.keys(config.weights), "deepswe-1.1"]).size);
  });

  it("records highlights and theme changes for the client to apply", async () => {
    const c = ctx();
    await runTool(c, "highlight", { models: ["Opus 5.5 max", "Sonnet 5.5"], mode: "set" });
    expect(c.highlight).toEqual(["claude-opus-5.5@max", "claude-sonnet-5.5"]);
    expect(await runTool(c, "set_theme", { theme: "Midnight", mode: "light" })).toMatchObject({ note: expect.stringContaining("only comes in dark") });
    expect(c.theme).toEqual({ id: "midnight", mode: "light" });
  });

  it("draws exactly the model and effort pairs asked for, in any mix of efforts", () => {
    const r = makeChart(view, { type: "bar", metric: "index", variants: ["GPT-5.6 Sol max", "Opus 5.5 low"] });
    expect(r.chart?.kind === "bar" && r.chart.items.map((i) => i.label).sort()).toEqual(["GPT-5.6 Sol max", "Opus 5.5 low"]);
    const missing = makeChart(view, { type: "bar", metric: "index", variants: ["Opus 5.5 low", "Nonexistent Model 9 max"] });
    expect(missing.chart?.kind === "bar" && missing.chart.items.length).toBe(1);
    const sc = makeChart(view, { type: "scatter", metric: "index", x_metric: "cost", variants: ["Opus 5.5 max", "Opus 5.5 low", "GPT-5.6 Sol max"] });
    expect(sc.chart?.kind === "scatter" && sc.chart.points.length).toBe(3);
  });

  it("carries a chart's recipe in a link that redraws the same chart", async () => {
    const c = ctx();
    await runTool(c, "make_chart", { type: "bar", metric: "index", variants: ["GPT-5.6 Sol max", "Opus 5.5 low"], title: "Sol max vs Opus low", injected: "x" });
    const spec = c.charts[0].spec!;
    expect(spec).toEqual({ type: "bar", metric: "index", variants: ["GPT-5.6 Sol max", "Opus 5.5 low"], title: "Sol max vs Opus low" });
    expect(decodeSpec(encodeSpec(spec))).toEqual(spec);
    expect(chartLink("https://x.test", { spec, index: "a|b:1" })).toMatch(/^https:\/\/x\.test\/\?i=a%7Cb:1&chart=[\w-]+$/);
    expect(JSON.stringify(makeChart(view, spec as never).chart)).toBe(JSON.stringify({ ...c.charts[0], spec: undefined }));
  });

  it("filters to open or closed weights", () => {
    if (!snapshot.models.some((m) => m.openWeights !== undefined)) return; // a snapshot from before the flag existed
    const flag = new Map(snapshot.models.map((m) => [m.id, m.openWeights]));
    for (const w of ["open", "closed"] as const) {
      const r = makeChart(view, { type: "bar", metric: "index", weights: w, top: 8 });
      const items = r.chart?.kind === "bar" ? r.chart.items : [];
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((i) => flag.get(i.modelId) === (w === "open"))).toBe(true);
    }
    const t = queryData(view, { metrics: ["index"], weights: "open", top: 5 }) as { rows: { weights: string }[] };
    expect(t.rows.every((x) => x.weights === "open")).toBe(true);
  });

  it("formats values without stray zeros", () => {
    expect(formatMetric({ unit: "pts" }, 0.5)).toBe("0.5");
    expect(formatMetric({ unit: "$" }, 0.0845)).toBe("$0.08");
    expect(formatMetric({ unit: "pts" }, -0.09)).toBe("−0.09");
  });
});
