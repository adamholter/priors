import { readFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import type { Snapshot } from "./types";
import type { MixLibrary } from "../onboarding/library";
import { canonicalizeSnapshot } from "./canonical-snapshot";

const SNAP_DIR = path.resolve(process.cwd(), "data/snapshots");

/** Load a snapshot by date, or the latest. Memoized: the gzip+JSON.parse is
 *  significant and /og renders a dozen card designs per open. */
const snapshots = new Map<string, Promise<Snapshot | null>>();
export function snapshotFileForDate(date?: string): string {
  if (!date) return "latest.json.gz";
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? `${date}.json.gz` : "latest.json.gz";
}
export function loadSnapshot(date?: string): Promise<Snapshot | null> {
  const file = snapshotFileForDate(date);
  let p = snapshots.get(file);
  if (!p) {
    p = (async () => {
      try { return canonicalizeSnapshot(JSON.parse(gunzipSync(await readFile(path.join(SNAP_DIR, file))).toString("utf8")) as Snapshot); }
      catch { return null; }
    })();
    snapshots.set(file, p);
  }
  return p;
}

/** One snapshot by date, uncached: for walking every date without keeping them all in memory. */
export async function readSnapshot(date: string): Promise<Snapshot | null> {
  try { return canonicalizeSnapshot(JSON.parse(gunzipSync(await readFile(path.join(SNAP_DIR, `${date}.json.gz`))).toString("utf8")) as Snapshot); }
  catch { return null; }
}

/** Load the precomputed mix library for a snapshot date, or null when absent. */
export async function loadMixLibrary(date?: string): Promise<MixLibrary | null> {
  const file = date ? `${date}.library.json.gz` : "latest.library.json.gz";
  try { return JSON.parse(gunzipSync(await readFile(path.join(SNAP_DIR, file))).toString("utf8")) as MixLibrary; }
  catch { return null; }
}
