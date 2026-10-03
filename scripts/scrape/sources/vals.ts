import type { Benchmark, Effort, RawRow, ScrapeResult, Source } from "../../../src/data/types";
import { loadValsView, valsConstantsUrl } from "./_vals";

const ORIGIN = "https://www.vals.ai";

interface PageDefinition {
  slug: string;
  id: string;
  name: string;
  shortName: string;
  category: Benchmark["category"];
  industry: string;
}

const PAGES: readonly PageDefinition[] = [
  { slug: "legal_research", id: "vals-legal-research", name: "Legal Research Bench", shortName: "Legal Research", category: "agentic", industry: "legal" },
  { slug: "hlab", id: "vals-harvey-legal-agent", name: "Harvey's Legal Agent Benchmark", shortName: "Harvey Legal", category: "agentic", industry: "legal" },
  { slug: "legal_bench", id: "vals-legalbench", name: "LegalBench", shortName: "LegalBench", category: "reasoning", industry: "legal" },
  { slug: "fabv2", id: "vals-finance-agent-v2", name: "Finance Agent v2", shortName: "Finance Agent", category: "economics", industry: "finance" },
  { slug: "emb", id: "vals-excel-modeling", name: "Excel Modeling Benchmark", shortName: "Excel Modeling", category: "economics", industry: "finance" },
  { slug: "tax_agent_bench", id: "vals-tax-agent", name: "Tax Agent Bench", shortName: "Tax Agent", category: "agentic", industry: "finance" },
  { slug: "medcode", id: "vals-medcode", name: "MedCode", shortName: "MedCode", category: "knowledge", industry: "healthcare" },
  { slug: "medscribe", id: "vals-medscribe", name: "MedScribe", shortName: "MedScribe", category: "knowledge", industry: "healthcare" },
  { slug: "proof_bench", id: "vals-proofbench-v1.1", name: "ProofBench v1.1", shortName: "ProofBench 1.1", category: "math", industry: "math" },
  { slug: "terminal-bench-science", id: "vals-terminal-bench-science", name: "Terminal-Bench Science (Vals)", shortName: "Vals TB Science", category: "agentic", industry: "science" },
  { slug: "biomysterybench", id: "vals-biomysterybench", name: "BioMysteryBench", shortName: "BioMystery", category: "agentic", industry: "science" },
  { slug: "mysterymechanism", id: "vals-mysterymechanism", name: "MysteryMechanism", shortName: "MysteryMechanism", category: "reasoning", industry: "science" },
];

type PlainRecord = Record<string, unknown>;

export interface ParsedValsPage {
  componentUrl: string;
  metadata: PlainRecord & {
    slug: string;
    benchmark: string;
    description: string;
    benchmark_id: string;
    industry: string;
    updated: string;
    version: string | number;
    total_models: number;
    models: string[];
    visible: boolean;
    archived: boolean;
  };
  tasks: PlainRecord & { overall: Record<string, PlainRecord & { accuracy: number }> };
  scores: Record<string, PlainRecord & { accuracy: number }>;
}

function isRecord(value: unknown): value is PlainRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function tagEnd(html: string, start: number): number {
  let quote = "";
  for (let i = start + 1; i < html.length; i++) {
    const char = html[i];
    if (quote) {
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === ">") return i;
  }
  return -1;
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: "\u00a0",
    quot: "\"",
  };
  return value.replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z][a-z0-9]+);/gi, (entity, name: string) => {
    if (name[0] !== "#") return named[name.toLowerCase()] ?? entity;
    const isHex = name[1]?.toLowerCase() === "x";
    const codePoint = Number.parseInt(name.slice(isHex ? 2 : 1), isHex ? 16 : 10);
    if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return entity;
    try { return String.fromCodePoint(codePoint); } catch { return entity; }
  });
}

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  let i = tag.indexOf("astro-island") + "astro-island".length;
  while (i > 0 && i < tag.length) {
    while (/\s/.test(tag[i] ?? "")) i++;
    if (tag[i] === ">" || tag[i] === "/") break;
    const start = i;
    while (i < tag.length && !/[\s=/>]/.test(tag[i])) i++;
    if (start === i) { i++; continue; }
    const name = tag.slice(start, i);
    while (/\s/.test(tag[i] ?? "")) i++;
    if (tag[i] !== "=") { attrs[name] = ""; continue; }
    i++;
    while (/\s/.test(tag[i] ?? "")) i++;
    const quote = tag[i] === "\"" || tag[i] === "'" ? tag[i++] : "";
    const valueStart = i;
    if (quote) {
      while (i < tag.length && tag[i] !== quote) i++;
      attrs[name] = decodeEntities(tag.slice(valueStart, i));
      if (tag[i] === quote) i++;
    } else {
      while (i < tag.length && !/[\s>]/.test(tag[i])) i++;
      attrs[name] = decodeEntities(tag.slice(valueStart, i));
    }
  }
  return attrs;
}

