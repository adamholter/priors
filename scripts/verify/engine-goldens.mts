/**
 * Writes what src/engine/golden.test.ts and src/lib/history.test.ts hold the engine to. Run it when the math changes on purpose.
 * Pass --fixture to re-trim the small dataset from data/snapshots first. GOLDEN_ROOT points at another checkout's src,
 * to write the goldens from an older implementation.
 * Usage: npx tsx scripts/verify/engine-goldens.mts [--fixture]
 */
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import type { Benchmark, Snapshot } from "../../src/data/types";
import { GOLDEN_DATE, goldenConfigs, goldenHistories, withVirtualClock } from "../../src/engine/golden-cases";

const repo = process.cwd(), FIXTURES = path.join(repo, "src/engine/fixtures");
const FIXTURE_DATES = ["2026-09-20", "2026-10-15", GOLDEN_DATE];
const root = process.env.GOLDEN_ROOT ?? repo;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** A small, real dataset: a spread of models and benchmarks, plus the row shapes today's data lacks (estimates, routes, duplicates, ids nothing else names). */
function trim(s: Snapshot, keepBench: Set<string>, keepModels: Set<string>): Snapshot {
  const META = ["price1mInputTokens", "price1mOutputTokens", "cacheHitPrice", "cacheWritePrice", "isOpenWeights", "parameters", "isReasoning", "releaseDate"];
  const slimSource = <T extends { metadata?: Record<string, unknown> }>(x: T): T => ({ ...x, metadata: x.metadata && Object.fromEntries(META.filter((k) => k in x.metadata!).map((k) => [k, x.metadata![k]])) });
  const variants = s.variants.filter((v) => keepModels.has(v.modelId)).map((v) => ({ ...v, sourceModel: v.sourceModel && slimSource(v.sourceModel), sourceModels: undefined }));
  const ids = new Set(variants.map((v) => v.id));
  const benchmarks = s.benchmarks.filter((b) => keepBench.has(b.id)).map((b): Benchmark => ({ ...b, description: "", url: "", components: undefined }));
  const observations = s.observations.filter((o) => keepBench.has(o.benchmarkId) && ids.has(o.variantId)).map((o) => {
    const keepDetails = o.benchmarkId === "subscription-token-price" || o.benchmarkId === "t3-usage-share" ? o.details : undefined;
    return { ...o, details: keepDetails && { ...keepDetails, daily: undefined, dayTotals: undefined }, ci: undefined, sourceUrl: o.sourceUrl.slice(0, 40), note: /estimated/i.test(o.note ?? "") ? o.note : undefined, rank: undefined };
  });
  return { ...s, models: s.models.filter((m) => keepModels.has(m.id)).map((m) => ({ ...m, aliases: [] })), variants, benchmarks, observations, labs: s.labs, series: [], sources: [], estimates: [] };
}

