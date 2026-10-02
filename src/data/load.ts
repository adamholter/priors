import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import type { Snapshot } from "./types";
import type { MixLibrary } from "../onboarding/library";

const SNAP_DIR = path.resolve(process.cwd(), "data/snapshots");

/** List available snapshot dates (newest first). */
export async function listSnapshotDates(): Promise<string[]> {
  try {
    const files = await readdir(SNAP_DIR);
    return files.filter((f) => /^\d{4}-\d{2}-\d{2}\.json\.gz$/.test(f)).map((f) => f.slice(0, 10)).sort().reverse();
  } catch { return []; }
}

/** Load a snapshot by date, or the latest. Memoized: the gzip+JSON.parse is
 *  significant and /og renders a dozen card designs per open. */
const snapshots = new Map<string, Promise<Snapshot | null>>();
export function loadSnapshot(date?: string): Promise<Snapshot | null> {
  const file = date ? `${date}.json.gz` : "latest.json.gz";
  let p = snapshots.get(file);
  if (!p) {
    p = (async () => {
      try { return JSON.parse(gunzipSync(await readFile(path.join(SNAP_DIR, file))).toString("utf8")) as Snapshot; }
      catch { return null; }
    })();
    snapshots.set(file, p);
  }
  return p;
}

/** Load the precomputed mix library for a snapshot date, or null when absent. */
export async function loadMixLibrary(date?: string): Promise<MixLibrary | null> {
  const file = date ? `${date}.library.json.gz` : "latest.library.json.gz";
  try { return JSON.parse(gunzipSync(await readFile(path.join(SNAP_DIR, file))).toString("utf8")) as MixLibrary; }
  catch { return null; }
}
