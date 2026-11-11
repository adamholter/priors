import type { Benchmark } from "../data/types";
import type { IndexConfig } from "../engine";
import { isTaskMetricSource } from "../data/task-metrics";
import { decodeIndices, encodeIndex } from "./url";

/**
 * Benchmark version notices: when a benchmark a visitor's own index weights has a newer version in the snapshot
 * (`versionPolicy: { kind: "fresh", supersedes }`), offer to move the weight to it. Pure logic here; the toast is
 * `components/VersionNotices.tsx`. See docs/pages-and-sharing.md, "Benchmark version notices".
 */

export interface Upgrade { from: string; to: string }
/** One index that weights an old version. `scope` says where the index lives ("builder", "page"); `indexKey` names it there. */
export interface NoticeItem extends Upgrade { scope: string; indexKey: string; indexName: string; key: string }
export interface NoticeSource { scope: string; indices: IndexConfig[]; /** Builder ids are positional, so the builder keys by name. Default: id. */ keyOf?: (i: IndexConfig) => string }

export const NOTICES_OFF_KEY = "priors:version-notices";
export const NOTICES_DISMISSED_KEY = "priors:version-notices-dismissed";
/** Dismissals kept; the oldest go first. */
export const MAX_DISMISSED = 300;

/**
 * Old id to the newest version that replaces it, following `supersedes` links (4.0 -> 4.1 -> 4.2 ends at 4.2).
 * Only `fresh` versions count: a `fallback` version reads the old one for missing models, so the old one is not replaced.
 * An id two benchmarks both claim to supersede is ambiguous and left out.
 */
export function newestVersions(benchmarks: Pick<Benchmark, "id" | "versionPolicy">[]): Map<string, string> {
  const next = new Map<string, string>(), torn = new Set<string>();
  for (const b of benchmarks) {
    const old = b.versionPolicy?.kind === "fresh" ? b.versionPolicy.supersedes : undefined;
    if (!old || old === b.id) continue;
    if (next.has(old) && next.get(old) !== b.id) torn.add(old); else next.set(old, b.id);
  }
  for (const id of torn) next.delete(id);
  const newest = new Map<string, string>();
  for (const old of next.keys()) {
    let at = old;
    const seen = new Set([old]);
    while (next.has(at) && !seen.has(next.get(at)!)) { at = next.get(at)!; seen.add(at); }
    if (at !== old) newest.set(old, at);
  }
  return newest;
}

/** The upgrades one index needs: each weighted id with a newer version, unless the index already weights that newest version. */
export function indexUpgrades(index: IndexConfig, newest: Map<string, string>): Upgrade[] {
  const on = (id: string) => (index.weights[id] ?? 0) > 0;
  return Object.keys(index.weights).filter(on).flatMap((from) => {
    const to = newest.get(from);
    return to && !on(to) ? [{ from, to }] : [];
  });
}

export const noticeKey = (scope: string, indexKey: string, u: Upgrade) => `${scope}:${indexKey}:${u.from}>${u.to}`;

