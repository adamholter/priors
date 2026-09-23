import type { Benchmark, RawRow, ScrapeResult, Source } from "../../../src/data/types";

const PAGE = "https://www.vals.ai/benchmarks/programbench";
const ORIGIN = "https://www.vals.ai";
type Score = Record<string, unknown> & { accuracy?: unknown };
type View = { metadata: Record<string, unknown>; tasks: Record<string, Record<string, Score>> };
type AnalysisModel = Record<string, unknown> & {
  model: string; totalTasks: number; resolvedCount: number; resolvedPercent: number;
  almostCount: number; almostPercent: number; partialScore: number;
};
type Analysis = {
  models: AnalysisModel[];
  heatmap: { taskOrder: string[]; models: { model: string; scores: number[]; resolved: boolean[] }[] };
};
type Metric = {
  key: string; id: string; name: string; shortName: string; description: string;
  defaultWeight: number; eligibleForDefault: boolean;
};

const METRICS: Metric[] = [
  { key: "strict", id: "vals-programbench-v1", name: "ProgramBench v1 Fully Resolved", shortName: "ProgramBench",
    description: "Share of public ProgramBench v1 tasks where the implementation passes every hidden behavioral test.",
    defaultWeight: 5, eligibleForDefault: true },
  { key: "almost", id: "vals-programbench-v1-almost-resolved", name: "ProgramBench v1 Almost Resolved", shortName: "ProgramBench 95%",
    description: "Share of public ProgramBench v1 tasks where the implementation passes at least 95% of hidden behavioral tests.",
    defaultWeight: 0, eligibleForDefault: false },
  { key: "partial", id: "vals-programbench-v1-raw-pass-rate", name: "ProgramBench v1 Raw Pass Rate", shortName: "ProgramBench Raw",
    description: "Average percentage of hidden behavioral tests passed per public ProgramBench v1 task.",
    defaultWeight: 0, eligibleForDefault: false },
];
const TASK_KEYS = ["overall", "strict", "almost", "partial"] as const;
const EFFORTS = new Set(["none", "minimal", "low", "medium", "high", "xhigh", "max", "default"]);
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function decodeEntities(s: string): string {
  return s.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (all, token: string) => {
    const t = token.toLowerCase();
    if (t === "amp") return "&";
    if (t === "lt") return "<";
    if (t === "gt") return ">";
    if (t === "quot") return '"';
    if (t === "apos") return "'";
    const n = t.startsWith("#x") ? parseInt(t.slice(2), 16) : parseInt(t.slice(1), 10);
    try { return String.fromCodePoint(n); } catch { return all; }
  });
}
function decodeAstro(v: unknown): unknown {
  if (Array.isArray(v) && v.length === 2 && (v[0] === 0 || v[0] === 1)) {
    if (v[0] === 0) return decodeAstro(v[1]);
    if (!Array.isArray(v[1])) throw new Error("malformed Astro array node");
    return v[1].map(decodeAstro);
  }
  if (Array.isArray(v)) return v.map(decodeAstro);
  if (isRecord(v)) return Object.fromEntries(Object.entries(v).map(([k, child]) => [k, decodeAstro(child)]));
  return v;
}
function attr(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp('(?:^|\\s)' + name + '="([^"]*)"'));
  return match ? decodeEntities(match[1]) : undefined;
}
function islands(html: string): string[] {
  return [...html.matchAll(/<astro-island\b[^>]*>/gs)].map((m) => m[0]);
}

export function parseProgramBenchHtml(html: string): View {
  for (const tag of islands(html)) {
    const componentUrl = attr(tag, "component-url");
    if (!componentUrl || !/\/BenchmarkView\.[^/]+\.js(?:$|\?)/.test(componentUrl)) continue;
    const serialized = attr(tag, "props");
    if (!serialized) continue;
    let props: unknown;
    try { props = decodeAstro(JSON.parse(serialized)); }
    catch (error) {
      if (serialized.includes("benchmarkView")) throw new Error("ProgramBench: invalid Astro score payload: " + String(error));
      continue;
    }
    if (!isRecord(props) || !isRecord(props.benchmarkView)) continue;
    const root = props.benchmarkView;
    const view = isRecord(root.default) ? root.default : root;
    if (isRecord(view.metadata) && view.metadata.benchmark_id === "programbench" && isRecord(view.tasks)) {
      return view as unknown as View;
    }
  }
  throw new Error("ProgramBench: embedded benchmark table payload not found");
}

