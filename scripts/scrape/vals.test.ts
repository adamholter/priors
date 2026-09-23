import { describe, expect, it } from "vitest";
import { astroIslandProps, createValsSource, parseValsBenchmarkView, parseValsModelCatalog } from "./sources/_vals";
import type { ScrapeContext } from "../../src/data/types";

const astroNode = (value: unknown): unknown => {
  if (Array.isArray(value)) return [1, value.map(astroNode)];
  if (value && typeof value === "object") {
    return [0, Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, astroNode(entry)]))];
  }
  return [0, value];
};

const pageFixture = () => {
  const metadata = {
    benchmark: "Fixture Bench",
    slug: "fixture_bench",
    updated: "2026-09-22",
    total_models: 2,
    models: ["openai/gpt-6-astra", "anthropic/claude-opus-5-5"],
  };
  const tasks = {
    overall: {
      "openai/gpt-6-astra": { accuracy: 80.5, stderr: 1.2, cost_per_test: 0.5, latency: 12 },
      "anthropic/claude-opus-5-5": { accuracy: 70, stderr: 2, provider: "Anthropic" },
    },
  };
  const payload = {
    benchmarkView: astroNode({ default: { metadata, tasks } }),
  };
  const encoded = JSON.stringify(payload).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const html = `<html><astro-island component-url="/_astro/BenchmarkView.test.js" props="${encoded}"></astro-island></html>`;
  return { html, metadata, tasks };
};

const componentFixture = 'import{r as m}from"./constants.test.js";';
const catalogFixture = 'const p={"openai/gpt-6-astra":{label:"GPT-6 Astra",company:"OpenAI",supports:{transcription:!1}},"anthropic/claude-opus-5-5":{label:"Claude Opus 5.5",company:"Anthropic",supports:{transcription:!1}}};';
const fixtureFetch = (html: string) => async (url: string) => {
  if (url.endsWith("BenchmarkView.test.js")) return componentFixture;
  if (url.endsWith("constants.test.js")) return catalogFixture;
  return html;
};

describe("Vals AI Astro benchmark payload", () => {
  it("decodes nested island props and checks the benchmark slug", () => {
    const { html, metadata, tasks } = pageFixture();
    expect(astroIslandProps(html, "BenchmarkView")).toHaveProperty("benchmarkView");
    const view = parseValsBenchmarkView(html, "fixture_bench");
    expect(view.metadata).toEqual(metadata);
    expect(view.tasks?.overall).toEqual(tasks.overall);
    expect(() => parseValsBenchmarkView(html, "different_bench")).toThrow(/payload belongs to fixture_bench/);
  });

  it("parses the public model catalog without evaluating its JavaScript", () => {
    expect(parseValsModelCatalog(catalogFixture)).toMatchObject({
      "openai/gpt-6-astra": { label: "GPT-6 Astra", company: "OpenAI", supports: { transcription: false } },
    });
    expect(() => parseValsModelCatalog("export default {};")).toThrow(/const p object missing/);
  });

  it("emits every overall score with source update and metric provenance", async () => {
    const { html } = pageFixture();
    const source = createValsSource({
      sourceId: "vals-fixture",
      slug: "fixture_bench",
      benchmarkId: "vals-fixture",
      name: "Fixture Bench",
      category: "agentic",
      description: "Fixture description.",
    });
    const context = { fetchText: fixtureFetch(html) } as ScrapeContext;
    const result = await source.scrape(context);
    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((row) => row.value)).toEqual([80.5, 70]);
    expect(result.rows.map((row) => row.modelLabel)).toEqual(["GPT-6 Astra", "Claude Opus 5.5"]);
    expect(result.rows[0]).toMatchObject({ sourceModelId: "openai/gpt-6-astra", costUsd: 0.5, durationSec: 12 });
    expect(result.rows[0]?.ci).toBeUndefined();
    expect(result.benchmarks[0]).toMatchObject({ id: "vals-fixture", lastUpdated: "2026-09-22" });
    expect(result.raw["overall.json"]).toContain("80.5");
  });

  it("keeps VALS speech-to-text systems as audio identities", async () => {
    const metadata = { benchmark: "Voice Code Bench", slug: "voice-code-bench", updated: "2026-09-18T00:00:00Z", total_models: 1, models: ["openai/gpt-4o-transcribe"] };
    const tasks = { overall: { "openai/gpt-4o-transcribe": { accuracy: 91.2, provider: "OpenAI" } } };
    const payload = { benchmarkView: astroNode({ default: { metadata, tasks } }) };
    const encoded = JSON.stringify(payload).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    const html = `<astro-island component-url="/_astro/BenchmarkView.voice.js" props="${encoded}"></astro-island>`;
    const fetchText = async (url: string) => {
      if (url.endsWith("BenchmarkView.voice.js")) return 'import{r as m}from"./constants.voice.js";';
      if (url.endsWith("constants.voice.js")) return 'const p={"openai/gpt-4o-transcribe":{label:"GPT-4o Transcribe",company:"OpenAI",slug:"openai_gpt-4o-transcribe",supports:{transcription:!0}}};';
      return html;
    };
    const source = createValsSource({ sourceId: "vals-voice-code-bench", slug: "voice-code-bench", benchmarkId: "vals-voice-code-bench", name: "VoiceCodeBench", category: "other", description: "Speech transcription fixture." });
    const result = await source.scrape({ fetchText } as ScrapeContext);
    expect(result.rows[0]).toMatchObject({
      modelLabel: "GPT-4o Transcribe",
      identity: { modelName: "GPT-4o Transcribe", sourceModelId: "openai/gpt-4o-transcribe" },
      modelMetadata: { kind: "audio", sourceModelUrl: "https://www.vals.ai/models/openai_gpt-4o-transcribe" },
      details: { modality: "speech-to-text" },
    });
    expect(result.benchmarks[0]).toMatchObject({ lastUpdated: "2026-09-18" });
    expect(result.modelMeta?.[0]).toMatchObject({ modelLabel: "GPT-4o Transcribe", kind: "audio" });
  });

  it("fails closed when the payload advertises more models than its overall table", async () => {
    const { html } = pageFixture();
    const broken = html.replace('&quot;total_models&quot;:[0,2]', '&quot;total_models&quot;:[0,3]');
    const source = createValsSource({
      sourceId: "vals-fixture",
      slug: "fixture_bench",
      benchmarkId: "vals-fixture",
      name: "Fixture Bench",
      category: "agentic",
      description: "Fixture description.",
    });
    const context = { fetchText: fixtureFetch(broken) } as ScrapeContext;
    await expect(source.scrape(context)).rejects.toThrow(/expected 3 overall rows, found 2/);
  });
});