function addRareShapes(s: Snapshot) {
  const rowCount = (b: Benchmark) => s.observations.filter((o) => o.benchmarkId === b.id).length;
  const [p0, p1, p2, p3] = s.benchmarks.filter((b) => b.unit === "percent" && !b.proxy && !b.versionPolicy).sort((a, b) => rowCount(b) - rowCount(a) || a.id.localeCompare(b.id));
  const v = s.variants, at = (i: number) => v[i % v.length];
  const has = (b: string, id: string) => s.observations.some((o) => o.benchmarkId === b && o.variantId === id);
  const free = (b: string, from: number) => { for (let i = from; i < from + v.length; i++) if (!has(b, at(i).id)) return at(i).id; return at(from).id; };
  s.estimates = [
    { benchmarkId: p0.id, variantId: free(p0.id, 3), value: 41, estimateKind: "scaled", sourceBenchmarkId: p1.id, sourceVariantId: at(3).id, sourceUrl: "https://example.com/e", evidence: ["paired"] },
    { benchmarkId: p0.id, variantId: free(p0.id, 11), value: 52, estimateKind: "cross-effort", sourceVariantId: at(12).id, evidence: ["efforts"] },
    { benchmarkId: p1.id, variantId: free(p1.id, 19), value: 63, estimateKind: "performance", evidence: [] },
  ];
  const routed = v.filter((x) => has(p3.id, x.id) && !has(p2.id, x.id)).filter((_, i) => i % 2 === 0);
  p2.estimationRoutes = [{ sourceId: "dropped-benchmark", factor: 2, method: "manual", evidenceId: "skipped" }, { sourceId: p3.id, factor: 0.9, variantFactors: Object.fromEntries(routed.map((x) => [x.id, 1.1])), method: "paired-average", pairedCount: 4, evidenceId: "calibration" }];
  p1.versionPolicy = { kind: "fallback", fallbackTo: "retired-benchmark" };
  // The newest models' rows: an older one would fall outside the default age window and reach nothing.
  const released = new Map(s.models.map((m) => [m.id, m.releaseDate ?? ""])), modelOf = new Map(v.map((x) => [x.id, x.modelId]));
  const rows = s.observations.filter((o) => o.benchmarkId === p0.id).sort((a, b) => (released.get(modelOf.get(b.variantId) ?? "") ?? "").localeCompare(released.get(modelOf.get(a.variantId) ?? "") ?? ""));
  if (rows[0]) rows[0].details = { realIndex: { effortAttribution: "assumed-top" } };
  if (rows[1]) rows[1].note = "Estimated by the publisher";
  if (rows[2]) s.observations.push({ ...rows[2], value: rows[2].value + 1, harness: "second-harness" });
  if (rows[3]) { rows[3].details = { priorsEstimate: { estimateKind: "scaled", evidence: ["shipped"] } }; s.observations.push({ ...rows[3], details: undefined, value: rows[3].value + 2 }); }
  s.observations.push(
    { benchmarkId: "retired-benchmark", variantId: free(p1.id, 27), value: 33, observedAt: "", sourceUrl: "https://example.com/r" },
    { benchmarkId: "dropped-benchmark", variantId: at(1).id, value: 90, observedAt: "", sourceUrl: "https://example.com/d" },
    { benchmarkId: p3.id, variantId: "not-in-the-list@high", value: 77, observedAt: "", sourceUrl: "https://example.com/n" },
  );
  s.models.push({ id: "fixture-image", name: "Image 1", labId: "openai", kind: "image", reasoning: false, aliases: [] });
  s.variants.push({ id: "fixture-image@default", modelId: "fixture-image", effort: "default" });
  s.observations.push({ benchmarkId: p3.id, variantId: "fixture-image@default", value: 99, observedAt: "", sourceUrl: "" });
  const llm = s.models.filter((m) => m.kind === "llm");
  if (llm[0]) llm[0].priceTier = "frontier";
  if (llm[1]) llm[1].priceTier = "small";
  if (llm[2]) delete llm[2].releaseDate;
  s.variants.push({ id: `${v[0].modelId}@high~fixture`, modelId: v[0].modelId, effort: "high", configuration: "fixture" });
  s.observations.push({ benchmarkId: p3.id, variantId: `${v[0].modelId}@high~fixture`, value: 58, observedAt: "", sourceUrl: "" });
}

function writeFixtures() {
  mkdirSync(FIXTURES, { recursive: true });
  const read = (date: string) => JSON.parse(gunzipSync(readFileSync(path.join(repo, `data/snapshots/${date}.json.gz`))).toString("utf8")) as Snapshot;
  const last = read(GOLDEN_DATE);
  const counts = new Map<string, number>();
  for (const o of last.observations) counts.set(o.benchmarkId, (counts.get(o.benchmarkId) ?? 0) + 1);
  const busy = (f: (b: Benchmark) => boolean, n: number) => last.benchmarks.filter(f).sort((a, b) => counts.get(b.id)! - counts.get(a.id)! || a.id.localeCompare(b.id)).slice(0, n).map((b) => b.id);
  const aaParts = Object.keys(last.benchmarks.filter((b) => b.components).sort((a, b) => b.id.localeCompare(a.id))[0]?.components ?? {});
  const fallbacks = last.benchmarks.filter((b) => b.versionPolicy?.kind === "fallback").slice(0, 5).flatMap((b) => [b.id, b.versionPolicy!.kind === "fallback" ? b.versionPolicy!.fallbackTo : b.id]);
  const keepBench = new Set([...aaParts, ...fallbacks, "aa-cost-per-task-index", "aa-output-speed", "subscription-token-price", "codex-plus-messages", "t3-usage-share", ...last.benchmarks.filter((b) => b.id.startsWith("aa-progress-index") || b.components).map((b) => b.id),
    ...busy((b) => b.unit === "percent" && !b.proxy, 18), ...busy((b) => b.unit === "elo", 2), ...busy((b) => b.unit === "usd" || b.unit === "seconds", 2), ...busy((b) => b.unit === "score", 2)]);
  const llm = last.models.filter((m) => m.kind === "llm" && m.releaseDate).sort((a, b) => b.releaseDate!.localeCompare(a.releaseDate!));
  const keepModels = new Set([...llm.slice(0, 22), ...llm.filter((_, i) => i % 40 === 3).slice(0, 5)].map((m) => m.id));
  for (const date of FIXTURE_DATES) {
    const s = trim(read(date), keepBench, keepModels);
    addRareShapes(s);
    const file = gzipSync(JSON.stringify(s), { level: 9 });
    writeFileSync(path.join(FIXTURES, `${date}.json.gz`), file);
    if (date === GOLDEN_DATE) writeFileSync(path.join(FIXTURES, "latest.json.gz"), file);
    console.log(date, s.models.length, s.variants.length, s.benchmarks.length, s.observations.length, `${(file.length / 1024).toFixed(0)} KB`);
  }
}

