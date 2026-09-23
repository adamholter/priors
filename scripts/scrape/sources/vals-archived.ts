import type { Benchmark, BenchmarkCategory, RawRow, ScrapeResult, Source } from "../../../src/data/types";
import { fetchValsDisplayNames, parseValsBenchmarkView, valsDisplayName, VALS_ORIGIN } from "./_vals";

const INDEX_URL = `${VALS_ORIGIN}/benchmarks`;
const SOURCE_ID = "vals-archived";

/** Routes listed by VALS under "View archived benchmark(s)" on 2026-09-23. */
export const ARCHIVED_BENCHMARK_SLUGS = [
  "vals_multimodal_index", "case_law_v2", "corp_fin_v2", "mortgage_tax", "tax_eval_v2",
  "medqa", "aime", "math500", "mgsm", "gpqa", "mmlu_pro", "mmmu",
  "terminal-bench-2-1", "swebench", "lcb", "terminal-bench-2", "public-benefits-bench-v1",
] as const;

type Json = Record<string, unknown>;
type Score = {
  accuracy?: unknown;
  stderr?: unknown;
  cost_per_test?: unknown;
  latency?: unknown;
  provider?: unknown;
  reasoning_effort?: unknown;
  compute_effort?: unknown;
  harness?: unknown;
  [key: string]: unknown;
};
export interface ParsedArchivedPage {
  benchmark: Benchmark;
  rows: RawRow[];
  payload: Json;
  modelLabels: Record<string, string>;
  modelLabelFallbacks: string[];
}

