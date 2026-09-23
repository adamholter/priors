/**
 * Runs every source in ./sources, normalizes labels, resolves variants, and writes
 *   data/snapshots/YYYY-MM-DD.json  (+ latest.json)
 * Usage: npx tsx scripts/scrape/build.ts [--only aa,deepswe] [--date YYYY-MM-DD]
 */
import { mkdir, readdir, writeFile, readFile, rename } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import type { Benchmark, Effort, Model, Observation, RawRow, RawSeries, Series, Snapshot, Source, SourceRun, ScrapeResult, Variant } from "../../src/data/types";
import { EFFORT_WORDS, LABS, normalizeLabel, variantId } from "../../src/data/normalize";
import { makeContext, saveRaw } from "./harness";
import { buildLibrary } from "./library";

const args = process.argv.slice(2);
const opt = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const only = opt("only")?.split(",").map((s) => s.trim());
const date = opt("date") ?? new Date().toISOString().slice(0, 10);
const SNAP_DIR = path.resolve("data/snapshots");

async function loadSources(): Promise<Source[]> {
  const dir = path.resolve(__dirname, "sources");
  const files = (await readdir(dir)).filter((f) => /\.ts$/.test(f) && !f.startsWith("_") && !f.endsWith(".test.ts"));
  const out: Source[] = [];
  for (const f of files) {
    const mod = await import(path.join(dir, f));
    const src: Source = mod.default ?? mod.source;
    if (!src?.id) { console.warn(`skip ${f}: no default Source export`); continue; }
    if (!only || only.includes(src.id)) out.push(src);
  }
  return out;
}

