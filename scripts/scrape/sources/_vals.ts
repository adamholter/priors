/** Shared readers for the public Vals AI Astro benchmark payloads. */
import type { Benchmark, BenchmarkCategory, BenchmarkUnit, RawRow, ScrapeResult, Source } from "../../../src/data/types";

export const VALS_ORIGIN = "https://www.vals.ai";

export interface ValsSourceConfig {
  sourceId: string;
  slug: string;
  /** Astro payload slug when VALS serves the page under a legacy route. */
  payloadSlug?: string;
  benchmarkId: string;
  name: string;
  shortName?: string;
  category: BenchmarkCategory;
  unit?: BenchmarkUnit;
  higherIsBetter?: boolean;
  description: string;
  eligibleForDefault?: boolean;
  defaultWeight?: number;
}

interface ValsRecord extends Record<string, unknown> {
  accuracy?: unknown;
  latency?: unknown;
  stderr?: unknown;
  cost_per_test?: unknown;
  reasoning_effort?: unknown;
  compute_effort?: unknown;
  provider?: unknown;
  harness?: unknown;
  model_key?: unknown;
}

export interface ValsModelCatalogEntry {
  label?: unknown;
  company?: unknown;
  slug?: unknown;
  supports?: unknown;
  alternative_keys?: unknown;
}

interface ValsView {
  metadata?: Record<string, unknown>;
  tasks?: Record<string, Record<string, ValsRecord>>;
}

type BenchmarkWithLastUpdated = Benchmark & { lastUpdated?: string };

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const isNum = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const catalogCache = new Map<string, Promise<{ entries: Record<string, ValsModelCatalogEntry>; source: string }>>();

function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower === "amp") return "&";
    if (lower === "lt") return "<";
    if (lower === "gt") return ">";
    if (lower === "quot") return '"';
    if (lower === "apos") return "'";
    const point = lower.startsWith("#x") ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10);
    try { return String.fromCodePoint(point); } catch { return whole; }
  });
}

/** Decode Astro's public island serialization: [0, value] nodes and [1, children] arrays. */
function decodeAstroValue(value: unknown): unknown {
  if (Array.isArray(value) && value.length === 2 && (value[0] === 0 || value[0] === 1)) {
    if (value[0] === 0) return decodeAstroValue(value[1]);
    if (!Array.isArray(value[1])) throw new Error("Astro island array node is malformed");
    return value[1].map(decodeAstroValue);
  }
  if (Array.isArray(value)) return value.map(decodeAstroValue);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, decodeAstroValue(entry)]));
  return value;
}

