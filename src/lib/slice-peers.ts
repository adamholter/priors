import type { Snapshot } from "@/data/types";
import { computeIndex, rankingRows } from "@/engine";
import { formatBenchValue } from "./benchmark-format";
import { benchmarkIndex, benchmarkSnapshot, benchmarkView } from "./benchmark-page";
import type { Peer, Rel, SlicePeers } from "./benchmark-slices";

/** Parsed snapshots are shared between requests, so a sibling board is ranked once per snapshot: every page of a family reuses the others' work. */
const cache = new WeakMap<Snapshot, Map<string, Peer | null>>();

/** One board ranked the way its own page ranks it: the top five (best setting of each model) and the result count. */
function peerOf(snapshot: Snapshot, id: string, color: Map<string, string>): Peer | null {
  const b = snapshot.benchmarks.find((x) => x.id === id);
  if (!b) return null;
  try {
    const small = benchmarkSnapshot(snapshot, id), config = benchmarkIndex(small, id);
    const ranked = computeIndex(small, config, benchmarkView(small, id)).ranked;
    const top = rankingRows(ranked, config).slice(0, 5).map((r) => {
      const raw = r.values[0]?.raw ?? r.score;
      return { id: r.model.id, name: r.model.name, labId: r.model.labId, color: color.get(r.model.labId), text: formatBenchValue(b, raw), raw };
    });
    // Models, not model-and-effort rows: the page header counts models too.
    return { n: new Set(ranked.map((r) => r.model.id)).size, top };
  } catch { return null; } // a board that cannot be ranked simply has no leader
}

/** The leaders of every sibling board (category slices and other versions) a benchmark page's pickers name. */
export function slicePeers(snapshot: Snapshot, rel: { family: Rel[]; versions: Rel[] }): SlicePeers {
  let known = cache.get(snapshot);
  if (!known) cache.set(snapshot, known = new Map());
  const color = new Map(snapshot.labs.map((l) => [l.id, l.color]));
  const out: SlicePeers = {};
  for (const { id } of [...rel.family, ...rel.versions]) {
    if (id in out) continue;
    let peer = known.get(id);
    if (peer === undefined) known.set(id, peer = peerOf(snapshot, id, color));
    if (peer) out[id] = peer;
  }
  return out;
}
