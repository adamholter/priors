/**
 * Builds data/snapshots/<date>.library.json.gz — precomputed benchmark columns plus
 * focus-biased, high-quality mixes that seed the lineup fit's first restarts.
 * Usage: npm run library -- --date YYYY-MM-DD
 */
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import type { Benchmark, FocusId, Snapshot } from "../../src/data/types";
import { computeIndex, selectVariants, type IndexConfig } from "../../src/engine";
import { benchmarkQuality, affinity } from "../../src/onboarding/quality";
import { FOCUSES } from "../../src/onboarding/focus";
import type { MixLibrary } from "../../src/onboarding/library";
import { fitPriors, settingsKey, LEVELS } from "../../src/onboarding/optimizer";

const args = process.argv.slice(2);
const opt = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const SNAP_DIR = path.resolve("data/snapshots");
const SAMPLES = 300;
const SELECTED = 20;
const MIN_TAU_DISTANCE = 0.15;
const LIBRARY_SETTINGS = { strictness: 50, estimateMissing: true, effortMatching: "calibrated" } as const;

const rng = (seed: number) => () => ((seed = Math.imul(seed ^ (seed >>> 15), 1 | seed)), ((seed + Math.imul(seed ^ (seed >>> 7), 61 | seed)) ^ seed) >>> 0) / 4294967296;

function eligible(b: Benchmark): boolean {
  return !b.proxy && !["cost", "speed", "composite", "reliability"].includes(b.category) && !/arena|image|subjective|price|cost|speed/i.test(`${b.id} ${b.name} ${b.description}`);
}

function indexConfig(weights: Record<string, number>): IndexConfig {
  return { id: "library", name: "library", weights, required: [], cutoff: 5, estimateMissing: LIBRARY_SETTINGS.estimateMissing, variants: "best", rankingVariants: "best", effortMatching: LIBRARY_SETTINGS.effortMatching, strictness: LIBRARY_SETTINGS.strictness };
}

function rankMap(snapshot: Snapshot, weights: Record<string, number>): Record<string, number> {
  const result = computeIndex(snapshot, indexConfig(weights));
  const out: Record<string, number> = {};
  for (const row of selectVariants(result.ranked, "best")) out[row.model.id] = row.score;
  return out;
}

/** Normalized Kendall-tau distance over models present in both rankings. */
function tauDistance(a: Record<string, number>, b: Record<string, number>): number {
  const common = Object.keys(a).filter((id) => id in b);
  let discordant = 0, total = 0;
  for (let i = 0; i < common.length; i++) for (let j = i + 1; j < common.length; j++) {
    const x = common[i], y = common[j];
    const da = a[x] - a[y], db = b[x] - b[y];
    if (da === 0 || db === 0) continue;
    total++;
    if (da * db < 0) discordant++;
  }
  return total ? discordant / total : 0;
}

/** NEXT_PUBLIC_CONVEX_URL lives in .env.local for local runs; read it without dotenv. */
async function convexUrl(): Promise<string | undefined> {
  if (process.env.NEXT_PUBLIC_CONVEX_URL) return process.env.NEXT_PUBLIC_CONVEX_URL;
  try {
    const env = await readFile(path.resolve(".env.local"), "utf8");
    const line = env.split("\n").find((l) => l.startsWith("NEXT_PUBLIC_CONVEX_URL="));
    return line?.slice("NEXT_PUBLIC_CONVEX_URL=".length).trim().replace(/^"|"$/g, "");
  } catch { return undefined; }
}

async function topLineups(focus: FocusId): Promise<string[][]> {
  const url = await convexUrl();
  if (!url) return [];
  try {
    const { ConvexHttpClient } = await import("convex/browser");
    const { anyApi } = await import("convex/server");
    const client = new ConvexHttpClient(url);
    const rows = await client.query(anyApi.lineups.top, { focus, limit: 10 }) as { lineup: string[] }[];
    return rows.map((r) => r.lineup);
  } catch {
    return [];
  }
}

