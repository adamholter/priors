/**
 * Artificial Analysis (https://artificialanalysis.ai)
 *
 * How the data is obtained (no public API):
 *  - Every AA page is a Next.js RSC page. Client components receive a `manifest: { path, key }` prop
 *    pointing at an encrypted blob under https://artificialanalysis.ai/data/<hash>.txt.
 *  - The blob is AES-256-GCM (key = the 32-byte hex `key`, IV = SHA-256(key)[0:12], 16-byte tag
 *    appended), and the plaintext is gzip -> JSON. This mirrors AA's own client decoder
 *    (webpack module 57455 in their chunks).
 *  - /models embeds two manifests: the model table (`{ models: [...] }`, ~640 model/variant rows with
 *    scores, price, speed, release date, creator, effort, Intelligence-Index run cost) and the
 *    per-host table (array of ~960 provider endpoints).
 *  - /evaluations/* all share one manifest (`{ models, fallbackPriceByModelSlug }`) that carries the
 *    full evaluation columns (incl. Elo CIs, per-eval breakdowns). We merge it with the model table by id.
 *  - The Intelligence Index version and its component list are read from the page text
 *    ("Artificial Analysis Intelligence Index v4.2 incorporates 10 evaluations: ...").
 */
import { createDecipheriv, createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import type { Benchmark, BenchmarkCategory, BenchmarkUnit, RawRow, ScrapeContext, ScrapeResult, Source } from "../../../src/data/types";

const ORIGIN = "https://artificialanalysis.ai";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;
interface Manifest { path: string; key: string }

/** Evaluation column -> benchmark definition. `slug` is AA's /evaluations/<slug> page (or a synthetic one). */
interface EvalDef {
  field: string;
  slug: string;
  name: string;
  unit: BenchmarkUnit;
  category: BenchmarkCategory;
  higherIsBetter?: boolean;
  /** multiply raw value by this (fractions -> percent) */
  scale?: number;
  description: string;
  ciFrom?: (m: Json) => [number, number] | undefined;
  defaultWeight?: number;
  eligibleForDefault?: boolean;
  /** Regex used to pick the display name out of the site nav (to keep versions like "GDPval-AA v2" current). */
  navName?: RegExp;
}

const ci95 = (key: string) => (m: Json): [number, number] | undefined => {
  const b = m[key];
  if (b && typeof b.lower95ci === "number" && typeof b.upper95ci === "number") return [b.lower95ci, b.upper95ci];
  return undefined;
};

const EVALS: EvalDef[] = [
  // ---- current Intelligence Index components
  { field: "briefcaseElo", slug: "aa-briefcase", name: "AA-Briefcase", unit: "elo", category: "agentic", description: "AA-Briefcase: agentic office-work tasks over real files (xlsx/pptx/docx/pdf) judged pairwise; reported as Elo.", ciFrom: ci95("briefcaseBreakdown"), defaultWeight: 10, eligibleForDefault: true },
  { field: "gdpval", slug: "gdpval-aa", name: "GDPval-AA v2", unit: "elo", category: "economics", description: "GDPval-AA: economically valuable knowledge-work tasks across occupations, graded pairwise by AA; reported as Elo.", ciFrom: ci95("gdpvalBreakdown"), defaultWeight: 10, eligibleForDefault: true, navName: /^GDPval-AA/ },
  { field: "tauBanking", slug: "tau3-banking", name: "τ³-Banking", unit: "percent", category: "agentic", scale: 100, description: "τ³-Bench banking domain: multi-turn tool-using agent tasks with a simulated user; pass rate.", defaultWeight: 10, eligibleForDefault: true },
  { field: "terminalbenchV21", slug: "terminalbench-v2-1", name: "Terminal-Bench v2.1", unit: "percent", category: "coding", scale: 100, description: "Terminal-Bench v2.1 run by AA: agentic command-line software engineering tasks; task pass rate.", defaultWeight: 10, eligibleForDefault: true, navName: /^Terminal-Bench v2\.1/ },
  { field: "scicode", slug: "scicode", name: "SciCode", unit: "percent", category: "coding", scale: 100, description: "SciCode: implementing scientific research code from paper descriptions; sub-problem accuracy.", defaultWeight: 5, eligibleForDefault: true },
  { field: "hle", slug: "humanitys-last-exam", name: "Humanity's Last Exam", unit: "percent", category: "reasoning", scale: 100, description: "Humanity's Last Exam: frontier expert-level questions across disciplines; accuracy.", defaultWeight: 10, eligibleForDefault: true },
  { field: "gdpPdfAllPass", slug: "gdp-pdf", name: "GDP.pdf", unit: "percent", category: "economics", scale: 100, description: "GDP.pdf: document-heavy professional tasks over PDFs graded against rubric criteria; share of tasks passing all criteria.", defaultWeight: 5, eligibleForDefault: true },
  { field: "critpt", slug: "critpt", name: "CritPt", unit: "percent", category: "reasoning", scale: 100, description: "CritPt: research-level physics reasoning problems; accuracy.", defaultWeight: 5, eligibleForDefault: true },
  { field: "omniscience", slug: "omniscience", name: "AA-Omniscience", unit: "score", category: "knowledge", description: "AA-Omniscience Index (-100..100): knowledge accuracy minus hallucination penalty on 6,000 questions across 42 topics.", defaultWeight: 5, eligibleForDefault: true },
  { field: "lcr", slug: "artificial-analysis-long-context-reasoning", name: "AA-LCR v1.1", unit: "percent", category: "long-context", scale: 100, description: "AA-LCR: long-context reasoning over ~100k-token document sets; pass rate.", defaultWeight: 5, eligibleForDefault: true, navName: /^AA-LCR/ },
  // ---- other evaluations AA publishes
  { field: "gpqa", slug: "gpqa-diamond", name: "GPQA Diamond", unit: "percent", category: "knowledge", scale: 100, description: "GPQA Diamond: graduate-level science multiple choice; accuracy.", defaultWeight: 0 },
  { field: "ifbench", slug: "ifbench", name: "IFBench", unit: "percent", category: "instruction", scale: 100, description: "IFBench: precise instruction-following with verifiable constraints; accuracy.", defaultWeight: 0 },
  { field: "terminalbenchHard", slug: "terminalbench-hard", name: "Terminal-Bench Hard", unit: "percent", category: "coding", scale: 100, description: "Terminal-Bench Hard (AA subset of Terminal-Bench 2.0): agentic terminal tasks; pass rate.", defaultWeight: 0 },
  { field: "tau2", slug: "tau2-bench", name: "τ²-Bench Telecom", unit: "percent", category: "agentic", scale: 100, description: "τ²-Bench telecom domain: dual-control tool-using agent tasks; pass rate.", defaultWeight: 0 },
  { field: "apexAgents", slug: "apex-agents-aa", name: "APEX-Agents-AA", unit: "percent", category: "agentic", scale: 100, description: "APEX-Agents-AA: long-horizon professional-services agent tasks; pass rate.", defaultWeight: 0 },
  { field: "itbenchSre", slug: "itbench-aa", name: "ITBench-AA", unit: "percent", category: "agentic", scale: 100, description: "ITBench-AA (SRE scenarios): diagnosing and remediating incidents in live Kubernetes environments; pass rate.", defaultWeight: 0 },
  { field: "analystAgent", slug: "aa-analyst-agent", name: "AA-AnalystAgent", unit: "percent", category: "agentic", scale: 100, description: "AA-AnalystAgent: multi-step financial/data analysis agent tasks; pass rate.", defaultWeight: 0 },
  { field: "automationBenchPartialScore", slug: "automationbench-aa", name: "AutomationBench-AA", unit: "percent", category: "agentic", scale: 100, description: "AutomationBench-AA: building workflow automations; partial-credit score.", defaultWeight: 0 },
  { field: "enterpriseOpsGym", slug: "enterprise-ops-gym-aa", name: "EnterpriseOps-Gym-AA", unit: "percent", category: "agentic", scale: 100, description: "EnterpriseOps-Gym-AA: multi-turn enterprise operations tasks over simulated business systems; success rate.", defaultWeight: 0 },
  { field: "harveyLab", slug: "harvey-lab-aa", name: "Harvey LAB-AA", unit: "percent", category: "knowledge", scale: 100, description: "Harvey LAB-AA: legal professional tasks graded by rubric; score.", defaultWeight: 0 },
  { field: "mlcrOverall", slug: "mlcr-aa", name: "MLCR-AA", unit: "percent", category: "long-context", scale: 100, description: "Medical Long Context Reasoning (MLCR-AA): reasoning over long medical records; overall score.", defaultWeight: 0 },
  { field: "mmmuPro", slug: "mmmu-pro", name: "MMMU-Pro", unit: "percent", category: "knowledge", scale: 100, description: "MMMU-Pro: multimodal college-level understanding; accuracy.", defaultWeight: 0 },
  { field: "livecodebench", slug: "livecodebench", name: "LiveCodeBench", unit: "percent", category: "coding", scale: 100, description: "LiveCodeBench: competitive programming problems; pass rate.", defaultWeight: 0 },
  { field: "aime25", slug: "aime-2025", name: "AIME 2025", unit: "percent", category: "math", scale: 100, description: "AIME 2025: competition math; accuracy.", defaultWeight: 0 },
  { field: "math500", slug: "math-500", name: "MATH-500", unit: "percent", category: "math", scale: 100, description: "MATH-500: competition math subset; accuracy.", defaultWeight: 0 },
  { field: "mmluPro", slug: "mmlu-pro", name: "MMLU-Pro", unit: "percent", category: "knowledge", scale: 100, description: "MMLU-Pro: broad knowledge multiple choice; accuracy.", defaultWeight: 0 },
  { field: "globalMmluLiteScore", slug: "global-mmlu-lite", name: "Global-MMLU-Lite", unit: "percent", category: "knowledge", scale: 100, description: "Global-MMLU-Lite: multilingual MMLU subset; accuracy.", defaultWeight: 0 },
  { field: "cweBench", slug: "cwe-bench", name: "CWE-Bench", unit: "percent", category: "safety", scale: 100, description: "CWE-Bench: security-weakness detection; score.", defaultWeight: 0 },
];

/** Benchmark id from AA eval slug; avoids "aa-aa-briefcase" for AA's own "aa-*" slugs. */
const bid = (slug: string) => `aa-${slug.replace(/^aa-/, "")}`;

// ---------------------------------------------------------------------------------------------
// payload plumbing

function findManifests(html: string): Manifest[] {
  const out = new Map<string, Manifest>();
  // RSC payload is JSON inside a JS string, so quotes are escaped: \"manifest\":{\"path\":\"/data/x.txt\",\"key\":\"abc\"}
  const re = /\\?"manifest\\?":\{\\?"path\\?":\\?"(\/data\/[a-f0-9]+\.txt)\\?",\\?"key\\?":\\?"([a-f0-9]{64})\\?"/g;
  for (const m of html.matchAll(re)) out.set(m[1], { path: m[1], key: m[2] });
  return [...out.values()];
}

async function fetchDecrypt(m: Manifest): Promise<{ json: Json; text: string }> {
  let last: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(ORIGIN + m.path, { headers: { "user-agent": UA, accept: "*/*" } });
      if (!res.ok) throw new Error(`${res.status} ${m.path}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const key = Buffer.from(m.key, "hex");
      const iv = createHash("sha256").update(key).digest().subarray(0, 12);
      const d = createDecipheriv("aes-256-gcm", key, iv);
      d.setAuthTag(buf.subarray(buf.length - 16));
      const pt = Buffer.concat([d.update(buf.subarray(0, buf.length - 16)), d.final()]);
      const text = gunzipSync(pt).toString("utf8");
      return { json: JSON.parse(text), text };
    } catch (e) { last = e; await new Promise((r) => setTimeout(r, 700 * (i + 1))); }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/<!--.*?-->/g, "");

// ---------------------------------------------------------------------------------------------

const source: Source = {
  id: "aa",
  name: "Artificial Analysis",
  url: `${ORIGIN}/models`,
  async scrape(ctx: ScrapeContext): Promise<ScrapeResult> {
    const raw: Record<string, string> = {};
    const notes: string[] = [];

    // 1. /models page: model table + host table manifests, II version text
    const modelsHtml = await ctx.fetchText(`${ORIGIN}/models`);
    raw["models.html"] = modelsHtml;
    // 2. Intelligence Index evaluation page: shared evaluations manifest
    const iiUrl = `${ORIGIN}/evaluations/artificial-analysis-intelligence-index`;
    const iiHtml = await ctx.fetchText(iiUrl);
    raw["evaluations-intelligence-index.html"] = iiHtml;

    const manifests = new Map<string, Manifest>();
    for (const m of [...findManifests(modelsHtml), ...findManifests(iiHtml)]) manifests.set(m.path, m);
    raw["manifests.json"] = JSON.stringify([...manifests.values()], null, 2);
    if (!manifests.size) throw new Error("no data manifests found in AA pages (site structure changed?)");
    ctx.log(`found ${manifests.size} data manifests`);

    let tableModels: Json[] | undefined; // /models table
    let hosts: Json[] | undefined; // per-provider endpoints
    let evalModels: Json[] | undefined; // /evaluations/* shared payload
    for (const m of manifests.values()) {
      const { json, text } = await fetchDecrypt(m);
      const name = m.path.replace(/^\/data\//, "").replace(/\.txt$/, "");
      const j = json as { models?: Json[] };
      if (Array.isArray(json) && json[0]?.hostId) { hosts = json; raw[`hosts-${name}.json`] = text; }
      else if (Array.isArray(j.models) && j.models[0] && "briefcaseElo" in j.models[0]) { evalModels = j.models; raw[`evaluations-${name}.json`] = text; }
      else if (Array.isArray(j.models) && j.models[0] && "intelligenceIndex" in j.models[0]) { tableModels = j.models; raw[`models-${name}.json`] = text; }
      else raw[`unknown-${name}.json`] = text;
    }
    if (!tableModels && !evalModels) throw new Error("decrypted AA payloads did not contain a model table");
    ctx.log(`table=${tableModels?.length ?? 0} evals=${evalModels?.length ?? 0} hosts=${hosts?.length ?? 0}`);
    if (!evalModels) notes.push("evaluations payload missing; scores come from /models table only");
    if (!tableModels) notes.push("/models table payload missing; no speed/price/cost");

    // Intelligence Index version + component list from page text
    const verM = (modelsHtml + iiHtml).match(/Intelligence Index v(\d+(?:\.\d+)?)/);
    const iiVersion = verM?.[1];
    if (!iiVersion) notes.push("could not read Intelligence Index version from page text");
    // e.g. "Intelligence Index v4.2 incorporates 10 evaluations: AA-Briefcase, GDPval-AA v2, ..., AA-LCR v1.1</span>"
    const compM = decode(modelsHtml + iiHtml).match(/Intelligence Index v[\d.]+ (?:incorporates|includes)[^:<]*:\s*([^<·]+?)(?:\.\s|<|·|$)/);
    const components = compM ? compM[1].split(/,\s*/).map((s) => s.trim().replace(/\.$/, "")).filter(Boolean) : [];
    if (components.length) notes.push(`II v${iiVersion} components: ${components.join(", ")}`);
    const iiId = iiVersion ? `aa-intelligence-index-v${iiVersion}` : "aa-intelligence-index";

    // Display names for evaluations from nav anchors (keeps versions current)
    const navNames = new Map<string, string>();
    for (const m of (modelsHtml + iiHtml).matchAll(/href="\/evaluations\/([a-z0-9-]+)"[^>]*>([^<]{1,80})</g)) {
      const nm = decode(m[2]).trim();
      if (nm && !navNames.has(m[1])) navNames.set(m[1], nm);
    }

    // ---- merge model records by id
    const byId = new Map<string, { ev?: Json; tbl?: Json }>();
    for (const m of evalModels ?? []) byId.set(m.id, { ev: m });
    for (const m of tableModels ?? []) byId.set(m.id, { ...(byId.get(m.id) ?? {}), tbl: m });

    const rows: RawRow[] = [];
    const modelMeta: NonNullable<ScrapeResult["modelMeta"]> = [];
    const counts = new Map<string, number>();
    const bump = (id: string) => counts.set(id, (counts.get(id) ?? 0) + 1);
    let skippedMedia = 0;

    for (const { ev, tbl } of byId.values()) {
      const base = ev ?? tbl!;
      // The /models table lists text LLMs only; still guard against non-text output models.
      if (tbl && tbl.outputModalityText === false) { skippedMedia++; continue; }
      const label: string = base.name ?? base.shortName;
      if (!label) continue;
      const slug: string = base.slug;
      const modelUrl = `${ORIGIN}/models/${slug}`;
      const effort: string | undefined = tbl?.effort?.slug ?? undefined;
      const labHint: string | undefined = base.creator?.name ?? tbl?.creator?.name;
      const releaseDateHint: string | undefined = base.releaseDate ?? tbl?.releaseDate ?? undefined;
      const deprecated = !!(base.deprecated ?? tbl?.deprecated);
      const noteBits = deprecated ? ["deprecated on AA"] : [];
      modelMeta.push({ modelLabel: label, labHint, releaseDateHint, kind: "llm" });
      const common = { modelLabel: label, effort, labHint, releaseDateHint };

      // Intelligence Index (+ measured run economics)
      const ii = base.intelligenceIndex ?? tbl?.intelligenceIndex;
      const runCost = tbl?.intelligenceIndexCost?.total;
      const perTask = tbl?.intelligenceIndexCostPerTask?.cost?.total;
      if (isNum(ii)) {
        const estimated = !!(base.intelligenceIndexIsEstimated ?? tbl?.intelligenceIndexIsEstimated);
        const n = [...noteBits, ...(estimated ? ["estimated by AA (not all component evals run)"] : [])];
        rows.push({
          ...common, benchmarkId: iiId, value: ii, sourceUrl: modelUrl,
          costUsd: isNum(runCost) ? runCost : undefined,
          outputTokens: isNum(tbl?.intelligenceIndexOutputTokensPerTask?.output) ? tbl!.intelligenceIndexOutputTokensPerTask.output : undefined,
          durationSec: isNum(tbl?.intelligenceIndexTimePerTask) ? tbl!.intelligenceIndexTimePerTask : undefined,
          note: n.length ? n.join("; ") : undefined,
        });
        bump(iiId);
      }
      if (isNum(runCost) && runCost > 0) { rows.push({ ...common, benchmarkId: "aa-cost-to-run-index", value: runCost, sourceUrl: modelUrl, note: noteBits[0] }); bump("aa-cost-to-run-index"); }
      if (isNum(perTask) && perTask > 0) { rows.push({ ...common, benchmarkId: "aa-cost-per-task-index", value: perTask, sourceUrl: modelUrl, note: noteBits[0] }); bump("aa-cost-per-task-index"); }

      // Individual evaluations
      for (const d of EVALS) {
        const v = base[d.field] ?? tbl?.[d.field];
        if (!isNum(v)) continue;
        const id = bid(d.slug);
        rows.push({
          ...common, benchmarkId: id, value: v * (d.scale ?? 1), sourceUrl: `${ORIGIN}/evaluations/${d.slug}`,
          ci: d.ciFrom?.(base) ?? (tbl ? d.ciFrom?.(tbl) : undefined), note: noteBits[0],
        });
        bump(id);
      }

      // Speed / latency (model-level median across providers, or first-party)
      const speed = tbl?.timescaleData?.medianOutputSpeed;
      const ttft = tbl?.timescaleData?.medianTimeToFirstChunk;
      const perfNote = tbl?.performanceDataSource?.type ? `performance source: ${tbl.performanceDataSource.type}` : undefined;
      if (isNum(speed) && speed > 0) { rows.push({ ...common, benchmarkId: "aa-output-speed", value: speed, sourceUrl: modelUrl, note: perfNote }); bump("aa-output-speed"); }
      if (isNum(ttft) && ttft > 0) { rows.push({ ...common, benchmarkId: "aa-ttft", value: ttft, sourceUrl: modelUrl, note: perfNote }); bump("aa-ttft"); }

      // Blended price (3:1 input:output), proxy
      const price = tbl?.price1mBlended0To3To1 ?? base.price1mBlended0To3To1;
      if (isNum(price) && price > 0) { rows.push({ ...common, benchmarkId: "aa-price-blended", value: price, sourceUrl: modelUrl }); bump("aa-price-blended"); }
    }
    if (skippedMedia) notes.push(`skipped ${skippedMedia} non-text-output models`);

    // ---- benchmark definitions (only those with data)
    const benchmarks: Benchmark[] = [];
    const have = (id: string) => (counts.get(id) ?? 0) > 0;
    if (have(iiId)) benchmarks.push({
      id: iiId, name: `AA Intelligence Index${iiVersion ? ` v${iiVersion}` : ""}`, shortName: `AA Index${iiVersion ? ` v${iiVersion}` : ""}`, sourceId: this.id,
      url: iiUrl,
      description: `Artificial Analysis' composite intelligence score${iiVersion ? ` (v${iiVersion})` : ""}${components.length ? `, combining ${components.length} evaluations: ${components.join(", ")}` : ""}.`,
      unit: "score", higherIsBetter: true, category: "composite", versionPolicy: { kind: "fresh" }, defaultWeight: 0, eligibleForDefault: false,
    });
    if (have("aa-cost-to-run-index")) benchmarks.push({
      id: "aa-cost-to-run-index", name: "Cost to Run AA Intelligence Index", shortName: "Cost to Run Index", sourceId: this.id, url: iiUrl,
      description: "Total USD AA spent running the full Intelligence Index evaluation suite for the model (measured input+output token cost, incl. reasoning), not list token price.",
      unit: "usd", higherIsBetter: false, category: "cost", defaultWeight: 0,
    });
    if (have("aa-cost-per-task-index")) benchmarks.push({
      id: "aa-cost-per-task-index", name: "AA Intelligence Index Cost per Task", shortName: "Cost / Task", sourceId: this.id, url: iiUrl,
      description: "Measured USD per task, weighted across the Intelligence Index evaluations.",
      unit: "usd", higherIsBetter: false, category: "cost", defaultWeight: 0,
    });
    for (const d of EVALS) {
      const id = bid(d.slug);
      if (!have(id)) continue;
      const nav = navNames.get(d.slug);
      const name = nav && (!d.navName || d.navName.test(nav)) && !/Hallucination|Accuracy|Rubric/.test(nav) ? nav : d.name;
      benchmarks.push({
        id, name, sourceId: this.id, url: `${ORIGIN}/evaluations/${d.slug}`, description: d.description,
        unit: d.unit, higherIsBetter: d.higherIsBetter ?? true, category: d.category,
        defaultWeight: d.defaultWeight ?? 0, eligibleForDefault: d.eligibleForDefault ?? false,
      });
    }
    if (have("aa-output-speed")) benchmarks.push({
      id: "aa-output-speed", name: "Output Speed (tokens/s)", shortName: "Output Speed", sourceId: this.id, url: `${ORIGIN}/models#speed`,
      description: "Median output tokens per second measured by AA (median across providers, or first-party API).",
      unit: "count", higherIsBetter: true, category: "speed", defaultWeight: 0,
    });
    if (have("aa-ttft")) benchmarks.push({
      id: "aa-ttft", name: "Latency (Time to First Answer Token)", shortName: "Latency", sourceId: this.id, url: `${ORIGIN}/models#latency`,
      description: "Median seconds from request to first answer token as measured by AA; includes reasoning time for reasoning models.",
      unit: "seconds", higherIsBetter: false, category: "speed", defaultWeight: 0,
    });
    if (have("aa-price-blended")) benchmarks.push({
      id: "aa-price-blended", name: "Blended Price (USD per 1M tokens, 3:1)", shortName: "Price", sourceId: this.id, url: `${ORIGIN}/models#pricing`,
      description: "List price per 1M tokens blended 3:1 input:output as tracked by AA. A proxy for cost, not a measured run cost.",
      unit: "usd", higherIsBetter: false, category: "cost", proxy: true, defaultWeight: 0,
    });

    notes.push(`benchmarks: ${[...counts.entries()].map(([k, v]) => `${k}=${v}`).join(", ")}`);
    return { benchmarks, rows, modelMeta, raw, notes };
  },
};

export default source;
