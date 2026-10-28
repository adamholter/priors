import { readFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import type { Snapshot } from "./types";
import type { MixLibrary } from "../onboarding/library";
import { canonicalizeSnapshot } from "./canonical-snapshot";
import { shareStrings } from "./share-strings";

const SNAP_DIR = path.resolve(process.cwd(), "data/snapshots");

/**
 * Where the live data comes from. The scrape job publishes each changed snapshot to the repo's `data-live`
 * branch (one commit, rewritten every time), not to `main`, so production reads the newest files from there
 * instead of from the build, and a data refresh never redeploys the site. A few minutes old at worst. Local runs and
 * tests read the checkout; `SNAPSHOT_BASE_URL` points anywhere else (empty turns it off).
 */
const REMOTE_DEFAULT = "https://raw.githubusercontent.com/adamholter/priors/data-live/data/snapshots";
export const remoteBase = () => (process.env.SNAPSHOT_BASE_URL ?? (process.env.VERCEL ? REMOTE_DEFAULT : "")).replace(/\/$/, "");
const REMOTE_TTL_MS = 5 * 60_000;

async function fetchRemote(file: string): Promise<Buffer | null> {
  const base = remoteBase();
  if (!base) return null;
  try {
    const res = await fetch(`${base}/${file}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  } catch { return null; }
}

const WINDOW_DAYS = 30;
/** Only a dated file from the last month can be live: anything else is not worth a network call or a cache slot. */
function withinLiveWindow(file: string, liveDate: string): boolean {
  const day = Date.parse(`${file.slice(0, 10)}T00:00:00Z`), live = Date.parse(`${liveDate}T00:00:00Z`);
  return Number.isFinite(day) && Number.isFinite(live) && day <= live && live - day <= WINDOW_DAYS * 86_400_000;
}
/** Parsed snapshots are about 15 MB each, so only the few most recently used stay in memory: the live one and whichever dated links are being opened. */
const MAX_SNAPSHOTS = 6;

/** One remote file, kept for the TTL; when a refresh fails the last good copy keeps serving. */
function remoteCache<T>(parse: (raw: Buffer) => T) {
  const entries = new Map<string, { at: number; value: T | null; pending?: Promise<T | null> }>();
  return (file: string): Promise<T | null> => {
    const hit = entries.get(file);
    if (hit && Date.now() - hit.at < REMOTE_TTL_MS) return Promise.resolve(hit.value);
    if (hit?.pending) return hit.pending;
    const pending = fetchRemote(file).then((raw) => {
      let value: T | null = hit?.value ?? null;
      if (raw) try { value = parse(raw); } catch { /* keep the last good copy */ }
      entries.delete(file); // re-inserted below as the most recently used
      entries.set(file, { at: Date.now(), value });
      while (entries.size > MAX_SNAPSHOTS) entries.delete(entries.keys().next().value!);
      return value;
    });
    entries.set(file, { at: hit?.at ?? 0, value: hit?.value ?? null, pending });
    return pending;
  };
}
/** A snapshot file, parsed, with its identities repaired and its repeated strings shared (40% less memory). */
const parseSnapshot = (raw: Buffer) => shareStrings(canonicalizeSnapshot(JSON.parse(gunzipSync(raw).toString("utf8")) as Snapshot));
const remoteSnapshot = remoteCache(parseSnapshot);
const remoteLibrary = remoteCache((raw) => JSON.parse(gunzipSync(raw).toString("utf8")) as MixLibrary);

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
  if (!remoteBase()) return bundledSnapshot(file);
  return remoteSnapshot("latest.json.gz").then(async (live) => {
    // Today's dated file is rewritten all day, so a build's copy of it is old: the live latest is today's.
    if (file === "latest.json.gz" || (live && file === `${live.date}.json.gz`)) return live ?? bundledSnapshot("latest.json.gz");
    return (await bundledSnapshot(file)) ?? (live && withinLiveWindow(file, live.date) ? remoteSnapshot(file) : null);
  });
}

function bundledSnapshot(file: string): Promise<Snapshot | null> {
  let p = snapshots.get(file);
  if (p) { snapshots.delete(file); snapshots.set(file, p); } // most recently used last
  else {
    p = (async () => {
      try { return parseSnapshot(await readFile(path.join(SNAP_DIR, file))); }
      catch { return null; }
    })();
    snapshots.set(file, p);
    while (snapshots.size > MAX_SNAPSHOTS) snapshots.delete(snapshots.keys().next().value!);
  }
  return p;
}

/** One snapshot by date, uncached: for walking every date without keeping them all in memory. */
export async function readSnapshot(date: string): Promise<Snapshot | null> {
  try { return parseSnapshot(await readFile(path.join(SNAP_DIR, `${date}.json.gz`))); }
  catch { return null; }
}

/** Load the precomputed mix library for a snapshot date, or null when absent. */
export async function loadMixLibrary(date?: string): Promise<MixLibrary | null> {
  const file = date ? `${date}.library.json.gz` : "latest.library.json.gz";
  if (!date && remoteBase()) { const live = await remoteLibrary(file); if (live) return live; }
  try { return JSON.parse(gunzipSync(await readFile(path.join(SNAP_DIR, file))).toString("utf8")) as MixLibrary; }
  catch { return null; }
}