/** Decode HTML entities once, as the browser does for attribute values. */
function decodeHtml(value: string): string {
  const entities: Record<string, string> = {
    "&quot;": '"',
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&apos;": "'",
    "&#39;": "'",
    "&#x27;": "'",
  };
  return value.replace(/&(?:quot|amp|lt|gt|apos|#39|#x27);/g, (entity) => entities[entity] ?? entity);
}

function pageTitle(html: string, fallback: string): string {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return (title ? decodeHtml(title.replace(/<[^>]*>/g, "")).trim() : "") || fallback;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function category(industry: unknown): BenchmarkCategory {
  const value = typeof industry === "string" ? industry.toLowerCase() : "";
  const map: Record<string, BenchmarkCategory> = {
    coding: "coding",
    math: "math",
    finance: "economics",
    "social mobility": "economics",
    legal: "knowledge",
    healthcare: "knowledge",
    academic: "knowledge",
    education: "knowledge",
    science: "knowledge",
    index: "composite",
  };
  return map[value] ?? "other";
}

function sourceEffort(row: Score): string | undefined {
  for (const candidate of [row.reasoning_effort, row.compute_effort]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return undefined;
}

function parseDate(value: unknown, slug: string): string | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new Error("VALS " + slug + ": invalid benchmark updated date " + JSON.stringify(value));
  }
  const match = value.match(/^(\d{4}-\d{2}-\d{2})(?:T.+)?$/);
  if (!match) throw new Error("VALS " + slug + ": invalid benchmark updated date " + JSON.stringify(value));
  const date = match[1];
  const parsedDate = new Date(date + "T00:00:00Z");
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    throw new Error("VALS " + slug + ": invalid benchmark updated date " + JSON.stringify(value));
  }
  if (value !== date && Number.isNaN(Date.parse(value))) {
    throw new Error("VALS " + slug + ": invalid benchmark updated date " + JSON.stringify(value));
  }
  return date;
}

function idFor(slug: string): string {
  const normalized = slug.replaceAll("_", "-");
  return normalized.startsWith("vals-") ? normalized : `vals-${normalized}`;
}

export function parseArchivedPage(html: string, slug: string, displayNames: Record<string, string> = {}): ParsedArchivedPage {
  const payload = parseValsBenchmarkView(html, slug) as unknown as Json;
  const metadata = payload.metadata as Json | undefined;
  const taskRows = payload.tasks as Record<string, Record<string, Score>> | undefined;
  if (!metadata || !taskRows || typeof taskRows !== "object") {
    throw new Error(`VALS ${slug}: benchmark metadata or task scores are missing`);
  }
  if (metadata.slug !== slug) throw new Error(`VALS ${slug}: page returned metadata for ${String(metadata.slug)}`);

  const taskNames = metadata.tasks as Record<string, string> | undefined;
  if (!taskNames || typeof taskNames !== "object" || !taskRows.overall || typeof taskRows.overall !== "object") {
    throw new Error(`VALS ${slug}: overall scores or task labels are missing`);
  }
  const missingTasks = Object.keys(taskNames).filter((taskId) => !taskRows[taskId]);
  const unnamedTasks = Object.keys(taskRows).filter((taskId) => !taskNames[taskId]);
  const modelIds = metadata.models;
  const expectedCount = finite(metadata.total_models)
    ? metadata.total_models
    : Array.isArray(modelIds) ? modelIds.length : undefined;
  const overallIds = Object.keys(taskRows.overall);
  if (missingTasks.length || unnamedTasks.length) {
    throw new Error(`VALS ${slug}: task map mismatch (missing data: ${missingTasks.join(", ") || "none"}; missing labels: ${unnamedTasks.join(", ") || "none"})`);
  }
  if (!expectedCount || overallIds.length !== expectedCount) {
    throw new Error(`VALS ${slug}: expected ${String(expectedCount ?? "a model count")} overall rows, found ${overallIds.length}`);
  }
  if (Array.isArray(modelIds)) {
    const expected = new Set(modelIds.filter((id): id is string => typeof id === "string"));
    const actual = new Set(overallIds);
    if (expected.size !== modelIds.length || expected.size !== actual.size || [...expected].some((id) => !actual.has(id))) {
      throw new Error(`VALS ${slug}: overall scores do not match metadata.models`);
    }
  }
  for (const [taskId, label] of Object.entries(taskNames)) {
    const task = taskRows[taskId];
    const keys = Object.keys(task ?? {});
    if (keys.length !== expectedCount || overallIds.some((id) => !task[id])) {
      throw new Error(`VALS ${slug}: published task ${taskId} (${label}) has incomplete model coverage`);
    }
    if (Object.entries(task).some(([, row]) => !finite(row?.accuracy))) {
      throw new Error(`VALS ${slug}: published task ${taskId} (${label}) has a missing score`);
    }
  }

  const sourceUrl = `${VALS_ORIGIN}/benchmarks/${slug}`;
  const sourceName = typeof metadata.benchmark === "string" ? metadata.benchmark : slug;
  let name = pageTitle(html, sourceName);
  const version = typeof metadata.version === "string" ? metadata.version : "";
  if (/^vals\s/i.test(name) && version && !name.toLowerCase().includes(version.toLowerCase())) name += ` v${version}`;
  if (!/^vals\s/i.test(name)) name += " (Vals AI)";
  const lastUpdated = parseDate(metadata.updated, slug);
  const advanced = Object.entries(taskNames)
    .filter(([taskId]) => taskId !== "overall")
    .map(([id, label]) => ({ id, name: label }));

  const benchmark: Benchmark = {
    id: idFor(slug),
    name,
    shortName: /^vals\s/i.test(name) ? name : `Vals ${pageTitle(html, sourceName)}`,
    sourceId: SOURCE_ID,
    url: sourceUrl,
    description: [
      typeof metadata.description === "string" ? metadata.description : `Archived VALS benchmark results for ${sourceName}.`,
      "Scores are the values published by VALS AI.",
      version ? `Source benchmark version ${version}.` : "",
    ].filter(Boolean).join(" "),
    ...(lastUpdated ? { lastUpdated } : {}),
    unit: "percent",
    higherIsBetter: true,
    category: category(metadata.industry),
    versionPolicy: { kind: "fresh" },
    advanced: advanced.length ? advanced : undefined,
    defaultWeight: 0,
    eligibleForDefault: false,
  };

  const rows: RawRow[] = [];
  const modelLabels: Record<string, string> = {};
  const modelLabelFallbacks: string[] = [];
  for (const [sourceModelId, score] of Object.entries(taskRows.overall)) {
    const value = score?.accuracy;
    if (!finite(value)) throw new Error(`VALS ${slug}: missing overall score for ${sourceModelId}`);
    if (value < 0 || value > 100) throw new Error(`VALS ${slug}: score for ${sourceModelId} is outside the published percent scale`);
    const catalogKey = typeof score.model_key === "string" && score.model_key ? score.model_key : sourceModelId;
    const catalogLabel = displayNames[catalogKey];
    const modelLabel = valsDisplayName(displayNames, catalogKey);
    if (!modelLabel.trim()) throw new Error("VALS " + slug + ": model display label missing for " + catalogKey);
    if (typeof catalogLabel !== "string" || !catalogLabel.trim()) modelLabelFallbacks.push(catalogKey);
    modelLabels[catalogKey] = modelLabel;
    const details: Record<string, unknown> = {};
    for (const { id: taskId } of advanced) {
      const subScore = taskRows[taskId]?.[sourceModelId]?.accuracy;
      if (subScore == null || !finite(subScore)) continue;
      if (subScore < 0 || subScore > 100) throw new Error(`VALS ${slug}: ${taskId} score for ${sourceModelId} is outside the published percent scale`);
      details[taskId] = subScore;
    }
    rows.push({
      benchmarkId: benchmark.id,
      modelLabel,
      effort: sourceEffort(score),
      value,
      costUsd: finite(score.cost_per_test) ? score.cost_per_test : undefined,
      durationSec: finite(score.latency) ? score.latency : undefined,
      harness: typeof score.harness === "string" ? score.harness : undefined,
      sourceUrl,
      sourceModelId,
      labHint: typeof score.provider === "string" ? score.provider : undefined,
      details: Object.keys(details).length ? details : undefined,
      note: finite(score.stderr) ? `VALS-reported stderr: ${score.stderr} percentage points` : undefined,
    });
  }
  if (!rows.length) throw new Error(`VALS ${slug}: no finite overall accuracy scores`);
  for (const [taskId, taskLabel] of Object.entries(taskNames)) {
    const scores = Object.values(taskRows[taskId] ?? {}).filter((row) => finite(row?.accuracy));
    if (!scores.length) throw new Error(`VALS ${slug}: no finite scores for published task ${taskId} (${taskLabel})`);
    if (scores.some((row) => (row.accuracy as number) < 0 || (row.accuracy as number) > 100)) {
      throw new Error(`VALS ${slug}: task ${taskId} has a score outside the published percent scale`);
    }
  }
  return { benchmark, rows, payload, modelLabels, modelLabelFallbacks };
}

export function parseBenchmarkCatalogue(html: string): Set<string> {
  const slugs = new Set<string>();
  const re = /<a\b[^>]*\bhref=["']\/benchmarks\/([^"'?#]+)["'][^>]*>/gi;
  for (const match of html.matchAll(re)) slugs.add(decodeHtml(match[1]));
  return slugs;
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  }));
  return results;
}

