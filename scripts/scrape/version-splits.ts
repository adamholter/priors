/**
 * New benchmark versions become new benchmarks. A source that can read the publisher's version label sets `version` on the
 * benchmark it returns and keeps returning the same id. When that label differs from the one the last snapshot stored for the
 * id (GameFeel v1.4 to v1.5), the old version's scores are frozen under the id they always had, and this and every later run
 * files the new version under `<id>-v<version>` (`versionPolicy: fresh`, superseding the old id). So a saved mix keeps meaning
 * what it meant, and a harder test never overwrites the easier one's numbers.
 *
 * Frozen versions are read from `scripts/scrape/sources/frozen/versions/*.json` (committed) and `data/frozen-versions/*.json`
 * (written by the scrape that saw the change, announced as a NEW_BENCHMARK line so it gets committed). Their rows are raw rows,
 * so they resolve through the same label matching as a live source.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Benchmark, Model, Observation, RawRow, ScrapeResult, Variant } from "../../src/data/types";

export interface FrozenVersion { id: string; version: string; frozenAt: string; benchmark: Benchmark; rows: RawRow[] }

export const FROZEN_DIRS = [path.resolve("scripts/scrape/sources/frozen/versions"), path.resolve("data/frozen-versions")];
const RUNTIME_DIR = FROZEN_DIRS[1];

/** "v1.5" and "1.5" are the same version. */
export const cleanVersion = (v: string) => v.trim().replace(/^v(?=\d)/i, "");
/** `gamefeel` at 1.5 is `gamefeel-v1.5`; an id that already ends in a version has it replaced. */
export const versionedId = (id: string, version: string) => `${id.replace(/-v\d+(?:\.\d+)*$/, "")}-v${cleanVersion(version).replace(/[^0-9a-z.]+/gi, "-").toLowerCase()}`;

export async function loadFrozen(dirs = FROZEN_DIRS): Promise<Map<string, FrozenVersion>> {
  const out = new Map<string, FrozenVersion>();
  for (const dir of dirs) {
    let files: string[] = [];
    try { files = (await readdir(dir)).filter((f) => f.endsWith(".json")); } catch { continue; }
    for (const f of files) {
      const v = JSON.parse(await readFile(path.join(dir, f), "utf8")) as FrozenVersion;
      if (!out.has(v.id)) out.set(v.id, v); // the committed copy wins
    }
  }
  return out;
}

/** The last snapshot's scores for a benchmark, as raw rows that resolve back to the same models and efforts. */
export function freeze(bench: Benchmark, obs: Observation[], variants: Variant[], models: Model[], frozenAt: string): FrozenVersion {
  const variant = new Map(variants.map((v) => [v.id, v])), model = new Map(models.map((m) => [m.id, m]));
  const rows: RawRow[] = [];
  for (const o of obs) {
    const v = variant.get(o.variantId), m = v && model.get(v.modelId);
    if (!v || !m) continue;
    const { benchmarkId: _b, variantId: _v, observedAt: _o, ...rest } = o;
    rows.push({ ...rest, benchmarkId: bench.id, modelLabel: m.name, labHint: m.labId, ...(v.effort === "default" ? { effortUnstated: true } : { effort: v.effort }), note: [o.note?.replace(/;? ?carried from \d{4}-\d{2}-\d{2}/, ""), `frozen at v${cleanVersion(bench.version!)}`].filter(Boolean).join("; ") });
  }
  return { id: bench.id, version: cleanVersion(bench.version!), frozenAt, benchmark: frozenBenchmark(bench), rows };
}

function frozenBenchmark(b: Benchmark): Benchmark {
  const v = cleanVersion(b.version!);
  return { ...b, version: v, name: b.name.includes(`v${v}`) ? b.name : `${b.name} v${v}`, ...(b.shortName && !b.shortName.includes(`v${v}`) ? { shortName: `${b.shortName} v${v}` } : {}),
    description: `${b.description} These are the final v${v} results; the publisher has since moved to a newer version, listed separately.` };
}

/**
 * Applies frozen versions to one source's result, in place: a benchmark whose version differs from its frozen one moves to its
 * versioned id, and each frozen version the source owns is added back. `prev` is the last snapshot, used to notice a change.
 * Returns what changed, for the log.
 */
export function applyVersionSplits(
  sourceId: string, r: Pick<ScrapeResult, "benchmarks" | "rows">, frozen: Map<string, FrozenVersion>,
  prev: { benchmarks: Benchmark[]; observations: Observation[]; variants: Variant[]; models: Model[] } | undefined, date: string,
): { created: FrozenVersion[]; moved: string[] } {
  const created: FrozenVersion[] = [], moved: string[] = [];
  for (const b of [...r.benchmarks]) {
    if (!b.version) continue;
    let f = frozen.get(b.id);
    const old = prev?.benchmarks.find((p) => p.id === b.id && p.sourceId === sourceId);
    if (!f && old?.version && cleanVersion(old.version) !== cleanVersion(b.version)) {
      f = freeze(old, prev!.observations.filter((o) => o.benchmarkId === b.id), prev!.variants, prev!.models, date);
      frozen.set(b.id, f);
      created.push(f);
    }
    if (!f || f.version === cleanVersion(b.version)) continue;
    const id = versionedId(b.id, b.version), v = cleanVersion(b.version);
    for (const row of r.rows) if (row.benchmarkId === b.id) row.benchmarkId = id;
    Object.assign(b, { id, name: b.name.includes(`v${v}`) ? b.name : `${b.name} v${v}`, ...(b.shortName && !b.shortName.includes(`v${v}`) ? { shortName: `${b.shortName} v${v}` } : {}), versionPolicy: { kind: "fresh", supersedes: f.id } });
    moved.push(`${f.id} v${f.version} -> ${id}`);
  }
  for (const f of frozen.values()) {
    if (f.benchmark.sourceId !== sourceId || r.benchmarks.some((b) => b.id === f.id)) continue;
    r.benchmarks.push(f.benchmark);
    r.rows.push(...f.rows.map((row) => ({ ...row })));
  }
  return { created, moved };
}

export async function saveFrozen(f: FrozenVersion, dir = RUNTIME_DIR) {
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${f.id}.json`), JSON.stringify(f, null, 1) + "\n");
}