/** Every notice for the visitor's indices, minus the dismissed ones. A key names the index and the exact old -> new pair, so a later version notifies again. */
export function findNotices(sources: NoticeSource[], benchmarks: Pick<Benchmark, "id" | "versionPolicy">[], dismissed: ReadonlySet<string> = new Set()): NoticeItem[] {
  const newest = newestVersions(benchmarks), out: NoticeItem[] = [], seen = new Set<string>();
  for (const { scope, indices, keyOf = (i: IndexConfig) => i.id } of sources) for (const index of indices) {
    const indexKey = keyOf(index);
    for (const u of indexUpgrades(index, newest)) {
      const key = noticeKey(scope, indexKey, u);
      if (dismissed.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.push({ ...u, scope, indexKey, indexName: index.name, key });
    }
  }
  return out;
}

/**
 * The index with each old id moved to its new id: the weight (added to the new id's when two old versions
 * meet there, so the family keeps its share), `required` and `optional`, and a cost or time source when the
 * new id is one. The weight keeps its place in the mix. Everything else is unchanged.
 */
export function upgradeIndex(index: IndexConfig, upgrades: Upgrade[]): IndexConfig {
  const to = new Map(upgrades.filter((u) => (index.weights[u.from] ?? 0) > 0 || index.required.includes(u.from)).map((u) => [u.from, u.to]));
  if (!to.size) return index;
  const rename = (id: string) => to.get(id) ?? id;
  const weights: Record<string, number> = {};
  for (const [id, w] of Object.entries(index.weights)) { const k = rename(id); weights[k] = k in weights ? weights[k] + w : w; }
  const ids = (list: string[]) => [...new Set(list.map(rename))];
  const source = <S extends string | undefined>(s: S): S => (s && to.has(s) && isTaskMetricSource(to.get(s)!) ? to.get(s) as S : s);
  return {
    ...index, weights, required: ids(index.required),
    ...(index.optional ? { optional: ids(index.optional) } : {}),
    ...(index.costSource ? { costSource: source(index.costSource) } : {}),
    ...(index.timeSource ? { timeSource: source(index.timeSource) } : {}),
  };
}

/** Per index key, the upgrades of one scope's notices: what a source's save needs. */
export function upgradesByIndex(items: NoticeItem[], scope: string): Map<string, Upgrade[]> {
  const out = new Map<string, Upgrade[]>();
  for (const i of items) if (i.scope === scope) out.set(i.indexKey, [...(out.get(i.indexKey) ?? []), { from: i.from, to: i.to }]);
  return out;
}

/** "4.0" when the old name is the new one with a different last word (Terminal-Bench 4.0 -> 4.1), else the old name in full. */
export function versionLabel(from: string, to: string): string {
  const a = from.trim().split(/\s+/), b = to.trim().split(/\s+/);
  return a.length > 1 && a.length === b.length && a.slice(0, -1).join(" ") === b.slice(0, -1).join(" ") ? a[a.length - 1] : from;
}

const list = (names: string[]) => names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
const quoted = (names: string[]) => names.length <= 3 ? list(names.map((n) => `“${n}”`)) : `${names.slice(0, 2).map((n) => `“${n}”`).join(", ")} and ${names.length - 2} more`;

/** The toast's two sentences, in plain words. Several indices or benchmarks share one notice. */
export function noticeCopy(items: NoticeItem[], benchmarks: Pick<Benchmark, "id" | "name">[]): { lead: string; detail: string } {
  const name = new Map(benchmarks.map((b) => [b.id, b.name])), nameOf = (id: string) => name.get(id) ?? id;
  const targets = [...new Set(items.map((i) => i.to))], froms = [...new Set(items.map((i) => i.from))];
  const indexNames = [...new Set(items.map((i) => i.indexName))];
  const uses = `Your ${indexNames.length === 1 ? "index" : "indexes"} ${quoted(indexNames)} ${indexNames.length === 1 ? "uses" : "use"}`;
  if (targets.length === 1) {
    const to = nameOf(targets[0]);
    return { lead: `${to} is out.`, detail: `${uses} ${froms.length === 1 ? versionLabel(nameOf(froms[0]), to) : "an older version"}.` };
  }
  return { lead: `New versions are out: ${list(targets.map(nameOf))}.`, detail: `${uses} older ones.` };
}

/**
 * The builder's saved indices (`priors:indices`) when the page shows them: the address carries no index (they are
 * restored) or the same ones (a reload of the visitor's own address). `null` when the address carries other indices:
 * a link someone shared, or a fit just made in the onboarding. Compared through the codec, as a set.
 */
export function ownSavedIndices(saved: string[], linked: string[]): IndexConfig[] | null {
  const own = decodeIndices(saved);
  if (!linked.length) return own;
  const sig = (list: IndexConfig[]) => [...new Set(list.map((i) => encodeIndex(i)))].sort().join("\n");
  return sig(own) === sig(decodeIndices(linked)) ? own : null;
}
