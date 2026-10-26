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

import { AA_V43_WEIGHTS } from "../../../src/data/aa-index";
import { resolveAAIdentity } from "../aa-identity";
import { pendingPreviews } from "../aa-preview";

const ORIGIN = "https://artificialanalysis.ai";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;
interface Manifest { path: string; key: string }

/** Evaluation column -> benchmark definition. `slug` is AA's /evaluations/<slug> page (or a synthetic one). */
interface EvalDef {
  field: string;
  id?: string;
  read?: (m: Json) => unknown;
  normalization?: Benchmark["normalization"];
  breakdown?: string;
  harness?: string;
  slug: string;
  /** Live /evaluations/<page> slug when AA has renamed the page; `slug` stays the benchmark id stem. */
  page?: string;
  name: string;
  unit: BenchmarkUnit;
  category: BenchmarkCategory;
  higherIsBetter?: boolean;
  /** multiply raw value by this (fractions -> percent) */
  scale?: number;
  description: string;
  ciFrom?: (m: Json) => [number, number] | undefined;
  /** Regex used to pick the display name out of the site nav (to keep versions like "GDPval-AA v2" current). */
  navName?: RegExp;
}

const ci95 = (key: string) => (m: Json): [number, number] | undefined => {
  const b = m[key];
  if (b && typeof b.lower95ci === "number" && typeof b.upper95ci === "number") return [b.lower95ci, b.upper95ci];
  return undefined;
};

/** AA's `omniscienceBreakdown.byDomain` keys, the id stem Priors uses, and the label. */
const OMNISCIENCE_DOMAINS: [key: string, id: string, label: string][] = [
  ["Software Engineering (SWE)", "software-engineering", "Software Engineering"],
  ["Humanities & Social Sciences", "humanities", "Humanities & Social Sciences"],
  ["Law", "law", "Law"],
  ["Science, Engineering & Mathematics", "science", "Science, Engineering & Math"],
  ["Business", "business", "Business"],
  ["Health", "health", "Health"],
];