const source: Source = {
  id: SOURCE_ID,
  name: "VALS AI archived benchmarks",
  url: INDEX_URL,
  async scrape(ctx): Promise<ScrapeResult> {
    const catalogue = await ctx.fetchText(INDEX_URL);
    const listed = parseBenchmarkCatalogue(catalogue);
    const missingRoutes = ARCHIVED_BENCHMARK_SLUGS.filter((slug) => !listed.has(slug));
    if (missingRoutes.length) {
      throw new Error(`VALS archive catalogue is missing required routes: ${missingRoutes.join(", ")}`);
    }

    const pages = await mapWithConcurrency(ARCHIVED_BENCHMARK_SLUGS, 4, async (slug) => {
      const html = await ctx.fetchText(`${VALS_ORIGIN}/benchmarks/${slug}`);
      const displayNames = await fetchValsDisplayNames(html, (url) => ctx.fetchText(url));
      return { slug, html, parsed: parseArchivedPage(html, slug, displayNames) };
    });
    const raw: Record<string, string> = { "benchmarks.html": catalogue };
    for (const page of pages) {
      raw[`${page.slug}.html`] = page.html;
      raw[`${page.slug}.benchmark-view.json`] = JSON.stringify(page.parsed.payload);
      raw[`${page.slug}.model-labels.json`] = JSON.stringify(page.parsed.modelLabels);
      raw[`${page.slug}.model-label-fallbacks.json`] = JSON.stringify(page.parsed.modelLabelFallbacks);
    }
    const benchmarks = pages.map((page) => page.parsed.benchmark);
    const rows = pages.flatMap((page) => page.parsed.rows);
    const labelFallbacks = pages.flatMap((page) => page.parsed.modelLabelFallbacks.map((key) => page.slug + ": " + key));
    return {
      benchmarks,
      rows,
      raw,
      notes: [
        `all ${pages.length} archived routes from the VALS catalogue were fetched and parsed`,
        `${rows.length} overall model scores; benchmark task splits are retained in observation details and raw payloads`,
        ...(labelFallbacks.length ? ["raw VALS model-key fallback used for " + labelFallbacks.length + " retired model labels: " + labelFallbacks.join(", ")] : []),
      ],
    };
  },
};

export default source;\n