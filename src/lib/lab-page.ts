import type { Benchmark, Snapshot } from "@/data/types";
import { categoryName } from "@/data/categories";
import { labLogo } from "@/data/lab-logos";
import { formatBenchValue } from "./benchmark-format";
import { modelDirectory, type ModelItem } from "./model-directory";

/** One benchmark a lab places on: its best model there and where that puts the lab among every lab the benchmark measures. */
export interface LabStanding {
  benchmarkId: string; name: string; category: string;
  /** 1 = the lab's best model beats every other lab's best. */
  place: number; labs: number;
  /** Another lab has the same value at this place. */
  tied?: boolean;
  model: { id: string; name: string }; value: string;
  /** The lab ahead of it (absent when it leads), so a second place says who it trails. */
  ahead?: { labId: string; name: string; model: string; value: string };
}

export interface LabSummary { id: string; name: string; color: string; models: number; ranked: number; best?: { rank: number; id: string; name: string }; open: number; latest?: { id: string; name: string; date: string }; leads: number }

export interface LabPageData {
  lab: LabSummary;
  items: ModelItem[];
  indexName: string;
  /** Benchmarks where the lab is first, then second and third, each list newest board first within a place. */
  standings: LabStanding[];
  /** Other labs, for the switcher: the ones with a ranked model, best rank first. */
  peers: LabSummary[];
}

const cache = new WeakMap<Snapshot, { summaries: LabSummary[]; standings: Map<string, LabStanding[]>; items: Map<string, ModelItem[]>; indexName: string }>();

/**
 * A benchmark counts toward a lab's standings when it is a current, measured board in its own right: not a proxy (a price list),
 * not another view of a main board, not one the publisher stopped updating, not an older version a newer one replaced, and not a cost, speed,
 * reliability, safety or behavior table, where "first" means cheapest, fastest or least likely to fail or refuse rather than most capable. It needs four labs on it for a place to mean something.
 */
function countedBenchmarks(snapshot: Snapshot): Benchmark[] {
  const replaced = new Set<string>();
  for (const b of snapshot.benchmarks) {
    if (b.versionPolicy?.kind === "fallback") replaced.add(b.versionPolicy.fallbackTo);
    if (b.versionPolicy?.kind === "fresh" && b.versionPolicy.supersedes) replaced.add(b.versionPolicy.supersedes);
  }
  return snapshot.benchmarks.filter((b) => !b.proxy && !b.variantOf && !b.stoppedPublishing && !replaced.has(b.id) && !SKIP.has(b.category) && b.unit !== "usd" && b.unit !== "seconds");
}

const MIN_LABS = 4;
const SKIP = new Set(["cost", "speed", "reliability", "safety", "behavior"]);