const EVALS: EvalDef[] = [
  // ---- current Intelligence Index components
  { field: "briefcaseElo", normalization: { kind: "linear", min: 500, max: 2500 }, breakdown: "briefcaseBreakdown", harness: "Stirrup", slug: "aa-briefcase", name: "AA-Briefcase", unit: "elo", category: "agentic", description: "AA-Briefcase: agentic office-work tasks over real files (xlsx/pptx/docx/pdf) judged pairwise; reported as Elo.", ciFrom: ci95("briefcaseBreakdown") },
  { field: "gdpval", normalization: { kind: "linear", min: 500, max: 2500 }, breakdown: "gdpvalBreakdown", harness: "Stirrup", slug: "gdpval-aa", name: "GDPval-AA v2", unit: "elo", category: "economics", description: "GDPval-AA: economically valuable knowledge-work tasks across occupations, graded pairwise by AA; reported as Elo.", ciFrom: ci95("gdpvalBreakdown"), navName: /^GDPval-AA/ },
  { field: "tauBanking", slug: "tau3-banking", name: "τ³-Banking", unit: "percent", category: "agentic", scale: 100, description: "τ³-Bench banking domain: multi-turn tool-using agent tasks with a simulated user; pass rate." },
  { field: "terminalBench21", read: (m) => m.terminalBench21 ?? m.terminalbenchV21, slug: "terminalbench-v2-1", page: "terminalbench-2-1", name: "Terminal-Bench v2.1-AA", unit: "percent", category: "coding", scale: 100, description: "Terminal-Bench v2.1 run by AA: agentic command-line software engineering tasks; task pass rate.", navName: /^Terminal-Bench v2\.1/ },
  { field: "scicode", slug: "scicode", name: "SciCode", unit: "percent", category: "coding", scale: 100, description: "SciCode: implementing scientific research code from paper descriptions; sub-problem accuracy." },
  { field: "hle", slug: "humanitys-last-exam", name: "Humanity's Last Exam", unit: "percent", category: "reasoning", scale: 100, description: "Humanity's Last Exam: frontier expert-level questions across disciplines; accuracy." },
  { field: "gdpPdfAllPass", slug: "gdp-pdf", name: "GDP.pdf", unit: "percent", category: "economics", scale: 100, description: "GDP.pdf: document-heavy professional tasks over PDFs graded against rubric criteria; share of tasks passing all criteria." },
  { field: "critpt", slug: "critpt", name: "CritPt", unit: "percent", category: "reasoning", scale: 100, description: "CritPt: research-level physics reasoning problems; accuracy." },
  { field: "omniscience", slug: "omniscience", name: "AA-Omniscience", unit: "score", category: "knowledge", description: "AA-Omniscience Index (-100..100): knowledge accuracy minus hallucination penalty on 6,000 questions across 42 topics." },
  { field: "lcr", slug: "artificial-analysis-long-context-reasoning", name: "AA-LCR v1.1", unit: "percent", category: "long-context", scale: 100, description: "AA-LCR: long-context reasoning over ~100k-token document sets; pass rate.", navName: /^AA-LCR/ },
  { field: "terminalBench40", read: (m) => m.terminalBench40 ?? m.terminalbenchV40, slug: "terminalbench-v4-0", page: "terminalbench-4-0", name: "Terminal-Bench v4-AA", unit: "percent", category: "coding", scale: 100, harness: "mini-SWE-agent", description: "AA's 66-task Terminal-Bench v4.0, three repeats, average pass@1. Distinct from the upstream leaderboard and v2.1." },
  { field: "terminalBenchScience", slug: "terminalbench-science", page: "terminal-bench-science", name: "Terminal-Bench Science-AA", unit: "percent", category: "coding", scale: 100, description: "Terminal-Bench Science (AA): scientific-computing terminal tasks; pass rate." },
  { field: "omniscienceBreakdown", id: "aa-omniscience-accuracy", read: (m) => m.omniscienceBreakdown?.accuracy, slug: "omniscience", name: "AA-Omniscience Accuracy", unit: "percent", category: "knowledge", scale: 100, description: "Correct answers divided by all questions. AA v4.3 gives this component 10%." },
  { field: "omniscienceBreakdown", id: "aa-omniscience-non-hallucination", read: (m) => isNum(m.omniscienceBreakdown?.hallucinationRate) ? 1 - m.omniscienceBreakdown.hallucinationRate : undefined, slug: "omniscience", name: "AA-Omniscience Non-hallucination", unit: "percent", category: "knowledge", scale: 100, description: "One minus AA's hallucination rate. AA v4.3 gives this component 5%; it is not the combined Omniscience Index." },
  // ---- AA-Omniscience Index cut by domain (same -100..100 scale; wrong answers cost as much as right ones earn)
  ...OMNISCIENCE_DOMAINS.map(([key, id, label]): EvalDef => ({
    field: "omniscienceBreakdown", id: `aa-omniscience-${id}`, slug: `omniscience-${id}`, page: "omniscience", read: (m) => m.omniscienceBreakdown?.byDomain?.[key],
    normalization: { kind: "linear", min: -100, max: 100 }, name: `AA-Omniscience ${label}`, unit: "score", category: "knowledge",
    description: `AA-Omniscience Index (-100..100) on the ${label} questions only: right answers minus made-up ones, abstaining scores 0.`,
  })),
  // ---- other evaluations AA publishes
  { field: "gpqa", slug: "gpqa-diamond", name: "GPQA Diamond", unit: "percent", category: "knowledge", scale: 100, description: "GPQA Diamond: graduate-level science multiple choice; accuracy." },
  { field: "ifbench", slug: "ifbench", name: "IFBench", unit: "percent", category: "instruction", scale: 100, description: "IFBench: precise instruction-following with verifiable constraints; accuracy." },
  { field: "terminalbenchHard", slug: "terminalbench-hard", name: "Terminal-Bench Hard-AA", unit: "percent", category: "coding", scale: 100, description: "Terminal-Bench Hard (AA subset of Terminal-Bench 2.0): agentic terminal tasks; pass rate." },
  { field: "tau2", slug: "tau2-bench", name: "τ²-Bench Telecom", unit: "percent", category: "agentic", scale: 100, description: "τ²-Bench telecom domain: dual-control tool-using agent tasks; pass rate." },
  { field: "apexAgents", slug: "apex-agents-aa", name: "APEX-Agents-AA", unit: "percent", category: "agentic", scale: 100, description: "APEX-Agents-AA: long-horizon professional-services agent tasks; pass rate." },
  { field: "itbenchSre", slug: "itbench-aa", name: "ITBench-AA", unit: "percent", category: "agentic", scale: 100, description: "ITBench-AA (SRE scenarios): diagnosing and remediating incidents in live Kubernetes environments; pass rate." },
  { field: "analystAgent", slug: "aa-analyst-agent", name: "AA-AnalystAgent", unit: "percent", category: "agentic", scale: 100, description: "AA-AnalystAgent: multi-step financial/data analysis agent tasks; pass rate." },
  { field: "automationBenchPartialScore", breakdown: "automationBenchBreakdown", slug: "automationbench-aa", name: "AutomationBench-AA", unit: "percent", category: "agentic", scale: 100, description: "AutomationBench-AA: building workflow automations; partial-credit score." },
  { field: "enterpriseOpsGym", slug: "enterprise-ops-gym-aa", name: "EnterpriseOps-Gym-AA", unit: "percent", category: "agentic", scale: 100, description: "EnterpriseOps-Gym-AA: multi-turn enterprise operations tasks over simulated business systems; success rate." },
  { field: "harveyLab", breakdown: "harveyLabBreakdown", slug: "harvey-lab-aa", name: "Harvey LAB-AA", unit: "percent", category: "knowledge", scale: 100, description: "Harvey LAB-AA v1.1: 120 private agentic legal tasks built by Harvey. Hallucination-Gated All-Pass Rate: a task counts only when a three-judge panel passes every rubric criterion and the deliverables contain no material hallucination. Not comparable with v1.0 scores." },
  { field: "mlcrOverall", slug: "mlcr-aa", name: "MLCR-AA", unit: "percent", category: "long-context", scale: 100, description: "Medical Long Context Reasoning (MLCR-AA): reasoning over long medical records; overall score." },
  { field: "mmmuPro", slug: "mmmu-pro", name: "MMMU-Pro", unit: "percent", category: "knowledge", scale: 100, description: "MMMU-Pro: multimodal college-level understanding; accuracy." },
  { field: "livecodebench", slug: "livecodebench", name: "LiveCodeBench", unit: "percent", category: "coding", scale: 100, description: "LiveCodeBench: competitive programming problems; pass rate." },
  { field: "aime25", slug: "aime-2025", name: "AIME 2025", unit: "percent", category: "math", scale: 100, description: "AIME 2025: competition math; accuracy." },
  { field: "math500", slug: "math-500", name: "MATH-500", unit: "percent", category: "math", scale: 100, description: "MATH-500: competition math subset; accuracy." },
  { field: "mmluPro", slug: "mmlu-pro", name: "MMLU-Pro", unit: "percent", category: "knowledge", scale: 100, description: "MMLU-Pro: broad knowledge multiple choice; accuracy." },
  { field: "globalMmluLiteScore", slug: "global-mmlu-lite", name: "Global-MMLU-Lite", unit: "percent", category: "knowledge", scale: 100, description: "Global-MMLU-Lite: multilingual MMLU subset; accuracy." },
  { field: "cweBench", slug: "cwe-bench", name: "CWE-Bench", unit: "percent", category: "safety", scale: 100, description: "CWE-Bench: security-weakness detection; score." },
  { field: "aa3dElo", breakdown: "aa3dBreakdown", harness: "Stirrup", slug: "aa-3d", name: "AA-3D", unit: "elo", category: "creative", description: "AA-3D: agents in an offline sandbox turn a written brief into an interactive three.js scene; Elo from blind pairwise votes by AA's recruited panel.", ciFrom: ci95("aa3dCi") },
  { field: "frontierCode", harness: "Stirrup", slug: "frontiercode", name: "FrontierCode 1.1-AA", unit: "percent", category: "coding", scale: 100, description: "AA's run of Cognition's FrontierCode 1.1 Main (100 private tasks, three attempts each, 250-turn cap): would a repository's maintainers merge the change? Mean score; an attempt failing a blocking check scores 0. Separate from Cognition's own leaderboard, which uses different harnesses.", navName: /-AA$/ },
  // ---- Artificial Analysis Cyber Index (equal-weight mean of CWE-Bench-AA, DeepsecBench-AA, CyberGym-E2E-AA)
  { field: "cyberIndex", id: "aa-cyber-index", normalization: { kind: "linear", min: 0, max: 100 }, slug: "artificial-analysis-cyber-index", name: "AA Cyber Index", unit: "score", category: "safety", description: "Artificial Analysis Cyber Index: cyber defense in real repositories (find, reproduce and patch vulnerabilities), the equal-weight mean of CWE-Bench-AA, DeepsecBench-AA and CyberGym-E2E-AA. Safety refusals score zero. Includes trusted-access models that are not publicly available." },
  { field: "deepsecBench", id: "aa-deepsec-bench", slug: "artificial-analysis-cyber-index", name: "DeepsecBench-AA", unit: "percent", category: "safety", scale: 100, description: "DeepsecBench-AA (based on Vercel's DeepsecBench), part of the AA Cyber Index: finding and fixing vulnerabilities in real codebases; score." },
  { field: "cybergymE2e", id: "aa-cybergym-e2e", slug: "artificial-analysis-cyber-index", name: "CyberGym-E2E-AA", unit: "percent", category: "safety", scale: 100, description: "CyberGym-E2E-AA (based on Berkeley RDI's CyberGym-E2E), part of the AA Cyber Index: end-to-end vulnerability reproduction and patching; score. The component with the most safety refusals." },
  { field: "cweBenchRefusalRate", id: "aa-cwe-bench-refusal-rate", slug: "artificial-analysis-cyber-index", name: "CWE-Bench-AA Refusal Rate", unit: "percent", category: "safety", scale: 100, higherIsBetter: false, description: "Share of CWE-Bench-AA tasks the model refused on safety grounds. Lower means fewer refusals on defensive security work." },
  { field: "deepsecBenchRefusalRate", id: "aa-deepsec-bench-refusal-rate", slug: "artificial-analysis-cyber-index", name: "DeepsecBench-AA Refusal Rate", unit: "percent", category: "safety", scale: 100, higherIsBetter: false, description: "Share of DeepsecBench-AA tasks the model refused on safety grounds. Lower means fewer refusals on defensive security work." },
  { field: "cybergymE2eRefusalRate", id: "aa-cybergym-e2e-refusal-rate", slug: "artificial-analysis-cyber-index", name: "CyberGym-E2E-AA Refusal Rate", unit: "percent", category: "safety", scale: 100, higherIsBetter: false, description: "Share of CyberGym-E2E-AA tasks the model refused on safety grounds. Lower means fewer refusals on defensive security work." },
  { field: "opennessIndex", breakdown: "opennessBreakdown", id: "aa-openness-index", normalization: { kind: "linear", min: 0, max: 100 }, slug: "artificial-analysis-openness-index", name: "AA Openness Index", unit: "score", category: "other", description: "Artificial Analysis Openness Index (0 to 100): how open a model is, from weight availability and license to transparency about training data and methodology. Not a capability measure." },
];