function findAnalysisModule(html: string): string {
  for (const tag of islands(html)) {
    const url = attr(tag, "component-url");
    if (url && /\/ProgramBenchResultsAnalysis\.[^/]+\.js(?:$|\?)/.test(url)) return new URL(url, ORIGIN).toString();
  }
  throw new Error("ProgramBench: task-analysis component URL not found");
}
function findBenchmarkViewModule(html: string): string {
  for (const tag of islands(html)) {
    const url = attr(tag, "component-url");
    if (url && /\/BenchmarkView\.[^/]+\.js(?:$|\?)/.test(url)) return new URL(url, ORIGIN).toString();
  }
  throw new Error("ProgramBench: benchmark-view component URL not found");
}
function findCatalogUrl(moduleText: string, moduleUrl: string): string {
  const match = moduleText.match(/from["'](\.\/constants\.[^"']+\.js)["']/);
  if (!match) throw new Error("ProgramBench: model catalog URL not found in benchmark-view module");
  return new URL(match[1], moduleUrl).toString();
}
function readCatalogString(source: string, start: number): { value: string; end: number } {
  if (source[start] !== '"') throw new Error("ProgramBench: malformed model catalog string");
  let end = start + 1;
  let escaped = false;
  for (; end < source.length; end++) {
    if (escaped) escaped = false;
    else if (source[end] === "\\") escaped = true;
    else if (source[end] === '"') break;
  }
  if (end >= source.length) throw new Error("ProgramBench: unterminated model catalog string");
  try { return { value: JSON.parse(source.slice(start, end + 1)) as string, end: end + 1 }; }
  catch { throw new Error("ProgramBench: invalid model catalog string"); }
}
function matchingEnd(source: string, start: number, open: string, close: string): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === open) depth++;
    else if (c === close && --depth === 0) return i;
  }
  throw new Error("ProgramBench: unterminated model catalog value");
}
function topLevelLabel(record: string): string | undefined {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = 1; i < record.length - 1; i++) {
    const c = record[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === "{") { depth++; continue; }
    if (c === "}") { depth--; continue; }
    if (depth === 0 && record.startsWith("label:", i) && (i === 1 || record[i - 1] === ",")) {
      let valueStart = i + "label:".length;
      while (/\s/.test(record[valueStart] ?? "")) valueStart++;
      return readCatalogString(record, valueStart).value;
    }
  }
  return undefined;
}
function parseCatalogLabels(catalog: string, modelIds: string[]): Map<string, string> {
  const start = catalog.indexOf("const p=");
  if (start < 0) throw new Error("ProgramBench: model catalog object not found");
  let i = start + "const p=".length;
  if (catalog[i++] !== "{") throw new Error("ProgramBench: malformed model catalog object");
  const direct = new Map<string, string>();
  const aliases = new Map<string, Set<string>>();
  while (i < catalog.length) {
    while (/\s|,/.test(catalog[i] ?? "")) i++;
    if (catalog[i] === "}") break;
    const key = readCatalogString(catalog, i);
    i = key.end;
    while (/\s/.test(catalog[i] ?? "")) i++;
    if (catalog[i++] !== ":") throw new Error("ProgramBench: malformed model catalog entry");
    while (/\s/.test(catalog[i] ?? "")) i++;
    if (catalog[i] !== "{") throw new Error("ProgramBench: model catalog entry is not an object");
    const end = matchingEnd(catalog, i, "{", "}");
    const record = catalog.slice(i, end + 1);
    const label = topLevelLabel(record);
    if (label) {
      direct.set(key.value, label);
      const altAt = record.indexOf("alternative_keys:");
      if (altAt >= 0) {
        const listStart = record.indexOf("[", altAt);
        if (listStart >= 0) {
          const listEnd = matchingEnd(record, listStart, "[", "]");
          const altList = record.slice(listStart + 1, listEnd);
          const aliasesHere = /"((?:\\.|[^"\\])+)"\s*:\s*\{/g;
          for (const match of altList.matchAll(aliasesHere)) {
            let alias: string;
            try { alias = JSON.parse('"' + match[1] + '"') as string; }
            catch { throw new Error("ProgramBench: invalid alternative model key in VALS catalog"); }
            const candidates = aliases.get(alias) ?? new Set<string>();
            candidates.add(label);
            aliases.set(alias, candidates);
          }
        }
      }
    }
    i = end + 1;
    while (/\s/.test(catalog[i] ?? "")) i++;
    if (catalog[i] === ",") i++;
    else if (catalog[i] !== "}") throw new Error("ProgramBench: malformed model catalog boundary");
  }
  const labels = new Map<string, string>();
  for (const id of modelIds) {
    const candidates = aliases.get(id);
    if (!direct.has(id) && candidates && candidates.size > 1) {
      throw new Error("ProgramBench: VALS catalog alternative key has conflicting labels: " + id);
    }
    const label = direct.get(id) ?? (candidates ? [...candidates][0] : undefined);
    if (!label) throw new Error("ProgramBench: display label missing from VALS catalog for " + id);
    labels.set(id, label);
  }
  return labels;
}
function findAnalysisJson(moduleText: string): string {
  const match = moduleText.match(/["'](\/_astro\/[^"']*results_analysis[^"']*\.json)["']/i);
  if (!match) throw new Error("ProgramBench: task-analysis JSON URL not found in page component");
  return new URL(match[1], PAGE).toString();
}
function updatedDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value) {
    throw new Error("ProgramBench: valid metadata.updated date missing");
  }
  return value;
}
function parseAnalysis(text: string, view: View): { analysis: Analysis; models: Map<string, AnalysisModel> } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error("ProgramBench: task-analysis JSON is invalid"); }
  if (!isRecord(raw) || !Array.isArray(raw.models) || !isRecord(raw.heatmap) ||
      !Array.isArray(raw.heatmap.taskOrder) || !Array.isArray(raw.heatmap.models)) {
    throw new Error("ProgramBench: task-analysis payload has an unexpected shape");
  }
  const data = raw as unknown as Analysis;
  const ids = view.metadata.models as string[];
  if (data.models.length !== ids.length || data.heatmap.models.length !== ids.length ||
      data.heatmap.taskOrder.length === 0) throw new Error("ProgramBench: task-analysis counts do not match table");
  const models = new Map(data.models.map((m) => [m.model, m]));
  const heatmap = new Map(data.heatmap.models.map((m) => [m.model, m]));
  if (models.size !== ids.length || heatmap.size !== ids.length || ids.some((id) => !models.has(id) || !heatmap.has(id))) {
    throw new Error("ProgramBench: task-analysis model IDs do not match table");
  }
  for (const id of ids) {
    const m = models.get(id)!;
    const h = heatmap.get(id)!;
    if (!isNum(m.totalTasks) || m.totalTasks !== data.heatmap.taskOrder.length ||
        !isNum(m.resolvedCount) || !isNum(m.resolvedPercent) || !isNum(m.almostCount) ||
        !isNum(m.almostPercent) || !isNum(m.partialScore) ||
        !Array.isArray(h.scores) || !Array.isArray(h.resolved) ||
        h.scores.length !== data.heatmap.taskOrder.length || h.resolved.length !== data.heatmap.taskOrder.length ||
        !h.scores.every(isNum) || !h.resolved.every((x) => typeof x === "boolean")) {
      throw new Error("ProgramBench: task-level scores incomplete for " + id);
    }
    const strict = view.tasks.strict[id]?.accuracy;
    const almost = view.tasks.almost[id]?.accuracy;
    const partial = view.tasks.partial[id]?.accuracy;
    const resolvedCount = h.resolved.filter(Boolean).length;
    const almostCount = m.almostCount;
    const taskMean = h.scores.reduce((sum, score) => sum + score, 0) / h.scores.length;
    if (!isNum(strict) || !isNum(almost) || !isNum(partial) ||
        strict !== m.resolvedPercent || almost !== m.almostPercent ||
        resolvedCount !== m.resolvedCount || Math.abs(resolvedCount / m.totalTasks * 100 - strict) > 1e-9 ||
        Math.abs(almostCount / m.totalTasks * 100 - almost) > 1e-9 ||
        h.scores.some((score) => score < 0 || score > 100) ||
        Math.abs(taskMean - partial) > 0.001 || Math.abs(taskMean - m.partialScore) > 0.01) {
      throw new Error("ProgramBench: task-analysis summary differs from table for " + id);
    }
  }
  return { analysis: data, models };
}
function effort(score: Score): string | undefined {
  for (const candidate of [score.reasoning_effort, score.compute_effort]) {
    if (typeof candidate === "string" && EFFORTS.has(candidate.toLowerCase().trim())) return candidate.toLowerCase().trim();
  }
  return undefined;
}
function distinctOverall(view: View, ids: string[]): boolean {
  return ids.some((id) => JSON.stringify(view.tasks.overall[id]) !== JSON.stringify(view.tasks.strict[id]));
}
function makeBenchmarks(date: string, overallIsDistinct: boolean): Benchmark[] {
  const out = METRICS.map((m) => ({
    id: m.id, name: m.name, shortName: m.shortName, sourceId: "programbench", url: PAGE,
    description: m.description, normalization: { kind: "linear" as const, min: 0, max: 100 },
    unit: "percent" as const, higherIsBetter: true, category: "coding" as const,
    versionPolicy: { kind: "fresh" as const }, defaultWeight: m.defaultWeight,
    eligibleForDefault: m.eligibleForDefault, lastUpdated: date,
  }));
  if (overallIsDistinct) out.push({
    id: "vals-programbench-v1-overall", name: "ProgramBench v1 Overall", shortName: "ProgramBench Overall",
    sourceId: "programbench", url: PAGE, description: "VALS AI's published Overall score for ProgramBench v1.",
    normalization: { kind: "linear" as const, min: 0, max: 100 }, unit: "percent" as const,
    higherIsBetter: true, category: "coding" as const, versionPolicy: { kind: "fresh" as const },
    defaultWeight: 0, eligibleForDefault: false, lastUpdated: date,
  });
  return out;
}