function decodeAstroValue(value: unknown): unknown {
  if (Array.isArray(value) && value.length === 2 && Number.isInteger(value[0])) {
    if (value[0] === 0) return decodeAstroValue(value[1]);
    if (value[0] === 1 && Array.isArray(value[1])) return value[1].map(decodeAstroValue);
  }
  if (Array.isArray(value)) return value.map(decodeAstroValue);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, decodeAstroValue(child)]));
  return value;
}

function findBenchmarkViewProps(html: string): { componentUrl: string; props: string } {
  let cursor = 0;
  while (true) {
    const start = html.indexOf("<astro-island", cursor);
    if (start < 0) break;
    const end = tagEnd(html, start);
    if (end < 0) break;
    const attrs = parseAttributes(html.slice(start, end + 1));
    const componentUrl = attrs["component-url"] ?? "";
    if (componentUrl.includes("BenchmarkView")) {
      if (!attrs.props) throw new Error("VALS BenchmarkView island has no props");
      return { componentUrl, props: attrs.props };
    }
    cursor = end + 1;
  }
  throw new Error("VALS page has no BenchmarkView island");
}

function normalizeUpdatedDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})(?:T.*)?$/);
  if (!match) return undefined;
  const date = match[1];
  const parsed = new Date(date + "T00:00:00.000Z");
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? undefined : date;
}

/** `loaded` is the view fetched from a BenchmarkViewLoader island (newer pages); otherwise it's read from the inline props. */
export function parseValsBenchmarkPage(html: string, expectedSlug: string, loaded?: Record<string, unknown>): ParsedValsPage {
  const island = findBenchmarkViewProps(html);
  let view: PlainRecord;
  if (loaded) view = loaded as PlainRecord;
  else {
    let serialized: unknown;
    try {
      serialized = JSON.parse(island.props);
    } catch (error) {
      throw new Error("VALS " + expectedSlug + " BenchmarkView props are not valid JSON: " + String(error));
    }
    const root = decodeAstroValue(serialized);
    const rootRecord = isRecord(root) ? root : {};
    const benchmarkView = isRecord(rootRecord.benchmarkView) ? rootRecord.benchmarkView : {};
    view = isRecord(benchmarkView.default) ? benchmarkView.default : {};
  }
  const metadata = isRecord(view.metadata) ? view.metadata : undefined;
  const taskSets = isRecord(view.tasks) ? view.tasks : undefined;
  const scores = taskSets && isRecord(taskSets.overall) ? taskSets.overall : undefined;

  if (!metadata || metadata.slug !== expectedSlug) {
    throw new Error("VALS page slug mismatch for " + expectedSlug);
  }
  if (!scores || !Array.isArray(metadata.models)) {
    throw new Error("VALS " + expectedSlug + " is missing its overall score map or model list");
  }
  if (metadata.visible !== true || metadata.archived === true) {
    throw new Error("VALS " + expectedSlug + " is not an active visible benchmark");
  }
  if (
    typeof metadata.benchmark !== "string" ||
    typeof metadata.description !== "string" ||
    typeof metadata.benchmark_id !== "string" ||
    typeof metadata.industry !== "string" ||
    !(typeof metadata.version === "string" || (typeof metadata.version === "number" && Number.isFinite(metadata.version))) ||
    typeof metadata.updated !== "string" ||
    !normalizeUpdatedDate(metadata.updated) ||
    typeof metadata.total_models !== "number" ||
    !Number.isInteger(metadata.total_models) ||
    metadata.total_models < 1
  ) {
    throw new Error("VALS " + expectedSlug + " has incomplete benchmark metadata or a missing/invalid updated date");
  }
  if (metadata.models.length !== metadata.total_models || metadata.models.some((id) => typeof id !== "string" || !id.trim())) {
    throw new Error("VALS " + expectedSlug + " model count mismatch or invalid model ids: metadata has " + metadata.models.length + ", expected " + metadata.total_models);
  }
  if (new Set(metadata.models).size !== metadata.models.length) {
    throw new Error("VALS " + expectedSlug + " metadata.models contains duplicate ids");
  }

  const ids = Object.keys(scores);
  const modelIds = new Set(metadata.models);
  if (ids.length !== metadata.total_models || ids.some((id) => !modelIds.has(id)) || metadata.models.some((id) => !(id in scores))) {
    throw new Error("VALS " + expectedSlug + " overall scores do not cover every published model");
  }
  for (const [id, rawScore] of Object.entries(scores)) {
    if (!isRecord(rawScore) || typeof rawScore.accuracy !== "number" || !Number.isFinite(rawScore.accuracy) || rawScore.accuracy < 0 || rawScore.accuracy > 100) {
      throw new Error("VALS " + expectedSlug + " has an invalid score for " + id);
    }
  }

  return {
    componentUrl: island.componentUrl,
    metadata: metadata as ParsedValsPage["metadata"],
    tasks: taskSets as ParsedValsPage["tasks"],
    scores: scores as ParsedValsPage["scores"],
  };
}