/** Numeric per-model fields that are metadata or sub-metrics of a mapped evaluation, not benchmarks. */
const NON_BENCHMARK_FIELDS = new Set([
  "intelligenceIndex", "price1mInputTokens", "price1mOutputTokens", "price1mBlended0To3To1", "cacheHitPrice", "cacheWritePrice", "cacheHitRate",
  "parameters", "activeParams", "inferenceParametersActiveBillions", "contextWindowTokens", "medianCanonicalAnswerOutputSpeed",
  "mlcrAccuracy", "mlcrCompleteness", "mlcrConciseness", "analystAgentPassAt1", "analystAgentPassAtK",
  "enterpriseOpsGymAvgConversationTurns", "itbenchAvgTurnsPerTask",
]);
/** AA pages and articles deliberately left out of Priors. Anything else new is announced (see `discoveries`). */
const IGNORED_PAGES = new Set([
  "artificial-analysis-intelligence-index", // read separately as the composite
  "artificial-analysis-decision-index", // ranks single-call "decision models", not chat models
  "aa-personalitybench", // scraped by sources/aa-personality.ts
]);
const IGNORED_ARTICLES = new Set([
  "artificial-analysis-decision-index",
  "aa-agentperf-local", // local inference hardware, not models
  "aa-robotics", // scraped by sources/aa-robotics.ts
  "trusted-access-models-cyber-index", // covered by aa-cyber-index
]);

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
      const res = await fetch(ORIGIN + m.path, { signal: AbortSignal.timeout(60_000), headers: { "user-agent": UA, accept: "*/*" } });
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