function build(snapshot: Snapshot) {
  const hit = cache.get(snapshot);
  if (hit) return hit;
  const { items: all, indexName } = modelDirectory(snapshot);
  const items = new Map<string, ModelItem[]>();
  for (const x of all) (items.get(x.labId) ?? items.set(x.labId, []).get(x.labId)!).push(x);
  // The directory files a model under its real lab (Nemotron under NVIDIA even where a board says Other), so standings follow it.
  const labOf = new Map(all.map((x) => [x.id, x.labId])), nameOf = new Map(all.map((x) => [x.id, x.name]));
  const labName = new Map(all.map((x) => [x.labId, x.labName]));
  const modelOf = new Map(snapshot.variants.map((v) => [v.id, v.modelId]));
  const counted = countedBenchmarks(snapshot), byId = new Map(counted.map((b) => [b.id, b]));
  // Best value per benchmark per model, any effort.
  const best = new Map<string, Map<string, number>>();
  for (const o of snapshot.observations) {
    const b = byId.get(o.benchmarkId);
    if (!b || !Number.isFinite(o.value)) continue;
    const model = modelOf.get(o.variantId) ?? modelOf.get(o.variantId.split("~")[0]);
    if (!model || !labOf.has(model)) continue;
    const per = best.get(b.id) ?? best.set(b.id, new Map()).get(b.id)!, was = per.get(model);
    if (was == null || (b.higherIsBetter ? o.value > was : o.value < was)) per.set(model, o.value);
  }
  const standings = new Map<string, LabStanding[]>();
  for (const [bid, per] of best) {
    const b = byId.get(bid)!;
    // Each lab's best model on this board, best lab first.
    const top = new Map<string, { model: string; value: number }>();
    for (const [model, value] of per) {
      const lab = labOf.get(model)!;
      if (lab === "other") continue;
      const was = top.get(lab);
      if (!was || (b.higherIsBetter ? value > was.value : value < was.value)) top.set(lab, { model, value });
    }
    if (top.size < MIN_LABS) continue;
    const order = [...top.entries()].sort((x, y) => (b.higherIsBetter ? y[1].value - x[1].value : x[1].value - y[1].value));
    order.forEach(([lab, { model, value }], i) => {
      // Ties share a place: a lab level with the one ahead is not behind it.
      let place = i + 1;
      while (place > 1 && order[place - 2][1].value === value) place--;
      if (place > 3) return;
      const ahead = place > 1 ? order[place - 2] : undefined;
      const tied = order.some(([other, o]) => other !== lab && o.value === value);
      const row: LabStanding = {
        benchmarkId: bid, name: b.shortName ?? b.name, category: categoryName(b.category), place, labs: top.size, ...(tied ? { tied } : {}),
        model: { id: model, name: nameOf.get(model) ?? model }, value: formatBenchValue(b, value),
        ...(ahead ? { ahead: { labId: ahead[0], name: labName.get(ahead[0]) ?? ahead[0], model: nameOf.get(ahead[1].model) ?? ahead[1].model, value: formatBenchValue(b, ahead[1].value) } } : {}),
      };
      (standings.get(lab) ?? standings.set(lab, []).get(lab)!).push(row);
    });
  }
  const updated = new Map(snapshot.benchmarks.map((b) => [b.id, b.lastUpdated ?? ""]));
  for (const list of standings.values()) list.sort((x, y) => x.place - y.place || y.labs - x.labs || (updated.get(y.benchmarkId) ?? "").localeCompare(updated.get(x.benchmarkId) ?? "") || x.name.localeCompare(y.name));
  const labs = new Map(snapshot.labs.map((l) => [l.id, l]));
  const summaries = [...items.entries()].filter(([id]) => id !== "other").map(([id, list]): LabSummary => {
    const ranked = list.filter((x) => x.rank != null).sort((x, y) => x.rank! - y.rank!);
    const dated = list.filter((x) => x.releaseDate).sort((x, y) => y.releaseDate!.localeCompare(x.releaseDate!));
    return {
      id, name: list[0].labName, color: labs.get(id)?.color ?? list[0].labColor, models: list.length, ranked: ranked.length,
      ...(ranked[0] ? { best: { rank: ranked[0].rank!, id: ranked[0].id, name: ranked[0].name } } : {}),
      open: list.filter((x) => x.openWeights).length,
      ...(dated[0] ? { latest: { id: dated[0].id, name: dated[0].name, date: dated[0].releaseDate! } } : {}),
      leads: (standings.get(id) ?? []).filter((s) => s.place === 1 && !s.tied).length,
    };
  }).sort((x, y) => (x.best?.rank ?? Infinity) - (y.best?.rank ?? Infinity) || y.models - x.models || x.name.localeCompare(y.name));
  const out = { summaries, standings, items, indexName };
  cache.set(snapshot, out);
  return out;
}

/** Every lab with a model Priors has results for, best-ranked first (labs with no ranked model after, by how many models they have). */
export const labDirectory = (snapshot: Snapshot) => { const { summaries, indexName } = build(snapshot); return { labs: summaries, indexName }; };

/** A lab id as a link carries it, or any spelling the logo table knows, resolved to a lab with a page. */
export function resolveLab(snapshot: Snapshot, id: string): string | undefined {
  const { items } = build(snapshot), key = id.toLowerCase();
  if (items.has(key) && key !== "other") return key;
  const alias = labLogo(key)?.id;
  if (alias && alias !== "other" && items.has(alias)) return alias;
  return build(snapshot).summaries.find((s) => s.name.toLowerCase() === key)?.id;
}

export function labPage(snapshot: Snapshot, labId: string): LabPageData | null {
  const { summaries, standings, items, indexName } = build(snapshot);
  const lab = summaries.find((s) => s.id === labId);
  if (!lab) return null;
  return { lab, items: items.get(labId) ?? [], indexName, standings: standings.get(labId) ?? [], peers: summaries.filter((s) => s.ranked > 0) };
}

export { labPath } from "./lab-path";
