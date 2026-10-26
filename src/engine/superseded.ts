import type { RankedVariant } from "./index";

/** A model's line: its lab and its name with the version number blanked, so "GPT-6.1 Sol" and "GPT-6 Sol" share one. */
const VERSION = /(?<![\w.])(\d{1,2})(?:\.(\d{1,2}))?(?![\w.])/;

export function modelLine(labId: string, name: string): { key: string; version: number } | undefined {
  const m = VERSION.exec(name);
  if (!m) return undefined;
  return { key: `${labId}|${name.replace(VERSION, "#").toLowerCase()}`, version: Number(m[1]) + Number(m[2] ?? 0) / 100 };
}

/**
 * Models a default view leaves out: an older version of a line that a newer version has replaced and that
 * sits off the cost-vs-score frontier (none of its efforts is on it), so showing it only adds clutter.
 * Same lab, same name apart from the version number, and the newer one is no older by release date.
 * A model with no measured cost is never judged, and `keep` (highlighted models) is never dropped.
 */
export function supersededModelIds(ranked: RankedVariant[], keep: Iterable<string> = []): Set<string> {
  const kept = new Set(keep);
  const onFrontier = new Set(ranked.filter((r) => r.onFrontier).map((r) => r.model.id));
  const hasCost = new Set(ranked.filter((r) => r.costUsd != null).map((r) => r.model.id));
  const lines = new Map<string, Map<string, { version: number; releaseDate?: string }>>();
  for (const r of ranked) {
    const line = modelLine(r.model.labId, r.model.name);
    if (!line) continue;
    (lines.get(line.key) ?? lines.set(line.key, new Map()).get(line.key)!).set(r.model.id, { version: line.version, releaseDate: r.model.releaseDate });
  }
  const out = new Set<string>();
  for (const members of lines.values()) {
    for (const [id, me] of members) {
      if (kept.has(id) || onFrontier.has(id) || !hasCost.has(id)) continue;
      const replaced = [...members.values()].some((o) => o.version > me.version && (!o.releaseDate || !me.releaseDate || o.releaseDate >= me.releaseDate));
      if (replaced) out.add(id);
    }
  }
  return out;
}
