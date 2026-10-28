import { afterEach, describe, expect, it, vi } from "vitest";
import { createCipheriv, createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import source from "./sources/aa";
import { computeIndex, type IndexConfig } from "../../src/engine";
import type { ScrapeContext, Snapshot } from "../../src/data/types";

// Claude Opus 5.5 (max) from AA's October 28 v5.0 payload, kept small so validation does not depend on network.
const astra = {
  id: "2f3c4dc9-a450-4303-8697-0237257cf08f", slug: "claude-opus-5-5", name: "Claude Opus 5.5 (max)",
  creator: { slug: "anthropic", name: "Anthropic" }, isReasoning: true, effort: { slug: "max" },
  intelligenceIndex: 58.4060336078904, intelligenceIndexIsEstimated: false,
  briefcaseElo: 1799.65, automationBenchPartialScore: 0.6953868128636069, terminalBench40: 0.595959595959596,
  frontierCode20: 0.464359595959596, frontierCode: 0.521731, gdpPdfAllPass: 0.262, hleDiamond: 0.679, hle: 0.613531047265987,
  critpt: 0.317142857142857, critptAgentic: 0.777142857142857, critptAgenticHard: 0.61, terminalBenchScience: 0.59047619047619,
  scicode: 0.668981481481482, lcr: 0.846666666666667, gdpval: 1866.27,
  omniscience: 48.1333333333333, omniscienceBreakdown: { accuracy: 0.655, hallucinationRate: 0.5033816425120773, byQuestionSet: { public: { index: 49 } } } as Record<string, unknown>,
  omniscienceV1: { index: 46.416666666666664, accuracy: 0.6621666666666667, hallucinationRate: 0.5860878145041933 },
  hleDiamondScoreByPartition: { reasoning: 0.78, knowledge: 0.578 },
  canonicalEvalTokenCounts: {}, timescaleData: { medianOutputSpeed: 98.36 },
  intelligenceIndexCost: { total: 6000 },
  intelligenceIndexCostPerTask: { cost: { total: 10.036409719512749 }, evaluations: [
    { slug: "aa-briefcase", weightedCostPerTask: 3.1568959073487983 }, { slug: "automationbench-aa", weightedCostPerTask: 0.07143775552710561 },
    { slug: "terminalbench-4-0", weightedCostPerTask: 1.3109276120148785 }, { slug: "frontiercode-2-0", weightedCostPerTask: 2.018273664779455 },
    { slug: "omniscience", weightedCostPerTask: 0.028107725802746696 }, { slug: "gdp-pdf", weightedCostPerTask: 0.077616774 },
    { slug: "hle-diamond", weightedCostPerTask: 0.11983133578968388 }, { slug: "critpt-v2-hard", weightedCostPerTask: 0.257671340257224 },
    { slug: "terminal-bench-science", weightedCostPerTask: 2.9956476039928566 },
  ] as { slug: string; weightedCostPerTask: number }[] },
};
const V5: Record<string, number> = {
  "aa-briefcase": 15, "aa-automationbench-aa": 5, "aa-gdp-pdf": 5, "aa-frontiercode-2-0": 15, "aa-terminalbench-v4-0": 10,
  "aa-terminalbench-science": 15, "aa-critpt-v2-hard": 10, "aa-omniscience-v1-1-accuracy": 10, "aa-omniscience-v1-1-non-hallucination": 5, "aa-hle-diamond": 10,
};
/** Models AA scores exactly with the v5 weights (the fit needs more models than components). */
const peers = Array.from({ length: 16 }, (_, i) => {
  const f = (k: number) => ((i * 37 + k * 11) % 97) / 100;
  const m = { ...astra, id: `peer-${i}`, slug: `peer-model-${i}`, name: `Peer Model ${i}`,
    briefcaseElo: 600 + 90 * i, automationBenchPartialScore: f(1), terminalBench40: f(2), frontierCode20: f(3), gdpPdfAllPass: f(4), hleDiamond: f(5),
    critptAgenticHard: f(6), terminalBenchScience: f(7), omniscienceBreakdown: { accuracy: f(8), hallucinationRate: f(9) }, omniscienceV1: undefined as unknown as typeof astra.omniscienceV1 };
  const elo = Math.min(100, Math.max(0, (m.briefcaseElo - 500) / 20));
  m.intelligenceIndex = (15 * elo + 5 * 100 * m.automationBenchPartialScore + 10 * 100 * m.terminalBench40 + 15 * 100 * m.frontierCode20 + 5 * 100 * m.gdpPdfAllPass + 10 * 100 * m.hleDiamond
    + 10 * 100 * m.critptAgenticHard + 15 * 100 * m.terminalBenchScience + 10 * 100 * f(8) + 5 * 100 * (1 - f(9))) / 100;
  return m;
});

function encrypted(json: unknown, keyHex: string) {
  const key = Buffer.from(keyHex, "hex");
  const cipher = createCipheriv("aes-256-gcm", key, createHash("sha256").update(key).digest().subarray(0, 12));
  return Buffer.concat([cipher.update(gzipSync(JSON.stringify(json))), cipher.final(), cipher.getAuthTag()]);
}
const V5_TEXT = "Artificial Analysis Intelligence Index v5.0 incorporates 9 evaluations: AA-Briefcase v1.1, AutomationBench-AA, Terminal-Bench 4.0, FrontierCode 2.0, AA-Omniscience v1.1, GDP.pdf, HLE-Diamond, CritPt v2 (Hard Subset), and Terminal-Bench-Science 0.1. Artificial Analysis Progress Index v1";
async function scrape(models: typeof astra[] = [astra, ...peers], extraHtml = "", text = V5_TEXT) {
  const key = "ab".repeat(32);
  const html = extraHtml + `${text} <a href="/evaluations/terminalbench-v4-0">Terminal-Bench v4.0</a> "manifest":{"path":"/data/aaaa.txt","key":"${key}"} "manifest":{"path":"/data/bbbb.txt","key":"${key}"} "manifest":{"path":"/data/cccc.txt","key":"${key}"}`;
  const tables = models.map(({ canonicalEvalTokenCounts: _, ...m }) => { void _; return m; });
  const progress = models.map((m, i) => ({ id: m.id, slug: m.slug, score: 350 - i }));
  vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(encrypted({ models: url.endsWith("aaaa.txt") ? models : url.endsWith("cccc.txt") ? progress : tables }, key))));
  const ctx = { fetchText: async () => html, log: () => {}, now: "2026-10-28" } as unknown as ScrapeContext;
  return source.scrape(ctx);
}
afterEach(() => vi.unstubAllGlobals());