export function extractConstantsImport(componentModule: string): string {
  const imports = new Set<string>();
  const pattern = /from\s*["']([^"']*constants\.[^"']+\.js)["']/g;
  for (const match of componentModule.matchAll(pattern)) imports.add(match[1]);
  if (imports.size !== 1) {
    throw new Error("VALS BenchmarkView module must import one constants bundle, found " + imports.size);
  }
  return [...imports][0];
}

export interface ValsModelName {
  company: string;
  country: string;
  label: string;
}

export function parseValsModelCatalog(bundle: string, requiredIds: readonly string[] = []): Map<string, ValsModelName> {
  const models = new Map<string, ValsModelName>();
  const pattern = /"((?:\\.|[^"\\])+)":\{company:"((?:\\.|[^"\\])*)",country:"((?:\\.|[^"\\])*)",label:"((?:\\.|[^"\\])*)"/g;
  for (const match of bundle.matchAll(pattern)) {
    try {
      const id = JSON.parse("\"" + match[1] + "\"") as string;
      const company = JSON.parse("\"" + match[2] + "\"") as string;
      const country = JSON.parse("\"" + match[3] + "\"") as string;
      const label = JSON.parse("\"" + match[4] + "\"") as string;
      if (id && label) models.set(id, { company, country, label });
    } catch {
      // Ignore malformed catalog entries; every required id is checked below.
    }
  }
  if (!models.size) throw new Error("VALS constants bundle has no readable model catalog");
  const missing = requiredIds.filter((id) => !models.has(id));
  if (missing.length) throw new Error("VALS model catalog is missing " + missing.length + " published ids: " + missing.slice(0, 8).join(", "));
  return models;
}

function scoreNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function effortFrom(score: PlainRecord): Effort | undefined {
  const raw = score.reasoning_effort ?? score.compute_effort;
  if (typeof raw !== "string") return undefined;
  const value = raw.toLowerCase();
  return ["none", "minimal", "low", "medium", "high", "xhigh", "max"].includes(value) ? value as Effort : undefined;
}

type BenchmarkWithUpdate = Benchmark & { lastUpdated?: string };

const source: Source = {
  id: "vals",
  name: "VALS AI Benchmarks",
  url: ORIGIN + "/benchmarks",
  async scrape(ctx): Promise<ScrapeResult> {
    const pages: { definition: PageDefinition; url: string; html: string; page: ParsedValsPage }[] = [];
    for (let start = 0; start < PAGES.length; start += 4) {
      const batch = await Promise.all(PAGES.slice(start, start + 4).map(async (definition) => {
        const url = ORIGIN + "/benchmarks/" + definition.slug;
        const html = await ctx.fetchText(url);
        const loaded = await loadValsView(html, (target) => ctx.fetchText(target));
        return { definition, url, html, page: parseValsBenchmarkPage(html, definition.slug, loaded) };
      }));
      pages.push(...batch);
    }

    // The catalog bundle is imported by the view component, or (loader pages) by the component it loads.
    const constantsUrls = new Set((await Promise.all(pages.map(({ html }) => valsConstantsUrl(html, (target) => ctx.fetchText(target))))).map((c) => c.url));
    if (constantsUrls.size !== 1) throw new Error("VALS pages resolved to multiple model catalog bundles");

    const constantsUrl = [...constantsUrls][0];
    const catalogBundle = await ctx.fetchText(constantsUrl);
    const requiredIds = [...new Set(pages.flatMap(({ page }) => page.metadata.models))];
    const catalog = parseValsModelCatalog(catalogBundle, requiredIds);

    const benchmarks: BenchmarkWithUpdate[] = [];
    const rows: RawRow[] = [];
    const raw: Record<string, string> = {};
    const pageCounts: string[] = [];
    const catalogRows: Record<string, ValsModelName> = {};

    for (const { definition, url, page } of pages) {
      const metadata = page.metadata;
      if (metadata.industry !== definition.industry) {
        throw new Error("VALS " + definition.slug + " industry changed from " + definition.industry + " to " + metadata.industry);
      }
      const updated = normalizeUpdatedDate(metadata.updated);
      if (!updated) throw new Error("VALS " + definition.slug + " has no valid metadata.updated date");
      const benchmark: BenchmarkWithUpdate = {
        id: definition.id,
        name: definition.name,
        shortName: definition.shortName,
        sourceId: "vals",
        url,
        description: metadata.description,
        unit: "percent",
        higherIsBetter: true,
        category: definition.category,
        versionPolicy: { kind: "fresh" },
        defaultWeight: 0,
        eligibleForDefault: false,
        lastUpdated: updated,
      };
      benchmarks.push(benchmark);

      const pageRows: RawRow[] = [];
      for (const [sourceModelId, score] of Object.entries(page.scores)) {
        const model = catalog.get(sourceModelId);
        if (!model) throw new Error("VALS model catalog lost id " + sourceModelId);
        catalogRows[sourceModelId] = model;
        const stderr = scoreNumber(score.stderr);
        const costUsd = scoreNumber(score.cost_per_test);
        const durationSec = scoreNumber(score.latency);
        const effort = effortFrom(score);
        const provider = typeof score.provider === "string" ? score.provider : undefined;
        const harness = typeof score.harness === "string" ? score.harness : undefined;
        const note = stderr === undefined ? undefined : "Vals AI standard error " + stderr + " percentage points";
        pageRows.push({
          benchmarkId: definition.id,
          modelLabel: model.label,
          sourceModelId,
          effort,
          value: score.accuracy,
          costUsd: costUsd !== undefined && costUsd >= 0 ? costUsd : undefined,
          durationSec: durationSec !== undefined && durationSec >= 0 ? durationSec : undefined,
          harness,
          labHint: provider,
          sourceUrl: url,
          note,
          details: {
            valsModelId: sourceModelId,
            provider,
            standardErrorPercentagePoints: stderr,
            datasetType: metadata.dataset_type,
            benchmarkVersion: metadata.version,
          },
        });
      }
      if (pageRows.length !== metadata.total_models) {
        throw new Error("VALS " + definition.slug + " emitted " + pageRows.length + " rows, expected " + metadata.total_models);
      }
      rows.push(...pageRows);
      pageCounts.push(definition.slug + "=" + pageRows.length);

      raw[definition.slug + ".json"] = JSON.stringify({
        source: "Vals AI BenchmarkView Astro props",
        sourceUrl: url,
        componentUrl: new URL(page.componentUrl, ORIGIN).href,
        constantsBundleUrl: constantsUrl,
        fetchedAt: ctx.now,
        metadata: {
          name: metadata.benchmark,
          benchmarkId: metadata.benchmark_id,
          version: metadata.version,
          updated: metadata.updated,
          industry: metadata.industry,
          datasetType: metadata.dataset_type,
          totalModels: metadata.total_models,
        },
        tasks: page.tasks,
      }, null, 2);
    }

    raw["model-catalog.json"] = JSON.stringify({
      source: "Vals AI constants bundle",
      sourceUrl: constantsUrl,
      models: catalogRows,
    }, null, 2);

    return {
      benchmarks,
      rows,
      raw,
      notes: ["validated all " + benchmarks.length + " active benchmark pages", "rows by page: " + pageCounts.join(", ")],
    };
  },
};

export default source;