/** Concatenated RSC payload of a Next.js page (the `self.__next_f.push([1,"..."])` strings). */
function rscText(html: string): string {
  let out = "";
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)) {
    try { out += JSON.parse(`"${m[1]}"`); } catch { /* skip a malformed chunk */ }
  }
  return out;
}

/** JSON arrays of objects embedded in an RSC payload under `"<key>":[{...`. */
function rscArrays(rsc: string, key: string): Json[][] {
  const out: Json[][] = [];
  for (const m of rsc.matchAll(new RegExp(`"${key}":\\[\\{`, "g"))) {
    const start = m.index! + m[0].length - 2;
    let depth = 0, inStr = false;
    for (let i = start; i < rsc.length; i++) {
      const c = rsc[i];
      if (inStr) { if (c === "\\") i++; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true;
      else if (c === "[" || c === "{") depth++;
      else if ((c === "]" || c === "}") && --depth === 0) {
        try { const a = JSON.parse(rsc.slice(start, i + 1)); if (Array.isArray(a)) out.push(a); } catch { /* not plain JSON */ }
        break;
      }
    }
  }
  return out;
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

    // Discover evaluation pages from the live benchmark navigation. Deduplicate their shared
    // data manifests: many pages reference the same full table, not a chart's selected subset.
    const evaluationSlugs = [...new Set([...`${modelsHtml}${iiHtml}`.matchAll(/href="\/evaluations\/([a-z0-9-]+)"/g)].map((m) => m[1]))];
    const pageHtml = new Map<string, string>([[iiUrl, iiHtml]]);
    const queue = evaluationSlugs.filter((slug) => slug !== "artificial-analysis-intelligence-index");
    const pageFailures: string[] = [];
    await Promise.all(Array.from({ length: 4 }, async () => {
      for (let slug = queue.shift(); slug; slug = queue.shift()) {
        const url = `${ORIGIN}/evaluations/${slug}`;
        try {
          const html = await ctx.fetchText(url);
          pageHtml.set(url, html);
          raw[`evaluation-${slug}.html`] = html;
        } catch { pageFailures.push(url); }
      }
    }));
    raw["methodology.html"] = await ctx.fetchText(`${ORIGIN}/methodology/intelligence-benchmarking`);
    raw["index-v4.3-announcement.html"] = await ctx.fetchText(`${ORIGIN}/articles/artificial-analysis-intelligence-index-v4-3`);
    raw["evaluation-pages.json"] = JSON.stringify({ urls: [...pageHtml.keys()], failures: pageFailures });
    if (pageFailures.length) notes.push(`evaluation page failures: ${pageFailures.join(", ")}`);
    const manifests = new Map<string, Manifest>();
    for (const html of [modelsHtml, ...pageHtml.values()]) for (const m of findManifests(html)) manifests.set(m.path, m);
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
      else if (Array.isArray(j.models) && j.models.some((m) => "canonicalEvalTokenCounts" in m)) { evalModels = [...new Map([...(evalModels ?? []), ...j.models].map((m) => [m.id, m])).values()]; raw[`evaluations-${name}.json`] = text; }
      else if (Array.isArray(j.models) && j.models.some((m) => "timescaleData" in m)) { tableModels = [...new Map([...(tableModels ?? []), ...j.models].map((m) => [m.id, m])).values()]; raw[`models-${name}.json`] = text; }
      else raw[`unknown-${name}.json`] = text;
    }
    if (!tableModels?.length || !evalModels?.length) throw new Error("AA full model/evaluation table missing; refusing to replace the previous snapshot with incomplete coverage");

    // Some evaluation pages (AA-3D) render from inline `initialModels` records instead of the shared
    // manifest, and those records carry fields the manifest lacks. Fill gaps by model id; never overwrite.
    const evalById = new Map(evalModels.map((m) => [m.id, m]));
    for (const [url, html] of pageHtml) {
      const rsc = rscText(html);
      for (const arr of rscArrays(rsc, "initialModels")) for (const rec of arr) {
        const target = rec?.id && evalById.get(rec.id);
        if (!target) continue;
        for (const [k, v] of Object.entries(rec)) if (target[k] == null && v != null) target[k] = v;
      }
      // AA-3D's Elo chart rows carry the confidence interval.
      if (url.endsWith("/evaluations/aa-3d")) for (const arr of rscArrays(rsc, "models")) for (const rec of arr) {
        const target = rec?.id && evalById.get(rec.id);
        if (target && isNum(rec.elo) && isNum(rec.lower95ci) && isNum(rec.upper95ci) && rec.elo === target.aa3dElo) target.aa3dCi = { lower95ci: rec.lower95ci, upper95ci: rec.upper95ci };
      }
    }

    // Anything AA publishes that Priors does not read yet. Announced, never fatal.
    const discoveries: string[] = [];
    const mappedFields = new Set(EVALS.map((d) => d.field));
    const mappedSlugs = new Set(EVALS.flatMap((d) => [d.slug, d.page ?? d.slug]));
    for (const slug of evaluationSlugs) if (!mappedSlugs.has(slug) && !IGNORED_PAGES.has(slug)) discoveries.push(`AA evaluation page ${ORIGIN}/evaluations/${slug}`);
    const fieldCounts = new Map<string, number>();
    for (const m of evalModels) for (const [k, v] of Object.entries(m)) if (isNum(v) && !mappedFields.has(k) && !NON_BENCHMARK_FIELDS.has(k) && !/RefusalRate$/.test(k)) fieldCounts.set(k, (fieldCounts.get(k) ?? 0) + 1);
    for (const [k, n] of fieldCounts) discoveries.push(`AA data field "${k}" (${n} models)`);
    try {
      const articlesHtml = await ctx.fetchText(`${ORIGIN}/articles`);
      raw["articles.html"] = articlesHtml;
      for (const m of articlesHtml.matchAll(/href="\/articles\/([a-z0-9-]+)".*?<h3[^>]*>([^<]+)<\/h3>/g)) {
        const [slug, title] = [m[1], decode(m[2])];
        if (IGNORED_ARTICLES.has(slug) || [...mappedSlugs].some((s) => slug.includes(s))) continue;
        if (/\b(introduc|announc|launch)/i.test(title) && /bench|index|arena|leaderboard|\bAA-|evaluation/i.test(title)) discoveries.push(`AA article "${title}" ${ORIGIN}/articles/${slug}`);
      }
    } catch { notes.push("articles page unavailable; skipped new-benchmark check for articles"); }
    ctx.log(`table=${tableModels?.length ?? 0} evals=${evalModels?.length ?? 0} hosts=${hosts?.length ?? 0}`);
    if (!evalModels) notes.push("evaluations payload missing; scores come from /models table only");
    if (!tableModels) notes.push("/models table payload missing; no speed/price/cost");

    // Intelligence Index version + component list from page text
    const verM = (modelsHtml + iiHtml).match(/Intelligence Index v(\d+(?:\.\d+)*)/);
    const iiVersion = verM?.[1];
    if (!/^4\.3(?:\.\d+)?$/.test(iiVersion ?? "")) throw new Error(`AA index version ${iiVersion ?? "unknown"} needs a reviewed component/normalization map; preserving the previous snapshot`);
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

    // Results AA has announced but not listed yet; none are added once AA lists the model.
    const previews = pendingPreviews([...byId.values()].flatMap((x) => [x.ev, x.tbl]).filter((x): x is Json => !!x));
    for (const p of previews) byId.set(p.id, { ev: p.ev, tbl: p.tbl });
    if (previews.length) notes.push(`${previews.length} announced-but-unlisted AA rows from aa-preview.ts`);

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
      const noteBits = [...(deprecated ? ["deprecated on AA"] : []), ...(typeof base.previewNote === "string" ? [base.previewNote] : [])];

      const identity = resolveAAIdentity(base, tbl);
      const modelMetadata = Object.fromEntries(Object.entries({ ...tbl, ...base }).filter(([key]) => ["release", "creator", "releaseDate", "knowledgeCutoffDate", "isReasoning", "reasoningTokens", "effort", "deprecated", "deprecatedTo", "isOpenWeights", "openSourceCategorization", "parameters", "activeParams", "inferenceParametersActiveBillions", "sizeClass", "contextWindowTokens", "licenseName", "licenseUrl", "modelWeightsSourceUrl", "inputModalityText", "inputModalityImage", "inputModalitySpeech", "inputModalityVideo", "outputModalityText", "price1mInputTokens", "price1mOutputTokens", "cacheHitPrice", "cacheWritePrice", "performanceDataSource"].includes(key)));
      const common = { modelLabel: label, effort: identity.effort ?? effort, identity, modelMetadata, sourceModelId: base.id, labHint, releaseDateHint };
      modelMeta.push({ modelLabel: label, labHint, releaseDateHint, kind: "llm", identity, modelMetadata });

      // Intelligence Index (+ measured run economics)
      const ii = base.intelligenceIndex ?? tbl?.intelligenceIndex;
      const runCost = tbl?.intelligenceIndexCost?.total;
      const perTask = tbl?.intelligenceIndexCostPerTask?.cost?.total;
      if (isNum(ii)) {
        const estimated = !!(base.intelligenceIndexIsEstimated ?? tbl?.intelligenceIndexIsEstimated);
        const n = [...noteBits, ...(estimated ? ["estimated by AA (not all component evals run)"] : [])];
        rows.push({
          ...common, benchmarkId: iiId, value: ii, sourceUrl: modelUrl,
          costUsd: isNum(perTask) ? perTask : undefined,
          details: { costToRunIndex: runCost, costPerTask: tbl?.intelligenceIndexCostPerTask, outputTokensPerTask: tbl?.intelligenceIndexOutputTokensPerTask, estimatedByAA: estimated, estimatedDecodeSecondsPerTask: tbl?.intelligenceIndexTimePerTask },
          outputTokens: isNum(tbl?.intelligenceIndexOutputTokensPerTask?.output) ? tbl!.intelligenceIndexOutputTokensPerTask.output : undefined,
          
          note: n.length ? n.join("; ") : undefined,
        });
        bump(iiId);
      }
      if (isNum(runCost) && runCost > 0) { rows.push({ ...common, benchmarkId: "aa-cost-to-run-index", value: runCost, sourceUrl: modelUrl, note: noteBits[0] }); bump("aa-cost-to-run-index"); }
      if (isNum(perTask) && perTask > 0) { rows.push({ ...common, benchmarkId: "aa-cost-per-task-index", value: perTask, sourceUrl: modelUrl, note: noteBits[0] }); bump("aa-cost-per-task-index"); }

      // Individual evaluations
      for (const d of EVALS) {
        const v = d.read ? (d.read(base) ?? (tbl ? d.read(tbl) : undefined)) : base[d.field] ?? tbl?.[d.field];
        if (!isNum(v)) continue;
        const id = d.id ?? bid(d.slug);
        const costWeight = d.slug === "omniscience" ? 15 : AA_V43_WEIGHTS[id];
        const contribution = tbl?.intelligenceIndexCostPerTask?.evaluations?.find((e: Json) => e.slug === d.slug)?.weightedCostPerTask;
        rows.push({
          ...common, benchmarkId: id, value: v * (d.scale ?? 1),
          costUsd: costWeight && isNum(contribution) ? contribution / (costWeight / 100) : undefined, sourceUrl: `${ORIGIN}/evaluations/${d.page ?? d.slug}`,
          ci: d.ciFrom?.(base) ?? (tbl ? d.ciFrom?.(tbl) : undefined), note: noteBits[0], harness: d.harness,
          details: { field: d.field, ...(d.breakdown ? { breakdown: base[d.breakdown] ?? tbl?.[d.breakdown] } : {}), canonicalTokenCounts: base.canonicalEvalTokenCounts?.[d.field] },
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
      normalization: { kind: "linear", min: 0, max: 100 }, unit: "score", higherIsBetter: true, category: "composite", versionPolicy: { kind: "fresh" }, defaultWeight: 0, eligibleForDefault: false,
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
      const id = d.id ?? bid(d.slug);
      if (!have(id)) continue;
      const nav = navNames.get(d.slug);
      const name = !d.id && nav && (!d.navName || d.navName.test(nav)) && !/Hallucination|Accuracy|Rubric/.test(nav) ? nav : d.name;
      benchmarks.push({
        id, name, sourceId: this.id, url: `${ORIGIN}/evaluations/${d.page ?? d.slug}`, description: d.description,
        normalization: d.normalization, unit: d.unit, higherIsBetter: d.higherIsBetter ?? true, category: d.category,
        defaultWeight: AA_V43_WEIGHTS[id] ?? 0, eligibleForDefault: id in AA_V43_WEIGHTS,
        ...(id === "aa-terminalbench-v4-0" ? { versionPolicy: { kind: "fresh" as const, supersedes: "aa-terminalbench-v2-1" } } : {}),
      });
    }
    if (have("aa-output-speed")) benchmarks.push({
      id: "aa-output-speed", name: "Output Speed (tokens/s)", shortName: "Output Speed", sourceId: this.id, url: `${ORIGIN}/models#speed`,
      description: "Median output tokens per second measured by AA (median across providers, or first-party API).",
      unit: "count", higherIsBetter: true, category: "speed", defaultWeight: 0,
    });
    if (have("aa-ttft")) benchmarks.push({
      id: "aa-ttft", name: "Latency (Time to First Token)", shortName: "Latency", sourceId: this.id, url: `${ORIGIN}/models#latency`,
      description: "Median seconds from request to first streamed chunk as measured by AA; may be a reasoning token. This is not time to first answer.",
      unit: "seconds", higherIsBetter: false, category: "speed", defaultWeight: 0,
    });
    if (have("aa-price-blended")) benchmarks.push({
      id: "aa-price-blended", name: "Blended Price (USD per 1M tokens, 3:1)", shortName: "Price", sourceId: this.id, url: `${ORIGIN}/models#pricing`,
      description: "List price per 1M tokens blended 3:1 input:output as tracked by AA. A proxy for cost, not a measured run cost.",
      unit: "usd", higherIsBetter: false, category: "cost", proxy: true, defaultWeight: 0,
    });

    const missingComponents = Object.keys(AA_V43_WEIGHTS).filter((id) => !have(id));
    if (iiVersion?.startsWith("4.3") && missingComponents.length) throw new Error(`AA v${iiVersion} components missing: ${missingComponents.join(", ")}`);
    const identities = modelMeta.map((m) => m.identity!);
    const seenVariants = new Map<string, string>();
    for (const identity of identities) {
      const previous = seenVariants.get(identity.variantId);
      if (previous && previous !== identity.sourceModelId) throw new Error(`AA identity collision: ${previous} and ${identity.sourceModelId} -> ${identity.variantId}`);
      seenVariants.set(identity.variantId, identity.sourceModelId);
    }
    raw["coverage.json"] = JSON.stringify({ indexVersion: iiVersion, discoveredPages: pageHtml.size, pageFailures, tableModels: tableModels.length, evaluationModels: evalModels.length, mergedModels: byId.size, representedModels: identities.length, modelsWithObservations: new Set(rows.map((r) => r.sourceModelId)).size, distinctVariants: seenVariants.size, benchmarkRows: Object.fromEntries(counts), identities }, null, 2);
    notes.push(`benchmarks: ${[...counts.entries()].map(([k, v]) => `${k}=${v}`).join(", ")}`);
    return { benchmarks, rows, modelMeta, raw, notes, discoveries };
  },
};

export default source;
