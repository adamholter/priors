/**
 * Writes data/snapshots/history.bin.gz from the dated snapshots: the file /api/history reads (src/lib/history-archive.ts).
 * A generated file: `build.ts` writes it after each scrape, the build writes it from the checkout. It is not committed;
 * the scrape job publishes it to the data-live branch.
 * Usage: npx tsx scripts/scrape/history-archive.ts
 */
import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseSnapshot } from "../../src/data/load";
import { encodeHistoryArchive, HISTORY_ARCHIVE } from "../../src/lib/history-archive";
import { splitHy4Preview } from "./retain-catalog";

const SNAP_DIR = path.resolve("data/snapshots");

export async function writeHistoryArchive(): Promise<void> {
  const dates = (await readdir(SNAP_DIR).catch(() => [] as string[])).map((f) => f.match(/^(\d{4}-\d{2}-\d{2})\.json\.gz$/)?.[1]).filter((d): d is string => !!d).sort();
  const file = await encodeHistoryArchive(dates, async (date) => { try { return splitHy4Preview(parseSnapshot(await readFile(path.join(SNAP_DIR, `${date}.json.gz`)))); } catch { return null; } });
  const temp = path.join(SNAP_DIR, `${HISTORY_ARCHIVE}.${process.pid}.tmp`);
  await writeFile(temp, file);
  await rename(temp, path.join(SNAP_DIR, HISTORY_ARCHIVE));
  console.log(`history archive: ${dates.length} dates, ${(file.length / 1024).toFixed(0)} KB`);
}

if (process.argv[1]?.endsWith("history-archive.ts")) writeHistoryArchive().catch((e) => { console.error(e); process.exit(1); });
