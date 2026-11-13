import { readRuntimeFile } from "@/lib/runtime-files";
import { gunzipSync } from "node:zlib";
import type { Snapshot } from "./types";
import type { MixLibrary } from "../onboarding/library";
import { canonicalizeSnapshot } from "./canonical-snapshot";
import { shareStrings } from "./share-strings";
import { parseTopLevel } from "./parse-snapshot";
import { withCatalog } from "./catalog";
import { decodeHistoryArchive, HISTORY_ARCHIVE, type HistoryArchive } from "../lib/history-archive";

/**
 * Where the live data comes from. The scrape job publishes each changed snapshot to the repo's `data-live`
 * branch (one commit, rewritten every time), not to `main`, so production reads the newest files from there
 * instead of from the build, and a data refresh never redeploys the site. Local runs and tests read the checkout;
 * `SNAPSHOT_BASE_URL` points anywhere else (empty turns it off).
 *
 * Freshness: after each publish the job writes the new data-live commit to Edge Config (`dataLive`, see
 * scripts/ops/data-pointer.mjs). Each instance reads that pointer at most every POINTER_TTL_MS and fetches files at that
 * commit (`raw.githubusercontent.com/<owner>/<repo>/<sha>/...`): those addresses never change, so neither GitHub's
 * 5-minute CDN cache nor ours can serve an old copy, and new data shows within seconds. Without a usable pointer
 * (no EDGE_CONFIG, a read error, or a pointer the job has not confirmed for POINTER_STALE_MS) it reads the branch and
 * keeps each file REMOTE_TTL_MS, as before.
 */
const REPO_RAW = "https://raw.githubusercontent.com/adamholter/priors";
const REMOTE_DEFAULT = `${REPO_RAW}/data-live/data/snapshots`;
export const remoteBase = () => (process.env.SNAPSHOT_BASE_URL ?? ((process.env.VERCEL || process.env.PRIORS_CLOUDFLARE === "1") ? REMOTE_DEFAULT : "")).replace(/\/$/, "");
const REMOTE_TTL_MS = 60_000;
/** Short, because a publish waits one of these before it clears the CDN (daily-scrape.sh point_site). */
const POINTER_TTL_MS = 8_000;
/** The job confirms the pointer every run (15 minutes); one unconfirmed for this long is not trusted. */
const POINTER_STALE_MS = 50 * 60_000;

interface DataPointer { sha: string; published?: string; checked?: string }
let pointer: { at: number; sha: string | null; pending?: Promise<string | null> } = { at: 0, sha: null };

/** The data-live commit to read, or null to read the branch. Never throws. */
export function liveCommit(now = Date.now()): Promise<string | null> {
  const conn = process.env.EDGE_CONFIG;
  if (!conn || remoteBase() !== REMOTE_DEFAULT) return Promise.resolve(null);
  if (now - pointer.at < POINTER_TTL_MS) return Promise.resolve(pointer.sha);
  if (pointer.pending) return pointer.pending;
  const pending = (async () => {
    try {
      const u = new URL(conn), token = u.searchParams.get("token");
      const res = await fetch(`${u.origin}${u.pathname}/item/dataLive`, { headers: token ? { authorization: `Bearer ${token}` } : {}, cache: "no-store", signal: AbortSignal.timeout(3000) });
      if (!res.ok) return null;
      const p = (await res.json()) as DataPointer;
      const checked = Date.parse(p.checked ?? p.published ?? "");
      return /^[0-9a-f]{40}$/.test(p.sha ?? "") && Number.isFinite(checked) && Date.now() - checked < POINTER_STALE_MS ? p.sha : null;
    } catch { return null; }
  })().then((sha) => { pointer = { at: Date.now(), sha }; return sha; });
  pointer = { ...pointer, pending };
  return pending;
}
/** Test hook: forget the cached pointer. */
export const resetLiveCommit = () => { pointer = { at: 0, sha: null }; };

