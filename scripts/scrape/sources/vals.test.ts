import { describe, expect, it } from "vitest";
import type { ScrapeContext } from "../../../src/data/types";
import source, { parseValsBenchmarkPage } from "./vals";

const slugs = [
  "legal_research",
  "hlab",
  "legal_bench",
  "fabv2",
  "emb",
  "tax_agent_bench",
  "medcode",
  "medscribe",
  "proof_bench",
  "terminal-bench-science",
  "biomysterybench",
  "mysterymechanism",
] as const;

const industries: Record<(typeof slugs)[number], string> = {
  legal_research: "legal",
  hlab: "legal",
  legal_bench: "legal",
  fabv2: "finance",
  emb: "finance",
  tax_agent_bench: "finance",
  medcode: "healthcare",
  medscribe: "healthcare",
  proof_bench: "math",
  "terminal-bench-science": "science",
  biomysterybench: "science",
  mysterymechanism: "science",
};

const astroNode = (value: unknown): unknown => {
  if (Array.isArray(value)) return [1, value.map(astroNode)];
  if (value && typeof value === "object") {
    return [0, Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, astroNode(entry)]))];
  }
  return [0, value];
};

function pageHtml(slug: string, updates: Record<string, unknown> = {}): string {
  const metadata = {
    benchmark: "Fixture " + slug,
    slug,
    description: "Fixture description.",
    benchmark_id: "fixture-" + slug,
    industry: industries[slug as (typeof slugs)[number]],
    updated: "2026-09-22T08:30:00.000Z",
    version: 1.1,
    total_models: 2,
    models: ["openai/gpt-6-astra", "meta/muse_spark"],
    visible: true,
    archived: false,
    ...updates,
  };
  const tasks = {
    overall: {
      "openai/gpt-6-astra": { accuracy: 80.5, stderr: 1.2, cost_per_test: 0.5, latency: 12 },
      "meta/muse_spark": { accuracy: 70, stderr: 2, provider: "Meta" },
    },
    criteria: {
      "openai/gpt-6-astra": { accuracy: 82 },
      "meta/muse_spark": { accuracy: 68 },
    },
  };
  const payload = { benchmarkView: astroNode({ default: { metadata, tasks } }) };
  const encoded = JSON.stringify(payload).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return '<html><astro-island data-trap="a > b" component-url="/_astro/BenchmarkView.fixture.js" props="' + encoded + '"></astro-island></html>';
}

const modelBundle = 'const models={"openai/gpt-6-astra":{company:"OpenAI",country:"US",label:"GPT-6 Astra"},"meta/muse_spark":{company:"Meta",country:"US",label:"Muse Spark"}};';
const moduleText = 'import { models } from "./constants.fixture.js";';

function makeContext(options: { missingSlug?: string; onPageFetch?: (delta: number) => void } = {}): ScrapeContext {
  return {
    now: "2026-09-23T00:00:00.000Z",
    log: () => undefined,
    fetchText: async (url: string) => {
      const match = url.match(/\/benchmarks\/([^/]+)$/);
      if (match) {
        options.onPageFetch?.(1);
        try {
          await new Promise((resolve) => setTimeout(resolve, 0));
          if (match[1] === options.missingSlug) throw new Error("404 " + url);
          return pageHtml(match[1]);
        } finally {
          options.onPageFetch?.(-1);
        }
      }
      if (url.endsWith("/_astro/BenchmarkView.fixture.js")) return moduleText;
      if (url.endsWith("/_astro/constants.fixture.js")) return modelBundle;
      throw new Error("Unexpected VALS URL " + url);
    },
    fetchJson: async () => {
      throw new Error("fetchJson is not used by this source");
    },
    withPage: async () => {
      throw new Error("withPage is not used by this source");
    },
  };
}

describe("VALS benchmark source", () => {
  it("parses quote-safe Astro props, numeric versions, and required update dates", () => {
    const page = parseValsBenchmarkPage(pageHtml("legal_research"), "legal_research");
    expect(page.metadata.version).toBe(1.1);
    expect(page.metadata.updated).toBe("2026-09-22T08:30:00.000Z");
    expect(Object.keys(page.tasks)).toEqual(["overall", "criteria"]);
    expect(Object.keys(page.scores)).toHaveLength(2);
    expect(() => parseValsBenchmarkPage(pageHtml("legal_research", { updated: "not-a-date" }), "legal_research"))
      .toThrow(/updated date/);
  });

  it("emits every benchmark row and archives all published task maps", async () => {
    const result = await source.scrape(makeContext());
    expect(result.benchmarks).toHaveLength(12);
    expect(result.rows).toHaveLength(24);
    expect(slugs.every((slug) => result.raw[slug + ".json"] !== undefined)).toBe(true);
    expect(result.benchmarks.map((benchmark) => (benchmark as typeof benchmark & { lastUpdated?: string }).lastUpdated))
      .toEqual(Array(12).fill("2026-09-22"));
    const legalRaw = JSON.parse(result.raw["legal_research.json"] ?? "{}");
    expect(legalRaw.tasks).toHaveProperty("criteria");
    expect(legalRaw.tasks.criteria["openai/gpt-6-astra"].accuracy).toBe(82);
    const catalog = JSON.parse(result.raw["model-catalog.json"] ?? "{}");
    expect(catalog.models["meta/muse_spark"]).toMatchObject({ company: "Meta", country: "US", label: "Muse Spark" });
    expect(result.rows[0]).toMatchObject({
      benchmarkId: "vals-legal-research",
      modelLabel: "GPT-6 Astra",
      sourceModelId: "openai/gpt-6-astra",
      value: 80.5,
      costUsd: 0.5,
      durationSec: 12,
    });
    expect(result.rows[0]?.ci).toBeUndefined();
  });

  it("limits page fetches to four at a time", async () => {
    let active = 0;
    let maximum = 0;
    await source.scrape(makeContext({
      onPageFetch: (delta) => {
        active += delta;
        maximum = Math.max(maximum, active);
      },
    }));
    expect(maximum).toBe(4);
  });

  it("fails the complete VALS source when an expected page disappears", async () => {
    await expect(source.scrape(makeContext({ missingSlug: "legal_bench" }))).rejects.toThrow(/404/);
  });

  it("fails when the advertised model count no longer matches overall scores", () => {
    expect(() => parseValsBenchmarkPage(pageHtml("legal_research", { total_models: 3 }), "legal_research"))
      .toThrow(/model count mismatch|overall scores do not cover/);
  });
});