/** Extract the hydrated props for a named component from its server-rendered Astro island. */
export function astroIslandProps(html: string, componentName: string): Record<string, unknown> {
  for (const match of html.matchAll(/<astro-island\b(?:[^>"']|"[^"]*"|'[^']*')*>/g)) {
    const tag = match[0];
    const componentUrl = tag.match(/(?:^|\s)component-url="([^"]*)"/)?.[1] ?? "";
    if (!componentUrl.includes(componentName)) continue;
    const rawProps = tag.match(/(?:^|\s)props="([^"]*)"/)?.[1];
    if (!rawProps) throw new Error(`Vals AI: ${componentName} island has no props`);
    let serialized: unknown;
    try { serialized = JSON.parse(decodeHtmlEntities(rawProps)); }
    catch (error) { throw new Error(`Vals AI: invalid ${componentName} island props: ${error instanceof Error ? error.message : String(error)}`); }
    const props = decodeAstroValue(serialized);
    if (!isRecord(props)) throw new Error(`Vals AI: ${componentName} island props are not an object`);
    return props;
  }
  throw new Error(`Vals AI: ${componentName} island missing from page`);
}

function astroComponentUrl(html: string, componentName: string): string {
  for (const match of html.matchAll(/<astro-island\b(?:[^>"']|"[^"]*"|'[^']*')*>/g)) {
    const tag = match[0];
    const componentUrl = tag.match(/(?:^|\s)component-url="([^"]*)"/)?.[1] ?? "";
    if (componentUrl.includes(componentName)) return decodeHtmlEntities(componentUrl);
  }
  throw new Error(`Vals AI: ${componentName} island missing from page`);
}

/**
 * Index just past the `=` of the model catalog's declaration. The bundler renames the constant between
 * deploys (`p`, `_`, ...), so it is found by shape: a map of "provider/model" keys to records.
 */
export function findValsCatalogStart(source: string): number {
  const declaration = /(?:const|let|var)\s+[\w$]+\s*=\s*(?=\{\s*["']?[^"':{}\s]+\/[^"':{}\s]+["']?\s*:\s*\{)/.exec(source);
  if (!declaration) throw new Error("Vals AI model catalog: model object missing");
  return declaration.index + declaration[0].length;
}

/** Parse the generated, data-only JavaScript object shipped as VALS' model catalog. */
export function parseValsModelCatalog(source: string): Record<string, ValsModelCatalogEntry> {
  let i = findValsCatalogStart(source);
  const skip = () => { while (/\s/.test(source[i] ?? "")) i++; };
  const parseString = (): string => {
    const quote = source[i++];
    let out = "";
    while (i < source.length) {
      const char = source[i++];
      if (char === quote) return out;
      if (char !== "\\") { out += char; continue; }
      const escaped = source[i++];
      if (escaped === "n") out += "\n";
      else if (escaped === "r") out += "\r";
      else if (escaped === "t") out += "\t";
      else if (escaped === "b") out += "\b";
      else if (escaped === "f") out += "\f";
      else if (escaped === "v") out += "\v";
      else if (escaped === "0") out += "\0";
      else if (escaped === "x") {
        const hex = source.slice(i, i + 2);
        if (!/^[\da-f]{2}$/i.test(hex)) throw new Error("Vals AI model catalog: malformed hex escape");
        out += String.fromCharCode(parseInt(hex, 16)); i += 2;
      } else if (escaped === "u") {
        if (source[i] === "{") {
          const close = source.indexOf("}", i + 1);
          const hex = close < 0 ? "" : source.slice(i + 1, close);
          if (!/^[\da-f]+$/i.test(hex)) throw new Error("Vals AI model catalog: malformed unicode escape");
          out += String.fromCodePoint(parseInt(hex, 16)); i = close + 1;
        } else {
          const hex = source.slice(i, i + 4);
          if (!/^[\da-f]{4}$/i.test(hex)) throw new Error("Vals AI model catalog: malformed unicode escape");
          out += String.fromCharCode(parseInt(hex, 16)); i += 4;
        }
      } else if (escaped === "\n") { /* escaped line continuation */ }
      else out += escaped;
    }
    throw new Error("Vals AI model catalog: unterminated string");
  };
  const parseValue = (): unknown => {
    skip();
    const char = source[i];
    if (char === "'" || char === '"') return parseString();
    if (char === "{") {
      i++;
      const object: Record<string, unknown> = {};
      skip();
      while (source[i] !== "}") {
        if (i >= source.length) throw new Error("Vals AI model catalog: unterminated object");
        const key = source[i] === "'" || source[i] === '"' ? parseString() : (() => {
          const match = source.slice(i).match(/^[A-Za-z_$][\w$]*/);
          if (!match) throw new Error(`Vals AI model catalog: invalid object key at ${i}`);
          i += match[0].length; return match[0];
        })();
        skip();
        if (source[i++] !== ":") throw new Error(`Vals AI model catalog: missing colon after ${key}`);
        object[key] = parseValue();
        skip();
        if (source[i] === ",") { i++; skip(); continue; }
        if (source[i] !== "}") throw new Error("Vals AI model catalog: expected comma or object end");
      }
      i++;
      return object;
    }
    if (char === "[") {
      i++;
      const array: unknown[] = [];
      skip();
      while (source[i] !== "]") {
        if (i >= source.length) throw new Error("Vals AI model catalog: unterminated array");
        array.push(parseValue());
        skip();
        if (source[i] === ",") { i++; skip(); continue; }
        if (source[i] !== "]") throw new Error("Vals AI model catalog: expected comma or array end");
      }
      i++;
      return array;
    }
    if (char === "!") {
      i++;
      const bit = source[i++];
      if (bit === "0") return true;
      if (bit === "1") return false;
      throw new Error("Vals AI model catalog: unsupported negation literal");
    }
    const number = source.slice(i).match(/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i)?.[0];
    if (number) { i += number.length; return Number(number); }
    const identifier = source.slice(i).match(/^[A-Za-z_$][\w$]*/)?.[0];
    if (identifier) {
      i += identifier.length;
      if (identifier === "true") return true;
      if (identifier === "false") return false;
      if (identifier === "null") return null;
      if (identifier === "undefined") return undefined;
      throw new Error(`Vals AI model catalog: unsupported identifier ${identifier}`);
    }
    throw new Error(`Vals AI model catalog: unsupported value at ${i}`);
  };
  const parsed = parseValue();
  if (!isRecord(parsed)) throw new Error("Vals AI model catalog: parsed value is not an object");
  return parsed as Record<string, ValsModelCatalogEntry>;
}

/** Return the exact display label BenchmarkView shows for one catalog key. */
export function parseValsModelCatalogEntry(source: string, modelKey: string): ValsModelCatalogEntry | undefined {
  return findValsModelCatalogEntry(parseValsModelCatalog(source), modelKey);
}

function findValsModelCatalogEntry(entries: Record<string, ValsModelCatalogEntry>, modelKey: string): ValsModelCatalogEntry | undefined {
  return resolveValsModelCatalogKey(entries, modelKey)?.entry;
}

function resolveValsModelCatalogKey(entries: Record<string, ValsModelCatalogEntry>, modelKey: string): { key: string; entry: ValsModelCatalogEntry } | undefined {
  const direct = entries[modelKey];
  if (direct) return { key: modelKey, entry: direct };
  const matches = Object.entries(entries).filter(([, entry]) => Array.isArray(entry.alternative_keys) && entry.alternative_keys.includes(modelKey));
  if (matches.length > 1) throw new Error(`Vals AI model catalog: alternative key ${modelKey} maps to multiple models`);
  return matches[0] ? { key: matches[0][0], entry: matches[0][1] } : undefined;
}

/** Fetch VALS' page-linked model catalog as a compact model-key -> displayed-label map. */
export async function fetchValsDisplayNames(html: string, fetchText: (url: string) => Promise<string>): Promise<Record<string, string>> {
  const { entries } = await fetchValsModelCatalog(html, fetchText);
  const labels: Record<string, string> = {};
  for (const [key, entry] of Object.entries(entries)) {
    if (typeof entry.label !== "string" || !entry.label.trim()) continue;
    labels[key] = entry.label;
    if (Array.isArray(entry.alternative_keys)) for (const alias of entry.alternative_keys) {
      if (typeof alias !== "string") continue;
      if (labels[alias] && labels[alias] !== entry.label) throw new Error(`Vals AI model catalog: alternative key ${alias} maps to conflicting labels`);
      labels[alias] = entry.label;
    }
  }
  return labels;
}

export function valsDisplayName(labels: Record<string, string>, modelKey: string): string {
  return labels[modelKey] ?? modelKey;
}

async function fetchValsModelCatalog(html: string, fetchText: (url: string) => Promise<string>): Promise<{ url: string; entries: Record<string, ValsModelCatalogEntry>; source: string; componentUrl: string; componentSource: string }> {
  const { url, componentUrl, componentSource } = await valsConstantsUrl(html, fetchText);
  let pending = catalogCache.get(url);
  if (!pending) {
    pending = fetchText(url).then((source) => ({ entries: parseValsModelCatalog(source), source }));
    catalogCache.set(url, pending);
    pending.catch(() => catalogCache.delete(url));
  }
  const { entries, source } = await pending;
  return { url, entries, source, componentUrl, componentSource };
}

/**
 * The benchmark view (metadata + task score tables). Older pages inline it in the BenchmarkView island's
 * props; newer ones render a BenchmarkViewLoader island whose `benchmarkViewUrl` points at a JSON file.
 */
export async function loadValsView(html: string, fetchText: (url: string) => Promise<string>): Promise<Record<string, unknown> | undefined> {
  const props = astroIslandProps(html, "BenchmarkView");
  if (isRecord(props.benchmarkView)) return isRecord(props.benchmarkView.default) ? props.benchmarkView.default : props.benchmarkView;
  if (typeof props.benchmarkViewUrl === "string") {
    const json = JSON.parse(await fetchText(new URL(props.benchmarkViewUrl, VALS_ORIGIN).toString())) as unknown;
    return isRecord(json) ? (isRecord(json.default) ? json.default : json) : undefined;
  }
  return undefined;
}

/** URL of the model-catalog bundle (`constants.*.js`), imported by the view component or one hop below it. */
export async function valsConstantsUrl(html: string, fetchText: (url: string) => Promise<string>): Promise<{ url: string; componentUrl: string; componentSource: string }> {
  const componentUrl = new URL(astroComponentUrl(html, "BenchmarkView"), VALS_ORIGIN).toString();
  const componentSource = await fetchText(componentUrl);
  const direct = componentSource.match(/from\s*["']\.\/(constants\.[^"']+\.js)["']/)?.[1];
  if (direct) return { url: new URL(`/_astro/${direct}`, VALS_ORIGIN).toString(), componentUrl, componentSource };
  for (const dep of componentSource.matchAll(/from\s*["']\.\/(BenchmarkView\.[^"']+\.js)["']/g)) {
    const src = await fetchText(new URL(`/_astro/${dep[1]}`, VALS_ORIGIN).toString());
    const found = src.match(/from\s*["']\.\/(constants\.[^"']+\.js)["']/)?.[1];
    if (found) return { url: new URL(`/_astro/${found}`, VALS_ORIGIN).toString(), componentUrl, componentSource: src };
  }
  throw new Error("Vals AI BenchmarkView: model catalog import missing");
}

export async function loadValsBenchmarkView(html: string, expectedSlug: string, fetchText: (url: string) => Promise<string>): Promise<ValsView> {
  return checkValsView(await loadValsView(html, fetchText), expectedSlug);
}

export function parseValsBenchmarkView(html: string, expectedSlug: string): ValsView {
  const props = astroIslandProps(html, "BenchmarkView");
  return checkValsView(props.benchmarkView, expectedSlug);
}

function checkValsView(root: unknown, expectedSlug: string): ValsView {
  if (!isRecord(root)) throw new Error(`Vals AI ${expectedSlug}: benchmarkView missing`);
  const view = isRecord(root.default) ? root.default : root;
  if (!isRecord(view.metadata) || !isRecord(view.tasks)) throw new Error(`Vals AI ${expectedSlug}: benchmark metadata or tasks missing`);
  const slug = view.metadata.slug;
  if (slug !== expectedSlug) throw new Error(`Vals AI ${expectedSlug}: payload belongs to ${String(slug)}`);
  return view as ValsView;
}

function slugify(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function stableHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createValsSource(config: ValsSourceConfig): Source {
  const url = `${VALS_ORIGIN}/benchmarks/${config.slug}`;
  return {
    id: config.sourceId,
    name: config.name,
    url,
    async scrape(ctx): Promise<ScrapeResult> {
      const html = await ctx.fetchText(url);
      const view = await loadValsBenchmarkView(html, config.payloadSlug ?? config.slug, (target) => ctx.fetchText(target));
      const catalog = await fetchValsModelCatalog(html, (target) => ctx.fetchText(target));
      const metadata = view.metadata!;
      const task = view.tasks!.overall;
      if (!isRecord(task) || !Object.keys(task).length) throw new Error(`Vals AI ${config.slug}: overall score table missing`);

      const modelIds = metadata.models;
      const expectedCount = isNum(metadata.total_models) ? metadata.total_models : Array.isArray(modelIds) ? modelIds.length : undefined;
      const keys = Object.keys(task);
      let modelListNote: string | undefined;
      if (!expectedCount || keys.length !== expectedCount) {
        throw new Error(`Vals AI ${config.slug}: expected ${String(expectedCount ?? "a model count")} overall rows, found ${keys.length}`);
      }
      if (Array.isArray(modelIds)) {
        if (modelIds.length !== expectedCount || new Set(modelIds).size !== modelIds.length) {
          throw new Error(`Vals AI ${config.slug}: metadata.models count or uniqueness does not match total_models`);
        }
        const actual = keys.map((id) => {
          const record = task[id];
          const rowKey = isRecord(record) && typeof record.model_key === "string" && record.model_key ? record.model_key : id;
          return resolveValsModelCatalogKey(catalog.entries, rowKey)?.key;
        });
        if (actual.some((id) => !id) || new Set(actual).size !== keys.length) {
          const missingCatalogIds = keys.filter((id) => {
            const record = task[id];
            const rowKey = isRecord(record) && typeof record.model_key === "string" && record.model_key ? record.model_key : id;
            return !resolveValsModelCatalogKey(catalog.entries, rowKey);
          }).slice(0, 5);
          throw new Error(`Vals AI ${config.slug}: overall rows lack unique catalog identities: ${missingCatalogIds.join(", ")}`);
        }
        const expected = modelIds.map((id) => typeof id === "string" ? resolveValsModelCatalogKey(catalog.entries, id)?.key : undefined);
        const unresolvedMetadataIds = modelIds.filter((id, index) => typeof id !== "string" || !expected[index]);
        if (unresolvedMetadataIds.length) {
          modelListNote = `metadata.models includes ${unresolvedMetadataIds.length} stale IDs absent from the current catalog; total_models and uniquely labeled overall rows agree`;
        } else {
          const expectedSet = new Set(expected as string[]);
          const actualSet = new Set(actual as string[]);
          if (expectedSet.size !== modelIds.length || expectedSet.size !== actualSet.size || [...expectedSet].some((id) => !actualSet.has(id))) {
            const missing = [...expectedSet].filter((id) => !actualSet.has(id)).slice(0, 5);
            const extra = [...actualSet].filter((id) => !expectedSet.has(id)).slice(0, 5);
            throw new Error(`Vals AI ${config.slug}: score table does not match metadata.models (metadata-only: ${missing.join(", ") || "none"}; table-only: ${extra.join(", ") || "none"})`);
          }
        }
      }

      const updatedRaw = metadata.updated;
      const updated = typeof updatedRaw === "string" ? updatedRaw.match(/^(\d{4}-\d{2}-\d{2})(?:T|$)/)?.[1] : undefined;
      if (!updated || Number.isNaN(Date.parse(`${updated}T00:00:00Z`))) {
        throw new Error(`Vals AI ${config.slug}: valid metadata.updated date missing`);
      }

      const rows: RawRow[] = [];
      const modelMeta: NonNullable<ScrapeResult["modelMeta"]> = [];
      const usedCatalogKeys = new Set<string>();
      for (const [modelKey, record] of Object.entries(task)) {
        if (!isRecord(record)) throw new Error(`Vals AI ${config.slug}: invalid score for ${modelKey}`);
        const row = record as ValsRecord;
        const accuracy = row.accuracy;
        if (!isNum(accuracy)) throw new Error(`Vals AI ${config.slug}: invalid score for ${modelKey}`);
        const sourceCatalogKey = typeof row.model_key === "string" && row.model_key ? row.model_key : modelKey;
        const resolvedCatalog = resolveValsModelCatalogKey(catalog.entries, sourceCatalogKey);
        if (!resolvedCatalog) throw new Error(`Vals AI ${config.slug}: model catalog identity missing for ${sourceCatalogKey}`);
        const catalogKey = resolvedCatalog.key;
        const model = resolvedCatalog.entry;
        if (typeof model.label !== "string" || !model.label.trim()) {
          throw new Error(`Vals AI ${config.slug}: exact display label missing from model catalog for ${sourceCatalogKey}`);
        }
        usedCatalogKeys.add(catalogKey);
        const modelLabel = model.label;
        const effort = typeof row.reasoning_effort === "string" && row.reasoning_effort.trim()
          ? row.reasoning_effort.trim()
          : typeof row.compute_effort === "string" && row.compute_effort.trim() ? row.compute_effort.trim() : undefined;
        const details: Record<string, unknown> = {};
        if (isNum(row.stderr)) details.stderr = row.stderr; // Vals publishes standard errors, not confidence intervals.
        if (typeof row.provider === "string") details.provider = row.provider;
        if (typeof row.harness === "string") details.harness = row.harness;
        let identity: RawRow["identity"];
        let modelMetadata: RawRow["modelMetadata"];
        if (config.sourceId === "vals-voice-code-bench" && isRecord(model?.supports) && model.supports.transcription === true) {
          const modelId = `vals-audio-${slugify(catalogKey) || "model"}-${stableHash(catalogKey)}`;
          const sourceSlug = typeof model.slug === "string" && model.slug ? model.slug : slugify(catalogKey);
          const labId = slugify(typeof model.company === "string" ? model.company : typeof row.provider === "string" ? row.provider : "other") || "other";
          identity = { modelId, modelName: modelLabel, labId, effort: "none", variantId: `${modelId}@none`, sourceModelId: modelKey, sourceSlug };
          modelMetadata = { kind: "audio", sourceModelUrl: `${VALS_ORIGIN}/models/${sourceSlug}`, valsCatalog: model };
          details.modality = "speech-to-text";
          modelMeta.push({ modelLabel, labHint: labId, kind: "audio", identity, modelMetadata });
        }
        rows.push({
          benchmarkId: config.benchmarkId,
          modelLabel,
          sourceModelId: modelKey,
          identity,
          modelMetadata,
          effort: identity ? "none" : effort,
          value: accuracy,
          costUsd: isNum(row.cost_per_test) ? row.cost_per_test : undefined,
          durationSec: isNum(row.latency) ? row.latency : undefined,
          harness: typeof row.harness === "string" ? row.harness : undefined,
          labHint: typeof row.provider === "string" ? row.provider : typeof model?.company === "string" ? model.company : undefined,
          sourceUrl: url,
          details: Object.keys(details).length ? details : undefined,
          note: isNum(row.stderr) ? `published standard error ±${row.stderr}` : undefined,
        });
      }

      const benchmark: BenchmarkWithLastUpdated = {
        id: config.benchmarkId,
        name: config.name,
        shortName: config.shortName,
        sourceId: config.sourceId,
        url,
        description: config.description,
        unit: config.unit ?? "percent",
        higherIsBetter: config.higherIsBetter ?? true,
        category: config.category,
        versionPolicy: { kind: "fresh" },
        lastUpdated: updated,
        eligibleForDefault: config.eligibleForDefault ?? false,
        defaultWeight: config.defaultWeight ?? 0,
      };
      return {
        benchmarks: [benchmark],
        rows,
        raw: {
          "page.html": html,
          "overall.json": JSON.stringify(task, null, 2),
          "metadata.json": JSON.stringify(metadata, null, 2),
          "benchmark-view.js": catalog.componentSource,
          "model-catalog.js": catalog.source,
          "model-catalog-keys.json": JSON.stringify(Object.fromEntries(Object.entries(catalog.entries).filter(([key]) => usedCatalogKeys.has(key))), null, 2),
        },
        modelMeta,
        notes: [`${rows.length} overall rows; Vals updated ${updated}`, ...(modelListNote ? [modelListNote] : [])],
      };
    },
  };
}
