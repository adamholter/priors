import type { Observation, Snapshot } from "./types";

/**
 * The browser's snapshot on the wire. Each observation names its benchmark, variant and source page by an
 * index into one shared list (34k observations name about 360 benchmarks, 1,700 variants and 1,200 pages)
 * and drops the scrape time, which the browser never reads. Unpacking points every observation at those
 * shared strings instead of a copy of its own: JSON.parse makes a new string for every value, so the parsed
 * snapshot takes about 40% less memory, and the download is smaller too.
 */
type Row = Omit<Observation, "benchmarkId" | "variantId" | "sourceUrl" | "observedAt"> & { b: number; v: number; u: number };
export interface PackedSnapshot extends Omit<Snapshot, "observations"> {
  observations?: undefined;
  packed: { benchmarks: string[]; variants: string[]; urls: string[]; rows: Row[] };
}

export function packSnapshot(snapshot: Snapshot): PackedSnapshot {
  const lists = { benchmarks: [] as string[], variants: [] as string[], urls: [] as string[] };
  const index = { benchmarks: new Map<string, number>(), variants: new Map<string, number>(), urls: new Map<string, number>() };
  const at = (k: keyof typeof lists, s: string) => { let i = index[k].get(s); if (i === undefined) { i = lists[k].length; lists[k].push(s); index[k].set(s, i); } return i; };
  const rows = snapshot.observations.map(({ benchmarkId, variantId, sourceUrl, observedAt: _observedAt, ...rest }): Row => {
    void _observedAt;
    return { b: at("benchmarks", benchmarkId), v: at("variants", variantId), u: at("urls", sourceUrl), ...rest };
  });
  const { observations: _observations, ...rest } = snapshot;
  void _observations;
  return { ...rest, packed: { ...lists, rows } };
}

/** A packed snapshot back to the usual shape, sharing its strings. A plain snapshot passes through. */
export function unpackSnapshot(s: PackedSnapshot | Snapshot): Snapshot {
  if (!("packed" in s) || !s.packed) return s as Snapshot;
  const { packed: { benchmarks, variants, urls, rows }, ...rest } = s;
  // Short repeated strings inside a row (harness names, AA model ids) share one copy too.
  const pool = new Map<string, string>();
  const shared = (x: string | undefined) => { if (x === undefined) return x; const y = pool.get(x); if (y !== undefined) return y; pool.set(x, x); return x; };
  const observations = rows.map((row): Observation => {
    const o = { benchmarkId: benchmarks[row.b], variantId: variants[row.v], value: row.value, observedAt: "", sourceUrl: urls[row.u] } as Observation & Record<string, unknown>;
    // The rest as published, in the row's own order (so rows with the same fields share one object shape).
    for (const k in row) {
      if (k === "b" || k === "v" || k === "u" || k === "value") continue;
      const x = (row as Record<string, unknown>)[k];
      o[k] = k === "harness" || k === "sourceModelId" || k === "note" ? shared(x as string) : x;
    }
    return o;
  });
  return { ...rest, observations } as Snapshot;
}

/** Read `/api/snapshot?view=core` (packed) into a snapshot. */
export async function readCoreSnapshot(response: Response): Promise<Snapshot> {
  return unpackSnapshot(((await response.json()) as { snapshot: PackedSnapshot }).snapshot);
}