function snapshotOf(r: Awaited<ReturnType<typeof scrape>>): Snapshot {
  const ids = [...new Map(r.rows.map((row) => [row.identity!.variantId, row.identity!])).values()];
  return { version: 1, date: "2026-10-28", generatedAt: "", labs: [], sources: [], series: [],
    models: ids.map((identity) => ({ id: identity.modelId, name: identity.modelName, labId: identity.labId, reasoning: true, aliases: [], kind: "llm" as const })),
    variants: ids.map((identity) => ({ id: identity.variantId, modelId: identity.modelId, effort: identity.effort })),
    benchmarks: r.benchmarks,
    observations: r.rows.map((row) => ({ ...row, variantId: row.identity!.variantId, observedAt: "2026-10-28" })),
  };
}

describe("Artificial Analysis", () => {
  it("detects a new index version and recovers its weights from AA's scores", async () => {
    const r = await scrape();
    const index = r.benchmarks.find((b) => b.id === "aa-intelligence-index-v5.0")!;
    expect(index.components).toEqual(V5);
    expect(r.benchmarks.find((b) => b.id === "aa-frontiercode-2-0")).toMatchObject({ name: "FrontierCode 2.0-AA", defaultWeight: 15, versionPolicy: { kind: "fresh", supersedes: "aa-frontiercode" } });
    expect(r.benchmarks.find((b) => b.id === "aa-critpt-v2-hard")).toMatchObject({ variantOf: "aa-critpt-v2", defaultWeight: 10 });
    expect(r.benchmarks.find((b) => b.id === "aa-gdpval-aa")?.defaultWeight ?? 0).toBe(0);
    const snapshot = snapshotOf(r);
    const config: IndexConfig = { id: "aa", name: "AA v5", weights: { ...index.components! }, required: [], cutoff: 0, strictness: 100, estimateMissing: false, effortMatching: "strict", variants: "all" };
    const ranked = computeIndex(snapshot, config).ranked;
    expect(ranked).toHaveLength(17);
    for (const p of peers) expect(Math.abs(ranked.find((x) => new RegExp(`peer-model-${p.id.slice(5)}(@|$)`).test(x.variant.id))!.score - p.intelligenceIndex)).toBeLessThan(0.001);
    const opus = ranked.find((x) => x.model.id.includes("opus"))!;
    // AA rounds some published components; the rebuilt index lands within a fifth of a point of AA's 58.4.
    expect(Math.abs(opus.score - astra.intelligenceIndex)).toBeLessThan(0.2);
    // Each component's cost per task is its share of AA's index cost over its weight, so the mix costs what AA measured.
    expect(opus.costUsd).toBeCloseTo(astra.intelligenceIndexCostPerTask.cost.total, 6);
    expect(r.rows.find((o) => o.benchmarkId === "aa-frontiercode-2-0" && o.sourceModelId === astra.id)?.costUsd).toBeCloseTo(2.018273664779455 / 0.15, 6);
    // Changing the comparison pool must not change AA's fixed Elo mapping.
    snapshot.observations.push({ benchmarkId: "aa-briefcase", variantId: "unrelated@max", value: 9999, observedAt: "", sourceUrl: "" });
    expect(computeIndex(snapshot, config).ranked.find((x) => x.model.id.includes("opus"))!.score).toBe(opus.score);
    // A missing component cannot be fabricated or renormalized into an AA score.
    snapshot.observations = snapshot.observations.filter((o) => !(o.benchmarkId === "aa-automationbench-aa" && o.sourceModelId === astra.id));
    expect(computeIndex(snapshot, config).ranked.some((x) => x.model.id.includes("opus"))).toBe(false);
  });

  it("publishes a version it cannot reproduce as the composite alone, without failing", async () => {
    const future = [astra, ...peers].map((m) => ({ ...m, intelligenceIndexCostPerTask: { ...m.intelligenceIndexCostPerTask, evaluations: [...m.intelligenceIndexCostPerTask.evaluations, { slug: "future-eval", weightedCostPerTask: 1 }] } }));
    const r = await scrape(future, "", V5_TEXT.replace(/v5\.0/g, "v6.0"));
    expect(r.benchmarks.find((b) => b.id === "aa-intelligence-index-v6.0")?.components).toBeUndefined();
    expect(r.discoveries?.some((d) => d.includes("v6.0") && d.includes("future-eval"))).toBe(true);
    expect(r.benchmarks.find((b) => b.id === "aa-frontiercode-2-0")?.defaultWeight).toBe(0);
  });

  it("reads the Progress Index, Omniscience v1 and v1.1 side by side, and HLE-Diamond's split", async () => {
    const r = await scrape();
    expect(r.benchmarks.find((b) => b.id === "aa-progress-index-v1")).toMatchObject({ name: "AA Progress Index v1", category: "composite", defaultWeight: 0 });
    expect(r.rows.find((o) => o.benchmarkId === "aa-progress-index-v1" && o.sourceModelId === astra.id)?.value).toBe(350);
    expect(r.rows.find((o) => o.benchmarkId === "aa-omniscience" && o.sourceModelId === astra.id)?.value).toBeCloseTo(46.4167);
    expect(r.rows.find((o) => o.benchmarkId === "aa-omniscience-v1-1" && o.sourceModelId === astra.id)?.value).toBeCloseTo(48.1333);
    expect(r.rows.find((o) => o.benchmarkId === "aa-omniscience-v1-1-public")?.value).toBe(49);
    expect(r.rows.some((o) => o.benchmarkId === "aa-omniscience" && o.sourceModelId === "peer-0")).toBe(false);
    expect(r.rows.find((o) => o.benchmarkId === "aa-hle-diamond" && o.sourceModelId === astra.id)?.details?.breakdown).toEqual({ reasoning: 0.78, knowledge: 0.578 });
  });

  it("publishes AA-Omniscience v1.1 by domain on the index's -100..100 scale, as variants of the index", async () => {
    const domains = { "Software Engineering (SWE)": 49.6, "Humanities & Social Sciences": 21.4, Law: 19.7, "Science, Engineering & Mathematics": 19.1, Business: 14.4, Health: -6.7 };
    const r = await scrape([{ ...astra, omniscienceBreakdown: { ...astra.omniscienceBreakdown, byDomain: domains } }]);
    const health = r.benchmarks.find((b) => b.id === "aa-omniscience-v1-1-health")!;
    expect(health).toMatchObject({ unit: "score", higherIsBetter: true, normalization: { kind: "linear", min: -100, max: 100 }, defaultWeight: 0, variantOf: "aa-omniscience-v1-1" });
    expect(r.rows.find((o) => o.benchmarkId === "aa-omniscience-v1-1-health")).toMatchObject({ value: -6.7, costUsd: undefined });
    expect(r.rows.filter((o) => /^aa-omniscience-v1-1-(software-engineering|humanities|law|science|business|health)$/.test(o.benchmarkId))).toHaveLength(6);
    expect(r.rows.find((o) => o.benchmarkId === "aa-omniscience-v1-1-accuracy")?.value).toBeCloseTo(65.5);
  });

  it("retains measured zero, keeps null missing, and preserves unknown catalog identities", async () => {
    const unknown = { ...astra, id: "future-uuid", name: "Future Bench Model", slug: "future-bench-model", hle: 0, critpt: null };
    const r = await scrape([astra, unknown] as typeof astra[]);
    expect(r.rows.find((o) => o.sourceModelId === "future-uuid" && o.benchmarkId === "aa-humanitys-last-exam")?.value).toBe(0);
    expect(r.rows.some((o) => o.sourceModelId === "future-uuid" && o.benchmarkId === "aa-critpt")).toBe(false);
    expect(r.modelMeta?.find((m) => m.modelLabel === "Future Bench Model")?.identity?.modelId).toBe("aa-future-bench-model");
  });

  it("reads Code2Video-AA as an Elo with its 95% interval", async () => {
    const r = await scrape([{ ...astra, code2videoElo: 1535.57, code2videoBreakdown: { elo: 1535.57, lower95ci: 1510.04, upper95ci: 1561.11 } }] as unknown as typeof astra[]);
    const row = r.rows.find((o) => o.benchmarkId === "aa-code2video-aa");
    expect(row?.value).toBe(1535.57);
    expect(row?.ci).toEqual([1510.04, 1561.11]);
    expect(r.discoveries?.some((d) => d.includes("code2video"))).toBeFalsy();
  });

  it("announces unread evaluation pages and data fields without failing, and fills fields only a page carries", async () => {
    const inline = `self.__next_f.push([1,${JSON.stringify(`"initialModels":[${JSON.stringify({ id: astra.id, aa3dElo: 1165.2 })}]`)}])`;
    const future = { ...astra, futureBenchScore: 0.42 };
    const r = await scrape([future], `<a href="/evaluations/future-bench">Future Bench</a> <a href="/evaluations/artificial-analysis-decision-index">Decision</a> ${inline}`);
    expect(r.discoveries).toContain(`AA data field "futureBenchScore" (1 models)`);
    expect(r.discoveries).toContain("AA evaluation page https://artificialanalysis.ai/evaluations/future-bench");
    expect(r.discoveries?.some((d) => d.includes("decision-index") || d.includes("terminalbench-v4-0"))).toBe(false);
    expect(r.rows.find((o) => o.benchmarkId === "aa-3d")?.value).toBe(1165.2);
  });
});
