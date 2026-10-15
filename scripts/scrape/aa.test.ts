import { afterEach, describe, expect, it, vi } from "vitest";
import { createCipheriv, createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import source from "./sources/aa";
import { AA_V43_WEIGHTS } from "../../src/data/aa-index";
import { computeIndex, type IndexConfig } from "../../src/engine";
import type { ScrapeContext, Snapshot } from "../../src/data/types";

// Public AA September 8 payload values, kept small so validation does not depend on network.
const astra = {
  id: "2f339a97-9a0d-499a-9cb5-e0db665bfa25", slug: "gpt-6-astra", name: "GPT-6 Astra (max)",
  creator: { slug: "openai", name: "OpenAI" }, isReasoning: true, effort: { slug: "max" },
  intelligenceIndex: 52.814069395513, intelligenceIndexIsEstimated: false,
  briefcaseElo: 1562.01, gdpval: 1580.2, automationBenchPartialScore: 0.6849174806688876,
  terminalbenchV40: 0.590909090909091, terminalbenchV21: 0.883895131086142, scicode: 0.564814814814815,
  hle: 0.546802594995366, gdpPdfAllPass: 0.31, critpt: 0.317142857142857, lcr: 0.806666666666667,
  omniscience: 43.4, omniscienceBreakdown: { accuracy: 0.626, hallucinationRate: 0.5133689839572193 },
  canonicalEvalTokenCounts: {}, timescaleData: { medianOutputSpeed: 58.22 },
  intelligenceIndexCost: { total: 4000 }, intelligenceIndexCostPerTask: { cost: { total: 3.2575003134834164 } },
};

function encrypted(json: unknown, keyHex: string) {
  const key = Buffer.from(keyHex, "hex");
  const cipher = createCipheriv("aes-256-gcm", key, createHash("sha256").update(key).digest().subarray(0, 12));
  return Buffer.concat([cipher.update(gzipSync(JSON.stringify(json))), cipher.final(), cipher.getAuthTag()]);
}
async function scrape(models = [astra], extraHtml = "") {
  const key = "ab".repeat(32);
  const html = extraHtml + `Artificial Analysis Intelligence Index v4.3 incorporates 10 evaluations: AA-Briefcase, GDPval-AA v2. <a href="/evaluations/terminalbench-v4-0">Terminal-Bench v4.0</a> "manifest":{"path":"/data/aaaa.txt","key":"${key}"} "manifest":{"path":"/data/bbbb.txt","key":"${key}"}`;
  const tables = models.map(({ canonicalEvalTokenCounts: _, ...m }) => { void _; return m; });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(encrypted({ models: url.endsWith("aaaa.txt") ? models : tables }, key))));
  const ctx = { fetchText: async () => html, log: () => {}, now: "2026-09-08" } as unknown as ScrapeContext;
  return source.scrape(ctx);
}
afterEach(() => vi.unstubAllGlobals());

describe("Artificial Analysis v4.3", () => {
  it("reconstructs the published index, retains task cost and uses the exact eleven weights", async () => {
    const r = await scrape();
    const identity = r.rows[0].identity!;
    const snapshot: Snapshot = { version: 1, date: "2026-09-08", generatedAt: "", labs: [], sources: [], series: [],
      models: [{ id: identity.modelId, name: identity.modelName, labId: identity.labId, reasoning: true, aliases: [], kind: "llm" }],
      variants: [{ id: identity.variantId, modelId: identity.modelId, effort: identity.effort }],
      benchmarks: r.benchmarks,
      observations: r.rows.map((row) => ({ ...row, variantId: row.identity!.variantId, observedAt: "2026-09-08" })),
    };
    const config: IndexConfig = { id: "aa", name: "AA v4.3", weights: { ...AA_V43_WEIGHTS }, required: [], cutoff: 0, strictness: 100, estimateMissing: false, effortMatching: "strict", variants: "all" };
    expect(config.weights).toEqual(AA_V43_WEIGHTS);
    expect(Object.values(config.weights).reduce((a, b) => a + b, 0)).toBe(100);
    expect(config.effortMatching).toBe("strict");
    const index = computeIndex(snapshot, config);
    expect(index.ranked).toHaveLength(1);
    expect(Math.abs(index.ranked[0].score - astra.intelligenceIndex)).toBeLessThan(0.001);
    expect(index.ranked[0].costUsd).toBe(astra.intelligenceIndexCostPerTask.cost.total);
    expect(index.ranked[0].coverage).toBe(1);
    expect(r.rows.find((o) => o.benchmarkId === "aa-intelligence-index-v4.3")?.costUsd).toBe(astra.intelligenceIndexCostPerTask.cost.total);
    expect(r.benchmarks.find((b) => b.id === "aa-briefcase")?.normalization).toEqual({ kind: "linear", min: 500, max: 2500 });
    expect(r.benchmarks.find((b) => b.id === "aa-terminalbench-v4-0")?.versionPolicy?.kind).toBe("fresh");
    expect(config.weights["aa-terminalbench-v2-1"]).toBeUndefined();
    expect(config.weights["aa-omniscience"]).toBeUndefined();
    // Changing the comparison pool must not change AA's fixed Elo mapping.
    snapshot.observations.push({ benchmarkId: "aa-briefcase", variantId: "unrelated@max", value: 9999, observedAt: "", sourceUrl: "" });
    expect(computeIndex(snapshot, config).ranked[0].score).toBe(index.ranked[0].score);
    // A missing required component cannot be fabricated or renormalized into an AA score.
    snapshot.observations = snapshot.observations.filter((o) => o.benchmarkId !== "aa-automationbench-aa");
    expect(computeIndex(snapshot, config).ranked).toHaveLength(0);
  });

  it("retains measured zero, keeps null missing, and preserves unknown catalog identities", async () => {
    const unknown = { ...astra, id: "future-uuid", name: "Future Bench Model", slug: "future-bench-model", hle: 0, critpt: null };
    const r = await scrape([astra, unknown] as typeof astra[]);
    expect(r.rows.find((o) => o.sourceModelId === "future-uuid" && o.benchmarkId === "aa-humanitys-last-exam")?.value).toBe(0);
    expect(r.rows.some((o) => o.sourceModelId === "future-uuid" && o.benchmarkId === "aa-critpt")).toBe(false);
    expect(r.modelMeta?.find((m) => m.modelLabel === "Future Bench Model")?.identity?.modelId).toBe("aa-future-bench-model");
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
