import { describe, expect, it } from "vitest";
import type { ScrapeContext } from "../../src/data/types";
import { normalizeLabel } from "../../src/data/normalize";
import { createValsSource, parseValsBenchmarkView, parseValsModelCatalogEntry } from "./sources/_vals";
import valsCodeMigration from "./sources/vals-code-migration";
import valsIoi from "./sources/vals-ioi";
import valsSkillsbench from "./sources/vals-skillsbench";
import valsTerminalbench4 from "./sources/vals-terminalbench4";
import valsVibeCode from "./sources/vals-vibe-code";
import valsVcbOneHundred from "./sources/vals-vcb-1-100";

const modelIds = ["anthropic/claude-fable-5", "openai/gpt-6-astra"] as const;

function scalar(value: unknown): unknown[] {
  return [0, value];
}

function wrappedRecord(record: Record<string, unknown>): unknown[] {
  return [0, Object.fromEntries(Object.entries(record).map(([key, value]) => [key, scalar(value)]))];
}

function fixtureHtml(options: { slug?: string; total?: number; rows?: number } = {}): string {
  const rowCount = options.rows ?? 2;
  const ids = modelIds.slice(0, rowCount);
  const score: Record<string, unknown> = {};
  ids.forEach((id, index) => {
    score[id] = wrappedRecord({
      accuracy: index === 0 ? 92.125 : 88.5,
      stderr: index === 0 ? 1.25 : null,
      latency: index === 0 ? 3600 : null,
      cost_per_test: index === 0 ? 12.5 : null,
      reasoning_effort: index === 0 ? "high" : null,
      compute_effort: null,
      provider: index === 0 ? "Anthropic" : "OpenAI",
      harness: index === 0 ? "OpenHands" : "Codex",
    });
  });

  const metadata = {
    benchmark: scalar("Vibe Code Bench v1.1"),
    slug: scalar(options.slug ?? "vibe-code"),
    description: scalar("Can models build web applications from scratch?"),
    updated: scalar("2026-09-22"),
    total_models: scalar(options.total ?? ids.length),
    models: [1, ids.map(scalar)],
  };
  const props = {
    benchmarkView: scalar({
      default: scalar({
        metadata: scalar(metadata),
        tasks: scalar({ overall: scalar(score) }),
      }),
    }),
  };
  const serialized = JSON.stringify(props)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<html><astro-island component-url="/_astro/BenchmarkView.fixture.js" props="${serialized}"></astro-island></html>`;
}

const componentJs = 'import{p as C}from"./constants.fixture-hash.js";';
const modelCatalog = `const p={"anthropic/claude-fable-5":{company:"Anthropic",country:"United States",label:"Claude Fable 5",release_date:"2026-06-09",properties:{reasoning_model:!0}},"openai/gpt-6-astra":{company:"OpenAI",country:"United States",label:"GPT-6 Astra",release_date:"2026-09-03",properties:{reasoning_model:!0}}};export{p as C};`;

function fakeContext(html = fixtureHtml()): ScrapeContext {
  const responses = new Map<string, string>([
    ["https://www.vals.ai/benchmarks/vibe-code", html],
    ["https://www.vals.ai/_astro/BenchmarkView.fixture.js", componentJs],
    ["https://www.vals.ai/_astro/constants.fixture-hash.js", modelCatalog],
  ]);
  return {
    fetchText: async (url) => {
      const response = responses.get(url);
      if (response == null) throw new Error(`unexpected fetch: ${url}`);
      return response;
    },
    fetchJson: async () => { throw new Error("JSON fetch is not used"); },
    withPage: async () => { throw new Error("browser rendering is not used"); },
    now: "2026-09-23T12:00:00.000Z",
    log: () => undefined,
  };
}

const source = createValsSource({
  sourceId: "vals-vibe-code-test",
  slug: "vibe-code",
  benchmarkId: "vals-vibe-code-v1-1",
  name: "Vibe Code Bench v1.1",
  shortName: "Vibe Code",
  category: "coding",
  description: "Can models build web applications from scratch?",
});

describe("Vals benchmark source modules", () => {
  it("registers each requested VALS benchmark under its own source identity", () => {
    const sources = [valsVibeCode, valsVcbOneHundred, valsCodeMigration, valsSkillsbench, valsIoi, valsTerminalbench4];
    expect(new Set(sources.map((item) => item.id)).size).toBe(6);
    expect(sources.map((item) => item.id)).toContain("vals-terminalbench4");
    expect(valsTerminalbench4.url).toBe("https://www.vals.ai/benchmarks/terminal-bench-4");
  });

  it("decodes the SSR score table with exact display labels and measured fields", async () => {
    const result = await source.scrape(fakeContext());
    const first = result.rows[0];

    expect(result.rows).toHaveLength(2);
    expect(first).toMatchObject({
      benchmarkId: "vals-vibe-code-v1-1",
      modelLabel: "Claude Fable 5",
      sourceModelId: "anthropic/claude-fable-5",
      value: 92.125,
      effort: "high",
      costUsd: 12.5,
      durationSec: 3600,
      harness: "OpenHands",
      labHint: "Anthropic",
    });
    expect(first.ci).toBeUndefined();
    expect(first.details?.stderr).toBe(1.25);
    expect(first.note).toContain("standard error");
    expect(result.rows[1].modelLabel).toBe("GPT-6 Astra");
    expect(result.rows[1].sourceModelId).toBe("openai/gpt-6-astra");
    expect(result.benchmarks[0]).toMatchObject({
      id: "vals-vibe-code-v1-1",
      lastUpdated: "2026-09-22",
      defaultWeight: 0,
      eligibleForDefault: false,
    });
    expect(Object.keys(JSON.parse(result.raw["overall.json"]))).toHaveLength(2);
    expect(JSON.parse(result.raw["model-catalog-keys.json"])["openai/gpt-6-astra"].label).toBe("GPT-6 Astra");
    const fable = normalizeLabel(first.modelLabel);
    const astra = normalizeLabel(result.rows[1].modelLabel);
    expect(fable.ok && fable.modelId).toBe("claude-fable-5");
    expect(astra.ok && astra.modelId).toBe("gpt-6-astra");
  });

  it("rejects a page when its declared system count exceeds its complete score map", async () => {
    await expect(source.scrape(fakeContext(fixtureHtml({ total: 3 }))))
      .rejects.toThrow(/expected 3 overall rows, found 2/);
  });

  it("rejects payload identity drift rather than consuming another benchmark's rows", () => {
    expect(() => parseValsBenchmarkView(fixtureHtml({ slug: "code-migration" }), "vibe-code"))
      .toThrow(/payload belongs to code-migration/);
  });

  it("does not invent a display label when a source model is absent from the catalog", () => {
    const entry = parseValsModelCatalogEntry('const p={"provider/model-x":{company:"Provider",country:"X"}};', "provider/model-x");
    expect(entry?.label).toBeUndefined();
  });

  it("finds the model catalog whatever the bundler named it", () => {
    for (const name of ["p", "_", "$a1"]) {
      const entry = parseValsModelCatalogEntry(`const ${name}={"provider/model-x":{company:"Provider",label:"Model X",open_source:!1}};export{${name} as C};`, "provider/model-x");
      expect(entry?.label).toBe("Model X");
    }
  });
});
