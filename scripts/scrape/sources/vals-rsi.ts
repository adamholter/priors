/**
 * VALS RSI Index uses a client-only static JavaScript score module. Parse its
 * data literals without evaluating publisher code, and retain all source files.
 */
import * as ts from "typescript";
import type { Benchmark, RawRow, ScrapeResult, Source } from "../../../src/data/types";

const SITE = "https://www.vals.ai";
const PAGE = `${SITE}/benchmarks/rsi_index`;
type Data = string | number | boolean | null | Data[] | { [key: string]: Data };
type Obj = Record<string, unknown>;

function propName(name: ts.PropertyName | undefined): string | undefined {
  return name && (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) ? name.text : undefined;
}
function parseJs(text: string, file: string): ts.SourceFile {
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  return ast;
}
/** Safe evaluator for the object, array, string, numeric, boolean, and null literals in VALS bundles. */
function readLiteral(node: ts.Expression): Data {
  if (ts.isParenthesizedExpression(node)) return readLiteral(node.expression);
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) {
    const value = Number(node.text);
    if (!Number.isFinite(value)) throw new Error("VALS RSI: non-finite number in static data");
    return value;
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) return !readLiteral(node.operand);
  if (ts.isArrayLiteralExpression(node)) return node.elements.map((entry) => {
    if (ts.isSpreadElement(entry)) throw new Error("VALS RSI: unsupported spread in static data");
    return readLiteral(entry);
  });
  if (ts.isObjectLiteralExpression(node)) {
    const value: Record<string, Data> = {};
    for (const item of node.properties) {
      if (!ts.isPropertyAssignment(item)) throw new Error("VALS RSI: unsupported static data property");
      const key = propName(item.name);
      if (key === undefined) throw new Error("VALS RSI: computed key in static data");
      value[key] = readLiteral(item.initializer);
    }
    return value;
  }
  throw new Error(`VALS RSI: unsupported data literal ${ts.SyntaxKind[node.kind] ?? "unknown"}`);
}
function binding(ast: ts.SourceFile, name: string): ts.Expression {
  for (const statement of ast.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const d of statement.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && d.name.text === name && d.initializer) return d.initializer;
    }
  }
  throw new Error(`VALS RSI: missing static ${name} data binding`);
}
function object(value: unknown): Obj | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Obj : undefined;
}
function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
/** The model catalog is the object literal keyed "provider/model"; the bundler renames its constant between deploys (`p`, `_`, ...). */
function catalogBinding(ast: ts.SourceFile): ts.Expression {
  for (const statement of ast.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const d of statement.declarationList.declarations) {
      const init = d.initializer;
      if (init && ts.isObjectLiteralExpression(init) && init.properties.some((p) => ts.isPropertyAssignment(p) && /^[^/]+\/[^/]+$/.test(propName(p.name) ?? ""))) return init;
    }
  }
  throw new Error("VALS RSI: model catalog binding missing");
}
function catalogModel(ast: ts.SourceFile, id: string): Obj | undefined {
  const root = catalogBinding(ast);
  if (!ts.isObjectLiteralExpression(root)) throw new Error("VALS RSI: model catalog is not a static object");
  const item = root.properties.find((p) => ts.isPropertyAssignment(p) && propName(p.name) === id);
  if (!item || !ts.isPropertyAssignment(item)) return undefined;
  return object(readLiteral(item.initializer));
}
function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function parseRsiData(dataJs: string, catalogJs: string, pageHtml: string): Pick<ScrapeResult, "benchmarks" | "rows" | "notes"> {
  const dataAst = parseJs(dataJs, "benchmark_view_rsi_index.js");
  const metadata = object(readLiteral(binding(dataAst, "e")));
  const tasks = object(readLiteral(binding(dataAst, "t")));
  if (!metadata || !tasks || metadata.benchmark !== "Vals RSI Index" || metadata.slug !== "rsi_index") {
    throw new Error("VALS RSI: static data module is not the RSI Index");
  }
  if (typeof metadata.version !== "string" || !metadata.version.trim() || !validDate(metadata.updated)) {
    throw new Error("VALS RSI: missing or invalid version/update date");
  }
  const modelIds = metadata.models;
  const labels = object(metadata.tasks);
  if (!Array.isArray(modelIds) || !modelIds.length || modelIds.some((id) => typeof id !== "string") || !labels || typeof labels.overall !== "string") {
    throw new Error("VALS RSI: model/task catalog missing or malformed");
  }
  if (new Set(modelIds).size !== modelIds.length || (typeof metadata.total_models === "number" && metadata.total_models !== modelIds.length)) {
    throw new Error("VALS RSI: model count does not match the published catalog");
  }

  const shownDate = pageHtml.match(/Updated\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (shownDate) {
    const rendered = `${shownDate[3]}-${shownDate[1].padStart(2, "0")}-${shownDate[2].padStart(2, "0")}`;
    if (rendered !== metadata.updated) throw new Error("VALS RSI: page and data module update dates differ");
  }

  const catalogAst = parseJs(catalogJs, "constants.js");
  const version = metadata.version.replace(/[^0-9a-z.]+/gi, "-");
  const overallId = `vals-rsi-index-v${version}`;
  const description = typeof metadata.description === "string" ? metadata.description : "Vals AI's Recursive Self-Improvement Index measures autonomous research on LLM development tasks.";
  const benchmarks: Benchmark[] = [];
  const rows: RawRow[] = [];
  const notes: string[] = [];
  for (const [taskKey, labelValue] of Object.entries(labels)) {
    if (typeof labelValue !== "string") continue;
    const label = labelValue;
    const scores = object(tasks[taskKey]);
    if (!scores || !Object.keys(scores).length) throw new Error(`VALS RSI: no score map for ${taskKey}`);
    const id = taskKey === "overall" ? overallId : `${overallId}-${slug(taskKey)}`;
    const taskRows: RawRow[] = [];
    benchmarks.push({
      id, name: taskKey === "overall" ? `Vals RSI Index v${version}` : `Vals RSI Index v${version}: ${label}`,
      shortName: taskKey === "overall" ? "RSI Index" : `RSI ${label}`,
      sourceId: "vals-rsi", url: PAGE,
      description: taskKey === "overall" ? `${description} Overall score in percentage points.` : `${description} Published ${label} score in percentage points.`,
      lastUpdated: metadata.updated, normalization: { kind: "linear", min: 0, max: 100 },
      unit: "percent", higherIsBetter: true, category: "composite",
      versionPolicy: { kind: "fresh" }, eligibleForDefault: false, defaultWeight: 0,
    });
    for (const [modelId, raw] of Object.entries(scores)) {
      if (!modelIds.includes(modelId)) throw new Error(`VALS RSI: uncatalogued model ${modelId} in ${taskKey}`);
      const metric = object(raw);
      if (!metric || typeof metric.accuracy !== "number" || !Number.isFinite(metric.accuracy) || metric.accuracy < 0 || metric.accuracy > 100) {
        throw new Error(`VALS RSI: invalid score for ${modelId} in ${taskKey}`);
      }
      const model = catalogModel(catalogAst, modelId);
      if (!model || typeof model.label !== "string" || !model.label.trim() || typeof model.company !== "string") {
        throw new Error(`VALS RSI: exact model display name missing for ${modelId}`);
      }
      taskRows.push({
        benchmarkId: id, modelLabel: model.label, sourceModelId: modelId, value: metric.accuracy,
        rank: taskRows.length + 1, sourceUrl: PAGE, labHint: model.company,
        releaseDateHint: typeof model.release_date === "string" ? model.release_date : undefined,
        details: { ...metric, taskKey, taskLabel: label, sourceModelId: modelId },
        note: `Vals AI RSI Index v${version}; ${label}; updated ${metadata.updated}`,
      });
    }
    if (taskKey === "overall" && taskRows.length !== modelIds.length) throw new Error("VALS RSI: overall score count does not match model catalog");
    rows.push(...taskRows);
    notes.push(`${label}: ${taskRows.length} models`);
  }
  if (!benchmarks.length || !rows.some((row) => row.benchmarkId === overallId)) throw new Error("VALS RSI: no overall results");
  return { benchmarks, rows, notes: [`v${version}, updated ${metadata.updated}`, ...notes] };
}

function componentPath(html: string): string {
  const match = html.match(/component-url="([^"]*RsiBenchmarkView[^"]*\.js)"/);
  if (!match) throw new Error("VALS RSI: client component not found in page");
  return match[1].replaceAll("&amp;", "&");
}
function asset(js: string, fragment: string): string {
  const imports = [...js.matchAll(/from["']([^"']+)["']/g)].map((m) => m[1]);
  const value = imports.find((p) => p.includes(fragment) && p.endsWith(".js"));
  if (!value?.startsWith("./")) throw new Error(`VALS RSI: imported ${fragment} asset not found`);
  return value;
}
function absoluteAsset(base: string, path: string): string {
  const url = new URL(path, `${SITE}${base}`);
  if (url.origin !== SITE) throw new Error("VALS RSI: unexpected asset origin");
  return url.href;
}

const source: Source = {
  id: "vals-rsi", name: "Vals RSI Index", url: PAGE,
  async scrape(ctx): Promise<ScrapeResult> {
    const pageHtml = await ctx.fetchText(PAGE);
    const component = componentPath(pageHtml);
    const componentJs = await ctx.fetchText(`${SITE}${component}`);
    const dataPath = asset(componentJs, "benchmark_view_rsi_index");
    const catalogPath = asset(componentJs, "constants.");
    const [dataJs, catalogJs] = await Promise.all([
      ctx.fetchText(absoluteAsset(component, dataPath)), ctx.fetchText(absoluteAsset(component, catalogPath)),
    ]);
    const result = parseRsiData(dataJs, catalogJs, pageHtml);
    return {
      ...result,
      raw: {
        "page.html": pageHtml,
        [component.split("/").pop() ?? "rsi-component.js"]: componentJs,
        [dataPath.slice(2)]: dataJs,
        [catalogPath.slice(2)]: catalogJs,
        "parsed.json": JSON.stringify(result),
      },
    };
  },
};
export default source;