async function main() {
  const sources = await loadSources();
  if (!sources.length) throw new Error("no sources");
  const runs: SourceRun[] = [];
  const benchmarks = new Map<string, Benchmark>();
  const rows: (RawRow & { sourceId: string })[] = [];
  const rawSeries: (RawSeries & { sourceId: string })[] = [];
  const meta = new Map<string, NonNullable<ScrapeResult["modelMeta"]>[number]>();

  // Keep publisher traffic bounded when many benchmarks share one host (VALS).
  let nextSource = 0;
  await Promise.all(Array.from({ length: Math.min(6, sources.length) }, async () => {
    while (nextSource < sources.length) {
      const src = sources[nextSource++];
      const ctx = makeContext(src.id);
      const started = new Date().toISOString();
      let rawPath = "";
      try {
        const r = await src.scrape(ctx);
        rawPath = await saveRaw(src.id, date, r.raw);
        const ids = new Set(r.benchmarks.map((b) => b.id));
        if (!ids.size || !r.rows.length) throw new Error("source returned no benchmarks or rows");
        for (const b of r.benchmarks) {
          if (!r.rows.some((row) => row.benchmarkId === b.id)) throw new Error(`benchmark ${b.id} returned no rows`);
        }
        for (const row of r.rows) {
          if (!ids.has(row.benchmarkId) || !Number.isFinite(row.value)) throw new Error(`invalid row for ${row.benchmarkId}`);
        }
        r.benchmarks.forEach((b) => benchmarks.set(b.id, { ...b, sourceId: src.id }));
        r.rows.forEach((row) => rows.push({ ...row, sourceId: src.id }));
        r.series?.forEach((s) => rawSeries.push({ ...s, sourceId: src.id }));
        r.modelMeta?.forEach((m) => meta.set(m.modelLabel.toLowerCase(), m));
        runs.push({ sourceId: src.id, status: "ok", fetchedAt: started, rowCount: r.rows.length, unknownLabels: [], rawPath });
        ctx.log(`${r.rows.length} rows, ${r.benchmarks.length} benchmarks${r.notes?.length ? " — " + r.notes.join("; ") : ""}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        runs.push({ sourceId: src.id, status: "failed", fetchedAt: started, rowCount: 0, unknownLabels: [], rawPath, error: msg });
        ctx.log(`FAILED: ${msg}`);
      }
    }
  }));

  // ---- normalize
  const models = new Map<string, Model>();
  const pending: { row: RawRow & { sourceId: string }; modelId: string; effort?: Effort }[] = [];
  const unknownBySource = new Map<string, Set<string>>();
  const touch = (n: ReturnType<typeof normalizeLabel>, label: string, hint?: { labHint?: string; releaseDateHint?: string; kind?: Model["kind"] }) => {
    if (!n.ok) return;
    const m = models.get(n.modelId) ?? { id: n.modelId, name: n.modelName, labId: n.labId, kind: "llm", reasoning: n.reasoningFamily, aliases: [] };
    if (!m.aliases.includes(label.toLowerCase())) m.aliases.push(label.toLowerCase());
    if (hint?.releaseDateHint && !m.releaseDate) m.releaseDate = hint.releaseDateHint;
    if (hint?.kind && hint.kind !== "llm") m.kind = hint.kind;
    if (n.effort) m.reasoning = true;
    models.set(m.id, m);
  };
  for (const row of rows) {
    let n = row.identity ? { ok: true as const, ...row.identity, reasoningFamily: row.identity.effort !== "none", cleaned: row.modelLabel } : normalizeLabel(row.modelLabel, row.effort);
    if (!n.ok) {
      (unknownBySource.get(row.sourceId) ?? unknownBySource.set(row.sourceId, new Set()).get(row.sourceId)!).add(row.modelLabel);
      // VALS publishes stable model keys. Keep unmatched scores under source-qualified
      // identities so a new name cannot silently delete a score or merge with a different model.
      if ((row.sourceId.startsWith("vals") || row.sourceId === "programbench") && row.sourceModelId) {
        const suffix = createHash("sha256").update(row.sourceModelId).digest("hex").slice(0, 12);
        const labId = row.labHint?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "other";
        n = { ok: true, modelId: `vals-model-${suffix}`, modelName: row.modelLabel, labId,
          effort: row.effort ? EFFORT_WORDS[row.effort.toLowerCase().trim()] : undefined,
          reasoningFamily: false, cleaned: row.modelLabel };
      } else continue;
    }
    touch(n, row.modelLabel, meta.get(row.modelLabel.toLowerCase()) ?? {
      releaseDateHint: row.releaseDateHint,
      ...(row.sourceId === "vals-voice-code-bench" ? { kind: "audio" as const } : {}),
    });
    pending.push({ row, modelId: n.modelId, effort: n.effort });
  }
  for (const [label, hint] of meta) {
    const n = hint.identity ? { ok: true as const, ...hint.identity, reasoningFamily: hint.identity.effort !== "none", cleaned: label } : normalizeLabel(label);
    touch(n, label, hint);
  }
  runs.forEach((r) => (r.unknownLabels = [...(unknownBySource.get(r.sourceId) ?? [])]));

  // ---- resolve variants. Unspecified effort -> max effort seen for that model, else "default".
  const effortsSeen = new Map<string, Set<Effort>>();
  pending.forEach((p) => { if (p.effort) (effortsSeen.get(p.modelId) ?? effortsSeen.set(p.modelId, new Set()).get(p.modelId)!).add(p.effort); });
  // Partial (--only) runs never see the skipped sources' rows, so seed effort
  // knowledge from the previous snapshot's variants before resolving.
  if (only) {
    try {
      const prev: Snapshot = JSON.parse(gunzipSync(await readFile(path.join(SNAP_DIR, "latest.json.gz"))).toString("utf8"));
      for (const v of prev.variants) if (v.effort !== "default") (effortsSeen.get(v.modelId) ?? effortsSeen.set(v.modelId, new Set()).get(v.modelId)!).add(v.effort);
    } catch { /* no previous snapshot */ }
  }
  const ORDER: Effort[] = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];
  const resolveEffort = (modelId: string, e?: Effort): Effort => {
    if (e) return e;
    const seen = effortsSeen.get(modelId);
    if (!seen?.size) return "default";
    return [...seen].sort((a, b) => ORDER.indexOf(b) - ORDER.indexOf(a))[0];
  };
  const variants = new Map<string, Variant>();
  const observations: Observation[] = [];
  for (const p of pending) {
    const effort = resolveEffort(p.modelId, p.effort);
    // VALS can publish separate Thinking and Nonthinking rows at the same reported
    // effort. Preserve its stable model key as part of the evaluated configuration.
    const valsConfig = (p.row.sourceId.startsWith("vals") || p.row.sourceId === "programbench") && p.row.sourceModelId
      ? `vals-${createHash("sha256").update(p.row.sourceModelId).digest("hex").slice(0, 12)}` : undefined;
    const vid = p.row.identity?.variantId ?? `${variantId(p.modelId, effort)}${valsConfig ? `~${valsConfig}` : ""}`;
    const identity = p.row.identity;
    variants.set(vid, { ...variants.get(vid), id: vid, modelId: p.modelId, effort, ...(identity ? {
      configuration: identity.configuration,
      sourceModel: { id: identity.sourceModelId, slug: identity.sourceSlug, name: p.row.modelLabel, url: typeof p.row.modelMetadata?.sourceModelUrl === "string" ? p.row.modelMetadata.sourceModelUrl : `https://artificialanalysis.ai/models/${identity.sourceSlug}`, metadata: p.row.modelMetadata },
    } : valsConfig ? {
      configuration: `VALS model key: ${p.row.sourceModelId}`,
      sourceModel: { id: p.row.sourceModelId!, slug: p.row.sourceModelId!, name: p.row.modelLabel,
        url: p.row.sourceUrl, metadata: p.row.modelMetadata },
    } : {}) });
    const { modelLabel, identity: _identity, modelMetadata: _metadata, effort: _e, labHint: _l, releaseDateHint: _r, sourceId: _s, ...rest } = p.row;
    void _identity; void _metadata; void modelLabel; void _e; void _l; void _r; void _s;
    observations.push({ ...rest, variantId: vid, observedAt: date, note: rest.note ?? (p.effort ? undefined : effort !== "default" ? "effort unspecified; attributed to max" : undefined) });
  }
  // Keep authoritative AA catalog entries even when no evaluation is measured yet.
  // computeIndex still requires an observed selected benchmark, so they cannot rank.
  const catalogModelIds = new Set<string>();
  for (const hint of meta.values()) {
    const i = hint.identity;
    if (!i) continue;
    catalogModelIds.add(i.modelId);
    if (!variants.has(i.variantId)) variants.set(i.variantId, { id: i.variantId, modelId: i.modelId, effort: i.effort, configuration: i.configuration,
      sourceModel: { id: i.sourceModelId, slug: i.sourceSlug, name: hint.modelLabel, url: typeof hint.modelMetadata?.sourceModelUrl === "string" ? hint.modelMetadata.sourceModelUrl : `https://artificialanalysis.ai/models/${i.sourceSlug}`, metadata: hint.modelMetadata } });
  }
  const series: Series[] = [];
  for (const s of rawSeries) {
    const n = normalizeLabel(s.modelLabel, s.effort);
    if (!n.ok) continue;
    const effort = resolveEffort(n.modelId, n.effort);
    const vid = variantId(n.modelId, effort);
    variants.set(vid, { id: vid, modelId: n.modelId, effort });
    series.push({ benchmarkId: s.benchmarkId, variantId: vid, x: s.x, y: s.y, xLabel: s.xLabel, yLabel: s.yLabel, sourceUrl: s.sourceUrl });
  }

  // dedupe observations: same benchmark+variant(+harness) -> keep first
  const seen = new Set<string>();
  const deduped = observations.filter((o) => { const k = `${o.benchmarkId}|${o.variantId}|${o.harness ?? ""}`; if (seen.has(k)) return false; seen.add(k); return true; });

  const snap: Snapshot = {
    version: 1, date, generatedAt: new Date().toISOString(),
    labs: [...LABS, ...[...models.values()].filter((m) => !LABS.some((l) => l.id === m.labId)).filter((m, i, a) => a.findIndex((x) => x.labId === m.labId) === i).map((m) => ({ id: m.labId, name: m.labId, color: "#A3A39B" }))],
    models: [...models.values()].filter((m) => catalogModelIds.has(m.id) || deduped.some((o) => o.variantId.startsWith(m.id + "@")) || series.some((s) => s.variantId.startsWith(m.id + "@"))).sort((a, b) => a.id.localeCompare(b.id)),
    variants: [...variants.values()].sort((a, b) => a.id.localeCompare(b.id)),
    benchmarks: [...benchmarks.values()].sort((a, b) => a.id.localeCompare(b.id)),
    observations: deduped, series, sources: runs,
  };

  // merge with previous snapshot for failed sources so one outage doesn't blank a benchmark
  try {
    const prev: Snapshot = JSON.parse(gunzipSync(await readFile(path.join(SNAP_DIR, "latest.json.gz"))).toString("utf8"));
    const unselected = prev.sources.filter((r) => !runs.some((run) => run.sourceId === r.sourceId));
    const retained = [...runs.filter((r) => r.status === "failed"), ...(only ? unselected : [])];
    if (only) snap.sources.push(...unselected);
    for (const r of retained) {
      const prevRun = prev.sources.find((p) => p.sourceId === r.sourceId);
      if (!prevRun) continue;
      const prevBench = prev.benchmarks.filter((b) => b.sourceId === r.sourceId);
      prevBench.forEach((b) => snap.benchmarks.push(b));
      const ids = new Set(prevBench.map((b) => b.id));
      prev.observations.filter((o) => ids.has(o.benchmarkId)).forEach((o) => snap.observations.push({ ...o, note: only && r.status !== "failed" ? o.note : [o.note, `carried from ${prev.date}`].filter(Boolean).join("; ") }));
      prev.series.filter((s) => ids.has(s.benchmarkId)).forEach((s) => snap.series.push(s));
      prev.variants.forEach((v) => { if (!snap.variants.some((x) => x.id === v.id)) snap.variants.push(v); });
      prev.models.forEach((m) => { if (!snap.models.some((x) => x.id === m.id)) snap.models.push(m); });
      r.note = `carried forward from ${prev.date}`;
    }
  } catch { /* first run */ }

  await mkdir(SNAP_DIR, { recursive: true });
  const json = JSON.stringify(snap);
  // gz only: ~130 KB/day committed to the repo is the backup and the time-travel archive.
  const gz = gzipSync(json);
  for (const name of [`${date}.json.gz`, "latest.json.gz"]) {
    const temp = path.join(SNAP_DIR, `${name}.${process.pid}.tmp`);
    await writeFile(temp, gz);
    await rename(temp, path.join(SNAP_DIR, name));
  }

  console.log(`\nsnapshot ${date}: ${snap.models.length} models, ${snap.variants.length} variants, ${snap.benchmarks.length} benchmarks, ${snap.observations.length} observations, ${(json.length / 1024).toFixed(0)} KB (${(gzipSync(json).length / 1024).toFixed(0)} KB gz)`);
  for (const r of runs) console.log(`  ${r.status.padEnd(7)} ${r.sourceId.padEnd(16)} rows=${r.rowCount} unknown=${r.unknownLabels.length}${r.unknownLabels.length ? " [" + r.unknownLabels.slice(0, 6).join(" | ") + (r.unknownLabels.length > 6 ? " …" : "") + "]" : ""}${r.error ? " " + r.error : ""}`);

  await buildLibrary(date);
}

declare module "../../src/data/types" { interface SourceRun { note?: string } }

main().catch((e) => { console.error(e); process.exit(1); });
