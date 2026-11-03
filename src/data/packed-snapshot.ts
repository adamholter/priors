import type { Observation, Snapshot } from "./types";

/**
 * The browser's snapshot on the wire, as columns rather than one object per observation (36k objects repeating
 * their field names). Benchmark, variant and source page are indexes into shared lists; everything else is a sparse
 * column holding only the rows that have the field, with repeated strings kept once. The scrape time is dropped: the
 * browser never reads it. Unpacking points every observation at those shared strings, so the parsed snapshot takes
 * less memory as well as less download.
 */
type Extra = Omit<Observation, "benchmarkId" | "variantId" | "sourceUrl" | "observedAt" | "value">;
/** `at`: row positions, each as the gap from the one before. `pool`: when set, `values` are indexes into it. */
interface Column { at: number[]; values: unknown[]; pool?: string[] }
export interface PackedSnapshot extends Omit<Snapshot, "observations"> {
  observations?: undefined;
  packed: { benchmarks: string[]; variants: string[]; urls: string[]; b: number[]; v: number[]; u: number[]; value: number[]; columns: Record<string, Column> };
}

export function packSnapshot(snapshot: Snapshot): PackedSnapshot {
  const lists = { benchmarks: [] as string[], variants: [] as string[], urls: [] as string[] };
  const index = { benchmarks: new Map<string, number>(), variants: new Map<string, number>(), urls: new Map<string, number>() };
  const at = (k: keyof typeof lists, s: string) => { let i = index[k].get(s); if (i === undefined) { i = lists[k].length; lists[k].push(s); index[k].set(s, i); } return i; };
  const out = { b: [] as number[], v: [] as number[], u: [] as number[], value: [] as number[] };
  const columns = new Map<string, { at: number[]; values: unknown[]; last: number }>();
  snapshot.observations.forEach(({ benchmarkId, variantId, sourceUrl, value, observedAt: _observedAt, ...rest }, row) => {
    void _observedAt;
    out.b.push(at("benchmarks", benchmarkId)); out.v.push(at("variants", variantId)); out.u.push(at("urls", sourceUrl)); out.value.push(value);
    for (const k in rest) {
      const x = (rest as Record<string, unknown>)[k];
      if (x === undefined) continue;
      let c = columns.get(k);
      if (!c) columns.set(k, c = { at: [], values: [], last: 0 });
      c.at.push(row - c.last); c.last = row; c.values.push(x);
    }
  });
  const packedColumns: Record<string, Column> = {};
  for (const [k, c] of columns) {
    if (c.values.every((x) => typeof x === "string")) {
      const pool: string[] = [], seen = new Map<string, number>();
      const values = (c.values as string[]).map((x) => { let i = seen.get(x); if (i === undefined) { i = pool.length; pool.push(x); seen.set(x, i); } return i; });
      packedColumns[k] = { at: c.at, values, pool };
    } else packedColumns[k] = { at: c.at, values: c.values };
  }
  const { observations: _observations, ...rest } = snapshot;
  void _observations;
  return { ...rest, packed: { ...lists, ...out, columns: packedColumns } };
}

/** A packed snapshot back to the usual shape, sharing its strings. A plain snapshot passes through. */
export function unpackSnapshot(s: PackedSnapshot | Snapshot): Snapshot {
  if (!("packed" in s) || !s.packed) return s as Snapshot;
  const { packed: { benchmarks, variants, urls, b, v, u, value, columns }, ...rest } = s;
  const observations = value.map((x, i) => ({ benchmarkId: benchmarks[b[i]], variantId: variants[v[i]], value: x, observedAt: "", sourceUrl: urls[u[i]] }) as Observation & Extra & Record<string, unknown>);
  for (const k in columns) {
    const { at, values, pool } = columns[k];
    let row = 0;
    for (let i = 0; i < at.length; i++) { row += at[i]; observations[row][k] = pool ? pool[values[i] as number] : values[i]; }
  }
  return { ...rest, observations } as Snapshot;
}

/** Read `/api/snapshot?view=core` (packed) into a snapshot. */
export async function readCoreSnapshot(response: Response): Promise<Snapshot> {
  return unpackSnapshot(((await response.json()) as { snapshot: PackedSnapshot }).snapshot);
}
