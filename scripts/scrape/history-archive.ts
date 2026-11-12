/**
 * Writes data/snapshots/history.bin.gz from the dated snapshots: the file /api/history reads (src/lib/history-archive.ts).
 * A generated file: `build.ts` writes it after each scrape, the build writes it from the checkout. It is not committed;
 * the scrape job publishes it to the data-live branch.
 *
 * Each date's digest (what the archive keeps of a snapshot) is cached in data/raw/history-digests, keyed by the snapshot
 * file's bytes and the code that makes digests. Parsing ~70 snapshots of ~20 MB took most of a scrape's build; now only a
 * changed file (today's) is parsed.
 * Usage: npx tsx scripts/scrape/history-archive.ts
 */
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { parseSnapshot } from "../../src/data/load";
import { encodeHistoryDigests, historyDigest, HISTORY_ARCHIVE, type HistoryDigest } from "../../src/lib/history-archive";
import { splitHy4Preview } from "./retain-catalog";

const SNAP_DIR = path.resolve("data/snapshots");
const CACHE_DIR = path.resolve("data/raw/history-digests");
/** The code a digest depends on: change any of it and every digest is made again. */
const CODE = ["src/lib/history-archive.ts", "src/data/columns.ts", "src/data/load.ts", "src/data/open-weights.ts", "src/data/categories.ts", "scripts/scrape/retain-catalog.ts", "scripts/scrape/history-archive.ts"];

async function codeKey(): Promise<string> {
  const h = createHash("sha1");
  const catalog = (await readdir(path.resolve("src/data/catalog")).catch(() => [] as string[])).filter((f) => f.endsWith(".ts")).sort().map((f) => `src/data/catalog/${f}`);
  for (const f of [...CODE, ...catalog]) h.update(f).update(await readFile(path.resolve(f)).catch(() => Buffer.alloc(0)));
  return h.digest("hex");
}

export async function writeHistoryArchive(): Promise<void> {
  const dates = (await readdir(SNAP_DIR).catch(() => [] as string[])).map((f) => f.match(/^(\d{4}-\d{2}-\d{2})\.json\.gz$/)?.[1]).filter((d): d is string => !!d).sort();
  const code = await codeKey();
  await mkdir(CACHE_DIR, { recursive: true }).catch(() => {});
  let parsed = 0;
  const read = async (date: string): Promise<HistoryDigest | null> => {
    let bytes: Buffer;
    try { bytes = await readFile(path.join(SNAP_DIR, `${date}.json.gz`)); } catch { return null; }
    const key = createHash("sha1").update(code).update(bytes).digest("hex"), cached = path.join(CACHE_DIR, `${date}.json.gz`);
    try {
      const hit = JSON.parse(gunzipSync(await readFile(cached)).toString("utf8")) as { key: string; digest: HistoryDigest };
      if (hit.key === key) return hit.digest;
    } catch { /* not cached yet */ }
    let digest: HistoryDigest;
    try { digest = historyDigest(splitHy4Preview(parseSnapshot(bytes))); } catch { return null; }
    parsed++;
    await writeFile(cached, gzipSync(JSON.stringify({ key, digest }), { level: 1 })).catch(() => {});
    return digest;
  };
  const file = await encodeHistoryDigests(dates, read);
  const temp = path.join(SNAP_DIR, `${HISTORY_ARCHIVE}.${process.pid}.tmp`);
  await writeFile(temp, file);
  await rename(temp, path.join(SNAP_DIR, HISTORY_ARCHIVE));
  console.log(`history archive: ${dates.length} dates (${parsed} parsed, ${dates.length - parsed} cached), ${(file.length / 1024).toFixed(0)} KB`);
}

if (process.argv[1]?.endsWith("history-archive.ts")) writeHistoryArchive().catch((e) => { console.error(e); process.exit(1); });
