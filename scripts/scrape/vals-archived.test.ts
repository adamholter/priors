import { describe, expect, it } from "vitest";
import archivedSource, {
  ARCHIVED_BENCHMARK_SLUGS,
  parseArchivedPage,
  parseBenchmarkCatalogue,
} from "./sources/vals-archived";

function astroEncode(value: unknown): unknown {
  if (Array.isArray(value)) return [1, value.map(astroEncode)];
  if (value && typeof value === "object") {
    return [0, Object.fromEntries(Object.entries(value).map(([key, item]) => [key, astroEncode(item)]))];
  }
  return [0, value];
}

function benchmarkPageHtml(updated = "2026-06-09") {
  const view = {
    metadata: {
      benchmark: "Example",
      slug: "example",
      benchmark_id: "example",
      description: "A sample benchmark.",
      version: "2",
      updated,
      industry: "math",
      tasks: { overall: "Overall", easy: "Easy" },
      models: ["openai/gpt-5.2"],
    },
    tasks: {
      overall: {
        "openai/gpt-5.2": {
          accuracy: 70.5,
          stderr: 0.8,
          cost_per_test: 0.03,
          latency: 12,
          reasoning_effort: "xhigh",
          provider: "OpenAI",
        },
      },
      easy: { "openai/gpt-5.2": { accuracy: 82 } },
    },
  };
  const props = JSON.stringify({ benchmarkView: astroEncode({ default: view }) })
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;");
  return `<html><head><title>Example</title></head><body><astro-island component-url="/_astro/BenchmarkView.test.js" props="${props}"></astro-island></body></html>`;
}

describe("VALS archived benchmark parsing", () => {
  it("keeps source identity, publication date, effort, economics, and task splits", () => {
    const parsed = parseArchivedPage(benchmarkPageHtml(), "example", { "openai/gpt-5.2": "GPT-5.2" });

    expect(parsed.benchmark).toMatchObject({
      id: "vals-example",
      name: "Example (Vals AI)",
      sourceId: "vals-archived",
      lastUpdated: "2026-06-09",
      defaultWeight: 0,
      eligibleForDefault: false,
      advanced: [{ id: "easy", name: "Easy" }],
    });
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      benchmarkId: "vals-example",
      modelLabel: "GPT-5.2",
      sourceModelId: "openai/gpt-5.2",
      effort: "xhigh",
      value: 70.5,
      costUsd: 0.03,
      durationSec: 12,
      labHint: "OpenAI",
      details: { easy: 82 },
    });
  });

  it("normalizes timestamp update metadata to YYYY-MM-DD", () => {
    const parsed = parseArchivedPage(
      benchmarkPageHtml("2026-06-09T17:30:00Z"),
      "example",
      { "openai/gpt-5.2": "GPT-5.2" },
    );
    expect(parsed.benchmark.lastUpdated).toBe("2026-06-09");
  });

  it("fails closed when the benchmark payload is missing or has no usable scores", () => {
    expect(() => parseArchivedPage("<html></html>", "example")).toThrow(/BenchmarkView island missing/);
    const html = benchmarkPageHtml().replace('&quot;accuracy&quot;:[0,70.5]', '&quot;accuracy&quot;:[0,null]');
    expect(() => parseArchivedPage(html, "example")).toThrow(/has a missing score/);
  });

  it("uses the exact source model key when a retired label is absent from the catalog", () => {
    const parsed = parseArchivedPage(benchmarkPageHtml(), "example");
    expect(parsed.rows[0]?.modelLabel).toBe("openai/gpt-5.2");
    expect(parsed.modelLabelFallbacks).toEqual(["openai/gpt-5.2"]);
  });

  it("fails closed when an archived route is missing from the live catalogue", async () => {
    const catalogue = ARCHIVED_BENCHMARK_SLUGS.slice(0, -1)
      .map((slug) => '<a href="/benchmarks/' + slug + '">View Details</a>')
      .join("");
    let fetchCount = 0;
    await expect(archivedSource.scrape({
      fetchText: async () => { fetchCount++; return catalogue; },
    } as never)).rejects.toThrow(/missing required routes/);
    expect(fetchCount).toBe(1);
  });

  it("checks that every configured archive route appears in the catalogue", () => {
    const catalogue = ARCHIVED_BENCHMARK_SLUGS.map(
      (slug) => `<a href="/benchmarks/${slug}">View Details</a>`,
    ).join("");
    const found = parseBenchmarkCatalogue(catalogue);
    expect(found.size).toBe(17);
    expect(ARCHIVED_BENCHMARK_SLUGS.filter((slug) => !found.has(slug))).toEqual([]);
  });
});