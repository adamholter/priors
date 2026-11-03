import { gunzipSync, gzipSync } from "node:zlib";
import { columnsOf, effortRank, emptyColumns, fillPanelLogs, releaseMs, ROW_COUNTED, setBenchmarks, siblingKey, tierOf, type Columns } from "../data/columns";
import { aaOpenWeights, familyOpenWeights } from "../data/open-weights";
import type { Benchmark, Lab, Model, Snapshot, Variant } from "../data/types";

/**
 * Every dated snapshot, reduced to what a ranking reads and stored as one columnar file: `/api/history` walks it forward
 * instead of parsing a 22 MB snapshot per date. Scores are shared rows (a benchmark, a variant, a value); each date is a
 * patch of what changed from the day before. Written by `npm run scrape` and by the build; dates it lacks are read from
 * their snapshot, so a missing or stale file costs time, not correctness.
 */
export const HISTORY_ARCHIVE = "history.bin.gz";
const VERSION = 1;

type ModelRecord = Pick<Model, "id" | "name" | "labId" | "kind" | "releaseDate" | "priceTier" | "openWeights"> & { aaOpen?: boolean };
interface Header {
  version: number; dates: string[];
  benchIds: string[]; variantIds: string[];
  benches: Benchmark[]; models: ModelRecord[]; variants: Variant[]; labs: Lab[];
  /** Per date, in order: variant, model, benchmark and lab record counts. */
  counts: number[];
  /** Patch range of each date: patch i of date d is in patchStart[d]..patchStart[d + 1]. */
  patchStart: number[];
  rows: number; lists: number;
}

/** Keeps one record per distinct content. */
class Records<T> {
  list: T[] = []; at = new Map<string, number>();
  add(x: T) { const k = JSON.stringify(x); let i = this.at.get(k); if (i === undefined) { i = this.list.length; this.list.push(x); this.at.set(k, i); } return i; }
}
function internId(ids: string[], at: Map<string, number>, id: string) {
  let i = at.get(id);
  if (i === undefined) { i = ids.length; ids.push(id); at.set(id, i); }
  return i;
}

/** The fields a score depends on. Names, descriptions and sources stay in the snapshot. */
const slimBenchmark = (b: Benchmark): Benchmark => ({
  id: b.id, unit: b.unit, higherIsBetter: b.higherIsBetter, category: b.category, name: "", sourceId: "", url: "", description: "",
  ...(b.proxy !== undefined ? { proxy: b.proxy } : {}), ...(b.normalization ? { normalization: b.normalization } : {}), ...(b.versionPolicy ? { versionPolicy: b.versionPolicy } : {}),
  ...(b.estimationRoutes ? { estimationRoutes: b.estimationRoutes.map((r) => ({ sourceId: r.sourceId, factor: r.factor, method: r.method, evidenceId: "", ...(r.variantFactors ? { variantFactors: r.variantFactors } : {}) })) } : {}),
});

