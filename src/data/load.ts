import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import type { Snapshot } from "./types";

const SNAP_DIR = path.resolve(process.cwd(), "data/snapshots");

/** List available snapshot dates (newest first). */
export async function listSnapshotDates(): Promise<string[]> {
  try {
    const files = await readdir(SNAP_DIR);
    return files.filter((f) => /^\d{4}-\d{2}-\d{2}\.json\.gz$/.test(f)).map((f) => f.slice(0, 10)).sort().reverse();
  } catch { return []; }
}

/** Load a snapshot by date, or the latest. */
export async function loadSnapshot(date?: string): Promise<Snapshot | null> {
  try {
    const file = date ? `${date}.json.gz` : "latest.json.gz";
    return JSON.parse(gunzipSync(await readFile(path.join(SNAP_DIR, file))).toString("utf8")) as Snapshot;
  } catch { return null; }
}