if (process.argv.includes("--fixture")) writeFixtures();

const src = (f: string) => import(path.join(root, "src", f));
const { computeIndex, defaultConfig, PAGE_VIEW } = await src("engine/index.ts");
const { clientSnapshot } = await src("data/client-snapshot.ts"), { packSnapshot, unpackSnapshot } = await src("data/packed-snapshot.ts");
const { computeHistory } = await src("lib/history.ts"), { loadSnapshot, readSnapshot } = await src("data/load.ts");
const { fitPriors } = await src("onboarding/optimizer.ts"), { defaultLineup } = await src("onboarding/defaults.ts"), { benchmarkQuality } = await src("onboarding/quality.ts");
const clientOf = (s: Snapshot) => unpackSnapshot(JSON.parse(JSON.stringify(packSnapshot(clientSnapshot(s)))));
const results = (s: Snapshot, cases: Snapshot) => goldenConfigs(cases, defaultConfig(cases), PAGE_VIEW).map(({ id, config, view }) => [id, JSON.stringify(computeIndex(s, config, view ?? {}))] as const);

// The real data: the full and client snapshots of one finished day.
const real = await readSnapshot(GOLDEN_DATE) as Snapshot;
const realHashes = Object.fromEntries([...results(real, real).map(([id, j]) => [`full/${id}`, sha(j)]), ...results(clientOf(real), real).map(([id, j]) => [`client/${id}`, sha(j)])]);

// The fixture: read the way the site reads it, from a data directory of its own.
const dir = mkdtempSync(path.join(tmpdir(), "priors-golden-"));
mkdirSync(path.join(dir, "data/snapshots"), { recursive: true });
for (const f of readdirSync(FIXTURES)) if (f.endsWith(".json.gz")) cpSync(path.join(FIXTURES, f), path.join(dir, "data/snapshots", f));
process.chdir(dir);
const snap = await loadSnapshot() as Snapshot, base = defaultConfig(snap);
const index = Object.fromEntries([...results(snap, snap).map(([id, j]) => [`full/${id}`, sha(j)]), ...results(clientOf(snap), snap).map(([id, j]) => [`client/${id}`, sha(j)])]);
const history: Record<string, string> = {};
for (const h of goldenHistories(snap, base)) history[h.id] = sha(JSON.stringify(await computeHistory(h.config, h.mode, h.id)));
const quality = Object.fromEntries(benchmarkQuality(snap).map((q: { id: string; score: number }) => [q.id, q.score]));
const lineup = defaultLineup(snap).slice(0, 6);
const fit: Record<string, string> = {};
for (const [id, lu] of [["default", lineup], ["reversed", [...lineup].reverse()]] as const) {
  const updates: string[] = [];
  const done = await withVirtualClock(() => fitPriors(snap, [...lu], (u: unknown) => updates.push(JSON.stringify(u)), quality, 0, { baseline: [...lu] }, { focus: "general", budgetMs: { soft: 400, hard: 800 } }));
  fit[id] = sha(`${JSON.stringify(done)}\n${updates.join("\n")}`);
}
process.chdir(repo);
rmSync(dir, { recursive: true, force: true });
writeFileSync(path.join(FIXTURES, "expected.json"), `${JSON.stringify({ real: realHashes, index, history, fit, lineup }, null, 1)}\n`);
console.log(`goldens from ${root}: ${Object.keys(realHashes).length} real, ${Object.keys(index).length} fixture, ${Object.keys(history).length} history, ${Object.keys(fit).length} fits`);