export async function encodeHistoryArchive(dates: string[], read: (date: string) => Promise<Snapshot | null>): Promise<Buffer> {
  const benchIds: string[] = [], benchAt = new Map<string, number>(), variantIds: string[] = [], variantAt = new Map<string, number>(), harnessAt = new Map<string, number>();
  const benches = new Records<Benchmark>(), models = new Records<ModelRecord>(), variants = new Records<Variant>(), labs = new Records<Lab>();
  const rowAt = new Map<string, number>(), rowValue: number[] = [], rowFlags: number[] = [], rowHarness: number[] = [];
  const patchVariant: number[] = [], patchBench: number[] = [], patchRow: number[] = [], patchStart = [0];
  const lists: number[] = [], counts: number[] = [], kept: string[] = [];
  let current = new Map<number, number>();
  for (const date of dates) {
    const snap = await read(date);
    if (!snap) continue;
    kept.push(date);
    const c = columnsOf(snap), aa = aaOpenWeights(snap);
    const v2 = c.variantIds.map((id) => internId(variantIds, variantAt, id)), b2 = c.benchIds.map((id) => internId(benchIds, benchAt, id));
    for (const v of snap.variants) lists.push(variants.add({ id: v.id, modelId: v.modelId, effort: v.effort }));
    for (const m of snap.models) { const open = aa.get(m.id); lists.push(models.add({ id: m.id, name: m.name, labId: m.labId, kind: m.kind, releaseDate: m.releaseDate, priceTier: m.priceTier, openWeights: m.openWeights, ...(open !== undefined ? { aaOpen: open } : {}) })); }
    for (const b of snap.benchmarks) lists.push(benches.add(slimBenchmark(b)));
    for (const l of snap.labs) lists.push(labs.add({ id: l.id, name: l.name, color: l.color }));
    counts.push(snap.variants.length, snap.models.length, snap.benchmarks.length, snap.labs.length);
    const next = new Map<number, number>();
    for (let v = 0; v < c.nv; v++) for (let b = 0; b < c.nb; b++) {
      const r = c.at[v * c.nb + b];
      if (r < 0) continue;
      const harness = c.rows[r].harness, h = harness === undefined ? 0 : (harnessAt.get(harness) ?? harnessAt.set(harness, harnessAt.size + 1).get(harness)!);
      const key = `${v2[v]},${b2[b]},${c.value[r]},${c.flags[r]},${h}`;
      let row = rowAt.get(key);
      if (row === undefined) { row = rowValue.length; rowAt.set(key, row); rowValue.push(c.value[r]); rowFlags.push(c.flags[r]); rowHarness.push(h); }
      const slot = v2[v] * 65536 + b2[b];
      next.set(slot, row);
      if (current.get(slot) !== row) { patchVariant.push(v2[v]); patchBench.push(b2[b]); patchRow.push(row); }
    }
    for (const slot of current.keys()) if (!next.has(slot)) { patchVariant.push(Math.floor(slot / 65536)); patchBench.push(slot % 65536); patchRow.push(-1); }
    current = next;
    patchStart.push(patchRow.length);
  }
  if (Math.max(benches.list.length, models.list.length, variants.list.length, labs.list.length, harnessAt.size) > 65535) throw new Error("History archive records overflow 16 bits");
  const nb = benchIds.length;
  const header: Header = { version: VERSION, dates: kept, benchIds, variantIds, benches: benches.list, models: models.list, variants: variants.list, labs: labs.list, counts, patchStart, rows: rowValue.length, lists: lists.length };
  const head = Buffer.from(JSON.stringify(header)), pad = (8 - ((4 + head.length) % 8)) % 8;
  const length = Buffer.alloc(4);
  length.writeUInt32LE(head.length);
  const bytes = (a: ArrayBufferView) => Buffer.from(a.buffer, a.byteOffset, a.byteLength);
  // Widest first, so every column lands on its alignment.
  return gzipSync(Buffer.concat([length, head, Buffer.alloc(pad),
    bytes(Float64Array.from(rowValue)), bytes(Int32Array.from(patchVariant, (v, i) => v * nb + patchBench[i])), bytes(Int32Array.from(patchRow)),
    bytes(Uint16Array.from(lists)), bytes(Uint16Array.from(rowHarness)), bytes(Uint8Array.from(rowFlags)),
  ]), { level: 9 });
}

export interface HistoryFrame { date: string; columns: Columns; labs: Lab[] }

export interface HistoryArchive {
  dates: string[];
  /** A walker for one request. `flags` are today's open-weights signals. `frame` is valid until the next call: read it before any await. */
  walk(flags: Map<string, boolean>): { frame(date: string): HistoryFrame | undefined };
}