export async function buildLibrary(date?: string): Promise<void> {
  const snapshot: Snapshot = JSON.parse(gunzipSync(await readFile(path.join(SNAP_DIR, date ? `${date}.json.gz` : "latest.json.gz"))).toString("utf8"));
  const quality = benchmarkQuality(snapshot);
  const qMap = new Map(quality.map((q) => [q.id, q]));
  const benchmarks = snapshot.benchmarks.filter(eligible);
  const llmIds = new Set(snapshot.models.filter((m) => m.kind === "llm").map((m) => m.id));

  // Single-benchmark columns over the full pool — the surrogate's substrate.
  const columns: Record<string, Record<string, number>> = {};
  for (const b of benchmarks) columns[b.id] = rankMap(snapshot, { [b.id]: 100 });

  const mixes: MixLibrary["mixes"] = { capabilities: [], knowledge: [], "problem-solving": [], general: [] };
  for (const focus of FOCUSES) {
    const aff = new Map(benchmarks.map((b) => [b.id, affinity(qMap.get(b.id)!, focus, b)]));
    const totalAff = benchmarks.reduce((n, b) => n + (aff.get(b.id) ?? 0), 0);
    const draw = (rand: () => number, count: number): Benchmark[] => {
      const pool = benchmarks.filter((b) => (aff.get(b.id) ?? 0) > 0);
      const out: Benchmark[] = [];
      while (pool.length && out.length < count) {
        const total = pool.reduce((n, b) => n + (aff.get(b.id) ?? 0), 0) || totalAff;
        let x = rand() * total, k = 0;
        while (k < pool.length - 1 && (x -= aff.get(pool[k].id) ?? 0) > 0) k++;
        out.push(pool.splice(k, 1)[0]!);
      }
      return out;
    };
    const rand = rng(97 + focus.id.length * 131);
    const qualityOf = (weights: Record<string, number>) => { const sum = Object.values(weights).reduce((n, w) => n + w, 0) || 1; return Object.entries(weights).reduce((n, [id, w]) => n + (w / sum) * (aff.get(id) ?? 0), 0); };

    const candidates: { weights: Record<string, number>; ranking: Record<string, number>; quality: number }[] = [];
    for (let s = 0; s < SAMPLES; s++) {
      const picked = draw(rand, 4 + Math.floor(rand() * 5));
      const weights = Object.fromEntries(picked.map((b) => [b.id, LEVELS[Math.floor(rand() * LEVELS.length)]!]));
      if (!Object.keys(weights).length) continue;
      candidates.push({ weights, ranking: rankMap(snapshot, weights), quality: qualityOf(weights) });
    }
    // The hand-curated starter always leads the selection.
    const starterWeights = Object.fromEntries(Object.entries(focus.starter).filter(([id]) => aff.has(id)));
    const selected: typeof candidates = [{ weights: starterWeights, ranking: rankMap(snapshot, starterWeights), quality: qualityOf(starterWeights) }];
    for (const c of candidates.sort((a, b) => b.quality - a.quality)) {
      if (selected.length >= SELECTED) break;
      if (selected.every((s) => tauDistance(s.ranking, c.ranking) >= MIN_TAU_DISTANCE)) selected.push(c);
    }
    mixes[focus.id] = selected.map(({ weights, ranking }) => ({ weights, ranking }));

    // Common user lineups (when the dev deployment is reachable) get fitted and added.
    for (const lineup of await topLineups(focus.id)) {
      const target = lineup.filter((id) => llmIds.has(id));
      if (target.length < 2) continue;
      try {
        const done = await fitPriors(snapshot, target, () => {}, Object.fromEntries(quality.map((q) => [q.id, q.score])), 0, {}, { focus: focus.id, budgetMs: { soft: 20_000, hard: 25_000 } });
        mixes[focus.id].push({ weights: done.weights, ranking: Object.fromEntries(done.ranking.map((r) => [r.modelId, r.score])) });
      } catch { /* skip failed fits */ }
    }
    console.log(`library ${focus.id}: ${selected.length} mixes (${candidates.length} sampled)`);
  }

  const library: MixLibrary = { date: snapshot.date, settingsKey: settingsKey(LIBRARY_SETTINGS), columns, mixes };
  const gz = gzipSync(JSON.stringify(library));
  await mkdir(SNAP_DIR, { recursive: true });
  for (const name of [`${snapshot.date}.library.json.gz`, "latest.library.json.gz"]) {
    const temp = path.join(SNAP_DIR, `${name}.${process.pid}.tmp`);
    await writeFile(temp, gz);
    await rename(temp, path.join(SNAP_DIR, name));
  }
  console.log(`library ${snapshot.date}: ${(gz.length / 1024).toFixed(0)} KB gz`);
}

if (process.argv[1]?.endsWith("library.ts")) buildLibrary(opt("date")).catch((e) => { console.error(e); process.exit(1); });