const source: Source = {
  id: "programbench",
  name: "VALS AI ProgramBench",
  url: PAGE,
  async scrape(ctx): Promise<ScrapeResult> {
    const html = await ctx.fetchText(PAGE);
    const view = parseProgramBenchHtml(html);
    const date = updatedDate(view.metadata.updated);
    const ids = view.metadata.models;
    const labels = view.metadata.tasks;
    if (!Array.isArray(ids) || !ids.length || !ids.every((x) => typeof x === "string") || new Set(ids).size !== ids.length ||
        !isRecord(labels)) throw new Error("ProgramBench: model or metric metadata missing");
    for (const key of TASK_KEYS) {
      if (typeof labels[key] !== "string" || !isRecord(view.tasks[key]) || Object.keys(view.tasks[key]).length !== ids.length ||
          ids.some((id) => !isRecord(view.tasks[key][id]))) throw new Error("ProgramBench: incomplete " + key + " rows");
      for (const id of ids) {
        const score = view.tasks[key][id].accuracy;
        if (!isNum(score) || score < 0 || score > 100) throw new Error("ProgramBench: invalid " + key + " score for " + id);
      }
    }
    const moduleUrl = findAnalysisModule(html);
    const moduleText = await ctx.fetchText(moduleUrl);
    const analysisUrl = findAnalysisJson(moduleText);
    const analysisText = await ctx.fetchText(analysisUrl);
    const viewModuleUrl = findBenchmarkViewModule(html);
    const viewModuleText = await ctx.fetchText(viewModuleUrl);
    const catalogUrl = findCatalogUrl(viewModuleText, viewModuleUrl);
    const catalogText = await ctx.fetchText(catalogUrl);
    const { analysis, models } = parseAnalysis(analysisText, view);
    const modelLabels = parseCatalogLabels(catalogText, ids);
    const overallIsDistinct = distinctOverall(view, ids);
    const benchmarks = makeBenchmarks(date, overallIsDistinct);
    const metricRows: { key: string; id: string; label: string }[] = METRICS.map((m) => ({
      key: m.key, id: m.id, label: labels[m.key] as string,
    }));
    if (overallIsDistinct) metricRows.push({ key: "overall", id: "vals-programbench-v1-overall", label: labels.overall as string });

    const rows: RawRow[] = [];
    for (const modelId of ids) {
      const taskMetrics = Object.fromEntries(TASK_KEYS.map((key) => [key, view.tasks[key][modelId]]));
      const summary = models.get(modelId)!;
      const heat = analysis.heatmap.models.find((m) => m.model === modelId)!;
      for (const metric of metricRows) {
        const score = view.tasks[metric.key]?.[modelId];
        if (!score || !isNum(score.accuracy)) continue;
        rows.push({
          benchmarkId: metric.id, modelLabel: modelLabels.get(modelId)!, sourceModelId: modelId, effort: effort(score),
          value: score.accuracy,
          costUsd: isNum(score.cost_per_test) ? score.cost_per_test : undefined,
          harness: "mini-SWE-agent", sourceUrl: PAGE,
          details: {
            sourceModelId: modelId, catalogLabel: modelLabels.get(modelId), provider: score.provider, taskMetricKey: metric.key,
            taskMetricLabel: metric.label, taskMetrics, sourceScore: score,
            taskAnalysis: {
              runId: summary.runId, totalTasks: summary.totalTasks,
              resolvedCount: summary.resolvedCount, resolvedPercent: summary.resolvedPercent,
              almostCount: summary.almostCount, almostPercent: summary.almostPercent,
              partialScore: summary.partialScore, taskOrder: analysis.heatmap.taskOrder,
              taskScores: heat.scores, resolved: heat.resolved,
            },
            pageUpdated: date, analysisUrl, publishedHarness: "mini-SWE-agent", sourceRowHarness: score.harness,
          },
        });
      }
    }
    return {
      benchmarks, rows,
      raw: {
        "page.html": html, "analysis-component.js": moduleText, "task-analysis.json": analysisText,
        "benchmark-view-component.js": viewModuleText, "model-catalog-module.js": catalogText,
      },
      notes: [
        ids.length + " models; " + analysis.heatmap.taskOrder.length + " task scores per model",
        overallIsDistinct ? "Overall differs from Strict and is exposed at zero default weight" :
          "Overall duplicates Strict exactly and is retained in row details",
        "accuracy values, standard errors, tie-breaker scores, and run metadata are preserved without conversion",
      ],
    };
  },
};
export default source;