async function fetchRemote(file: string, sha: string | null): Promise<Buffer | null> {
  const base = sha ? `${REPO_RAW}/${sha}/data/snapshots` : remoteBase();
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

/**
 * One remote file. Read at the pointer's commit it is kept until the pointer moves (that address never changes);
 * read from the branch it is kept for the TTL. When a refresh fails the last good copy keeps serving.
 */
function remoteCache<T>(parse: (raw: Buffer) => T) {
  const entries = new Map<string, { at: number; sha: string | null; value: T | null; pending?: Promise<T | null> }>();
  return async (file: string): Promise<T | null> => {
    const sha = await liveCommit();
    const hit = entries.get(file);
    if (hit && !hit.pending && (sha ? hit.sha === sha : !hit.sha && Date.now() - hit.at < REMOTE_TTL_MS)) return hit.value;
    if (hit?.pending && hit.sha === sha) return hit.pending;
    const pending = fetchRemote(file, sha).then((raw) => {
      let value: T | null = hit?.value ?? null, got = false;
      if (raw) try { value = parse(raw); got = true; } catch { /* keep the last good copy */ }
      entries.delete(file); // re-inserted below as the most recently used
      // A failed read at a new commit keeps the old copy but not the new commit, so the next request tries again.
      entries.set(file, { at: Date.now(), sha: got ? sha : (hit?.sha ?? null), value });
      while (entries.size > MAX_SNAPSHOTS) entries.delete(entries.keys().next().value!);
      return value;
    });
    entries.set(file, { at: hit?.at ?? 0, sha, value: hit?.value ?? null, pending });
    return pending;
  };
}
/** A snapshot file, parsed, with its identities repaired and its repeated strings shared (40% less memory). */
export const parseSnapshot = (raw: Buffer) => shareStrings(catalogued(canonicalizeSnapshot(parseTopLevel<Snapshot>(gunzipSync(raw)))));
/** Today's descriptions and categories on every snapshot, so a day saved before they were written reads the same as the live one. */
const catalogued = (s: Snapshot): Snapshot => ({ ...s, benchmarks: s.benchmarks.map(withCatalog) });
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
      try { return parseSnapshot(await readRuntimeFile(`data/snapshots/${file}`)); }
      catch { return null; }
    })();
    snapshots.set(file, p);
    while (snapshots.size > MAX_SNAPSHOTS) snapshots.delete(snapshots.keys().next().value!);
  }
  return p;
}

/** One snapshot by date, uncached: for walking every date without keeping them all in memory. */
export async function readSnapshot(date: string): Promise<Snapshot | null> {
  try { return parseSnapshot(await readRuntimeFile(`data/snapshots/${date}.json.gz`)); }
  catch { return null; }
}

const remoteArchive = remoteCache(decodeHistoryArchive);
let bundledArchive: Promise<HistoryArchive | null> | undefined;
/** Every dated snapshot in one columnar file (`src/lib/history-archive.ts`): the live copy, else the build's. Null when neither is there. */
export async function loadHistoryArchive(): Promise<HistoryArchive | null> {
  if (remoteBase()) { const live = await remoteArchive(HISTORY_ARCHIVE); if (live) return live; }
  return bundledArchive ??= readRuntimeFile(`data/snapshots/${HISTORY_ARCHIVE}`).then(decodeHistoryArchive).catch(() => null);
}

/** Load the precomputed mix library for a snapshot date, or null when absent. */
export async function loadMixLibrary(date?: string): Promise<MixLibrary | null> {
  const file = date ? `${date}.library.json.gz` : "latest.library.json.gz";
  // Today's dated file is rewritten all day and a build may not have it, so the live latest answers for today, as in `loadSnapshot`.
  if (remoteBase()) { const live = await remoteLibrary("latest.library.json.gz"); if (live && (!date || live.date === date)) return live; }
  try { return JSON.parse(gunzipSync(await readRuntimeFile(`data/snapshots/${file}`)).toString("utf8")) as MixLibrary; }
  catch { return null; }
}