export function decodeHistoryArchive(file: Buffer): HistoryArchive {
  const raw = gunzipSync(file), all = new Uint8Array(raw.length);
  all.set(raw); // on a fresh buffer: the typed views below need its alignment
  const headLength = new DataView(all.buffer).getUint32(0, true), header = JSON.parse(Buffer.from(all.buffer, 4, headLength).toString("utf8")) as Header;
  if (header.version !== VERSION) throw new Error("Unknown history archive version");
  const { dates, benchIds, variantIds, benches, models, variants, labs, counts, patchStart } = header;
  let at = 4 + headLength + ((8 - ((4 + headLength) % 8)) % 8);
  const take = <T>(make: new (b: ArrayBuffer, o: number, n: number) => T, n: number, width: number) => { const x = new make(all.buffer, at, n); at += n * width; return x; };
  const patches = patchStart[patchStart.length - 1];
  const value = take(Float64Array, header.rows, 8), patchSlot = take(Int32Array, patches, 4), patchRow = take(Int32Array, patches, 4);
  const lists = take(Uint16Array, header.lists, 2), harness = take(Uint16Array, header.rows, 2), flags = take(Uint8Array, header.rows, 1);
  const maxOf = (i: number) => { let m = 0; for (let k = i; k < counts.length; k += 4) m = Math.max(m, counts[k]); return m; };
  const c = emptyColumns(benchIds, variantIds, 0, maxOf(1), maxOf(0));
  c.value = value; c.harness = harness; c.flags = flags; c.panelLog = new Float64Array(header.rows);
  fillPanelLogs(c, header.rows);
  const nb = c.nb;

  // Per record, once: a date only copies these into the columns.
  const modelIds = new Map<string, number>();
  const recordModel = Int32Array.from(models, (m) => modelIds.get(m.id) ?? modelIds.set(m.id, modelIds.size).get(m.id)!);
  const llm = Uint8Array.from(models, (m) => (m.kind === "llm" ? 1 : 0)), ms = Float64Array.from(models, releaseMs), tier = Uint8Array.from(models, tierOf);
  const recordVariant = Int32Array.from(variants, (x) => c.variantIndex.get(x.id)!), variantRank = Int8Array.from(variants, (x) => effortRank(x.effort));
  const variantSiblings = Int32Array.from(variants, (x) => c.siblingIndex.get(siblingKey(x.modelId, x.id)) ?? -1);
  const variantModelId = Int32Array.from(variants, (x) => modelIds.get(x.modelId) ?? -1);
  const families = models.map((m) => familyOpenWeights(m.id));
  const modelAt = new Int32Array(modelIds.size);
  const listStart = [0];
  for (let d = 0; d < dates.length; d++) listStart.push(listStart[d] + counts[d * 4] + counts[d * 4 + 1] + counts[d * 4 + 2] + counts[d * 4 + 3]);

  let position = -1;
  const reset = () => { c.at.fill(-1); c.counted.fill(0); c.measured.fill(undefined); position = -1; };
  const advance = (d: number) => {
    for (let i = patchStart[d]; i < patchStart[d + 1]; i++) {
      const slot = patchSlot[i], row = patchRow[i], was = c.at[slot], b = slot % nb;
      if (was >= 0 && flags[was] & ROW_COUNTED) c.counted[b]--;
      if (row >= 0 && flags[row] & ROW_COUNTED) c.counted[b]++;
      c.at[slot] = row; c.measured[b] = undefined;
    }
  };
  const index = new Map(dates.map((date, i) => [date, i]));
  return {
    dates,
    walk(signals) {
      // applyOpenWeights: the source metadata, then today's signals, then the family rules, then what the snapshot said.
      const finals = models.map((m, i): Model => { const open = m.aaOpen ?? signals.get(m.id) ?? families[i]; return { ...m, reasoning: false, aliases: [], ...(open !== undefined ? { openWeights: open } : {}) }; });
      return {
        frame(date) {
          const d = index.get(date);
          if (d === undefined) return undefined;
          if (d < position || position < 0) reset();
          for (let i = position + 1; i <= d; i++) advance(i);
          position = d;
          const [nv, nm, nbenches, nl] = counts.slice(d * 4, d * 4 + 4);
          const varFrom = listStart[d], modelFrom = varFrom + nv, benchFrom = modelFrom + nm, labFrom = benchFrom + nbenches;
          modelAt.fill(-1);
          const dayModels = new Array<Model>(nm);
          for (let i = 0; i < nm; i++) {
            const r = lists[modelFrom + i];
            dayModels[i] = finals[r]; c.mLlm[i] = llm[r]; c.mReleaseMs[i] = ms[r]; c.mTier[i] = tier[r];
            modelAt[recordModel[r]] = i;
          }
          const dayVariants = new Array<Variant>(nv);
          for (let i = 0; i < nv; i++) {
            const r = lists[varFrom + i];
            dayVariants[i] = variants[r]; c.vIndex[i] = recordVariant[r]; c.vRank[i] = variantRank[r]; c.vSiblings[i] = variantSiblings[r];
            c.vModel[i] = variantModelId[r] >= 0 ? modelAt[variantModelId[r]] : -1;
          }
          c.variants = dayVariants; c.models = dayModels; c.date = date;
          const dayBenches = new Array<Benchmark>(nbenches);
          for (let i = 0; i < nbenches; i++) dayBenches[i] = benches[lists[benchFrom + i]];
          setBenchmarks(c, dayBenches);
          const dayLabs = new Array<Lab>(nl);
          for (let i = 0; i < nl; i++) dayLabs[i] = labs[lists[labFrom + i]];
          return { date, columns: c, labs: dayLabs };
        },
      };
    },
  };
}
