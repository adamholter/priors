import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ScrapeContext } from "../../src/data/types";
import source from "./sources/programbench";

const fixture = (name: string) => readFileSync(fileURLToPath(new URL("./fixtures/" + name, import.meta.url)));
const page = gunzipSync(fixture("programbench-page.html.gz")).toString("utf8");
const moduleText = gunzipSync(fixture("programbench-analysis-module.js.gz")).toString("utf8");
const analysis = gunzipSync(fixture("programbench-analysis.json.gz")).toString("utf8");
const viewModule = gunzipSync(fixture("programbench-view-module.js.gz")).toString("utf8");
const catalog = gunzipSync(fixture("programbench-model-catalog.js.gz")).toString("utf8");

function context() {
  const calls: string[] = [];
  const ctx: ScrapeContext = {
    now: "2026-09-23T00:00:00.000Z", log: () => undefined,
    fetchText: async (url) => {
      calls.push(url);
      if (url === source.url) return page;
      if (url.endsWith("ProgramBenchResultsAnalysis.zTs7IzHv.js")) return moduleText;
      if (url.endsWith("results_analysis.D_JihatQ.json")) return analysis;
      if (url.endsWith("BenchmarkView.D2TPBjlD.js")) return viewModule;
      if (url.endsWith("constants.gpz99pa7.js")) return catalog;
      throw new Error("unexpected fetch " + url);
    },
    fetchJson: async () => { throw new Error("fetchJson should not be used"); },
    withPage: async () => { throw new Error("withPage should not be used"); },
  };
  return { ctx, calls };
}

describe("VALS AI ProgramBench source", () => {
  it("keeps all models, published metric semantics, provenance, and task-level scores", async () => {
    const { ctx, calls } = context();
    const result = await source.scrape(ctx);
    expect(calls).toHaveLength(5);
    expect(result.benchmarks.map((b) => b.id)).toEqual([
      "vals-programbench-v1", "vals-programbench-v1-almost-resolved", "vals-programbench-v1-raw-pass-rate",
    ]);
    expect(result.benchmarks[0].lastUpdated).toBe("2026-09-22");
    expect(result.benchmarks[0].defaultWeight).toBeGreaterThan(0);
    expect(result.benchmarks.slice(1).map((b) => b.defaultWeight)).toEqual([0, 0]);
    expect(result.rows).toHaveLength(153);
    expect(new Set(result.rows.map((row) => row.sourceModelId)).size).toBe(51);
    expect(result.rows.every((row) => typeof row.modelLabel === "string" && row.modelLabel.length > 0)).toBe(true);
    expect(Object.keys(result.raw)).toEqual([
      "page.html", "analysis-component.js", "task-analysis.json", "model-catalog-module.js",
    ]);
    expect(result.raw["page.html"]).toBe(page);
    expect(result.raw["task-analysis.json"]).toBe(analysis);
    expect(result.raw["model-catalog-module.js"]).toBe(catalog);

    const opus = result.rows.filter((row) => row.sourceModelId === "anthropic/claude-opus-5-5");
    expect(opus.map((row) => [row.benchmarkId, row.value])).toEqual([
      ["vals-programbench-v1", 18.5],
      ["vals-programbench-v1-almost-resolved", 65],
      ["vals-programbench-v1-raw-pass-rate", 86.986],
    ]);
    expect(opus[0].modelLabel).toBe("Claude Opus 5.5");
    expect(opus[0].sourceModelId).toBe("anthropic/claude-opus-5-5");
    const haiku = result.rows.find((row) => row.sourceModelId === "anthropic/claude-haiku-4-5-20251001-thinking");
    expect(haiku?.modelLabel).toBe("Claude Haiku 4.5 (Thinking)");
    expect(opus[0].details?.taskMetrics).toHaveProperty("overall");
    expect(opus[0].details?.taskMetrics).toHaveProperty("strict");
    expect((opus[0].details?.sourceScore as Record<string, unknown>).tie_breaker_score).toBe(65.009);
    expect((opus[0].details?.sourceScore as Record<string, unknown>).stderr).toBe(2.753);
    expect((opus[0].details?.taskAnalysis as Record<string, unknown>).totalTasks).toBe(200);
    expect(((opus[0].details?.taskAnalysis as Record<string, unknown>).taskScores as number[])).toHaveLength(200);
    const zero = result.rows.find((row) => row.benchmarkId === "vals-programbench-v1" && row.sourceModelId === "alibaba/qwen3.6-plus");
    expect(zero?.value).toBe(0);
  });

  it("rejects pages and task-analysis payloads that no longer align", async () => {
    const { ctx } = context();
    const broken = { ...ctx, fetchText: async (url: string) => url === source.url ? "<html>no table</html>" : ctx.fetchText(url) };
    await expect(source.scrape(broken)).rejects.toThrow(/embedded benchmark table payload not found/);
    const { ctx: bad } = context();
    const mismatched = { ...bad, fetchText: async (url: string) =>
      url.endsWith("results_analysis.D_JihatQ.json") ? "{\"models\":[],\"heatmap\":{\"taskOrder\":[],\"models\":[]}}" : bad.fetchText(url) };
    await expect(source.scrape(mismatched)).rejects.toThrow(/task-analysis counts do not match table/);
  });
});
