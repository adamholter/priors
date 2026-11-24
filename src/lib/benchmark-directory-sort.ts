import type { QualityFactorId } from "@/onboarding/quality";
import { recommendedScore } from "./benchmark-recommended";

/** What the directory needs of a row to sort it. */
export interface SortableBenchmark {
  name: string; models: number; quality: number; baseQuality?: number; uses: number; stars: number; lastUpdated?: string;
  factors: Partial<Record<QualityFactorId, number>>; leader?: { name: string };
}

export type DirectorySort = "recommended" | "uses" | "stars" | "quality" | "models" | "updated" | "name" | "leader" | QualityFactorId;
export type SortDir = "asc" | "desc";

/** The sorts the funnel menu lists, in order. Factor sorts are grouped under Quality factors. Every column header sorts by one of these too. */
export const DIRECTORY_SORTS: { id: DirectorySort; name: string; factors?: true }[] = [
  { id: "recommended", name: "Recommended" }, { id: "quality", name: "Quality" }, { id: "stars", name: "Stars" }, { id: "uses", name: "Mixes" },
  { id: "models", name: "Models" }, { id: "updated", name: "Recently updated" }, { id: "name", name: "Name" }, { id: "leader", name: "Top model" },
  { id: "saturation", name: "Headroom", factors: true }, { id: "testSet", name: "Test set", factors: true }, { id: "recency", name: "Recency", factors: true },
  { id: "objectivity", name: "Grading", factors: true }, { id: "frontier", name: "New models", factors: true }, { id: "size", name: "Size", factors: true },
  { id: "efforts", name: "Efforts", factors: true }, { id: "breadth", name: "Breadth", factors: true },
];

/** Names and words read A to Z first; everything else biggest, newest or best first. */
export const naturalDir = (sort: DirectorySort): SortDir => sort === "name" || sort === "leader" ? "asc" : "desc";

/** What the two directions are called for a sort, natural one first. */
export const dirNames = (sort: DirectorySort): [string, string] =>
  sort === "name" || sort === "leader" ? ["A to Z", "Z to A"] : sort === "updated" || sort === "recency" ? ["Newest first", "Oldest first"] : sort === "recommended" ? ["Best first", "Worst first"] : ["Highest first", "Lowest first"];

const factor = (x: SortableBenchmark, id: QualityFactorId) => x.factors[id] ?? -1;
const byFactor = (id: QualityFactorId) => (a: SortableBenchmark, b: SortableBenchmark) => factor(b, id) - factor(a, id) || b.quality - a.quality;
/** Each sort in its natural direction. */
const COMPARE: Record<DirectorySort, (a: SortableBenchmark, b: SortableBenchmark) => number> = {
  recommended: (a, b) => recommendedScore(b) - recommendedScore(a),
  uses: (a, b) => b.uses - a.uses || b.quality - a.quality,
  stars: (a, b) => b.stars - a.stars || recommendedScore(b) - recommendedScore(a),
  quality: (a, b) => b.quality - a.quality,
  models: (a, b) => b.models - a.models,
  updated: (a, b) => (b.lastUpdated ?? "").localeCompare(a.lastUpdated ?? ""),
  name: (a, b) => a.name.localeCompare(b.name),
  leader: (a, b) => (a.leader?.name ?? "").localeCompare(b.leader?.name ?? "") || b.quality - a.quality,
  saturation: byFactor("saturation"), testSet: byFactor("testSet"), recency: byFactor("recency"), objectivity: byFactor("objectivity"),
  frontier: byFactor("frontier"), size: byFactor("size"), efforts: byFactor("efforts"), breadth: byFactor("breadth"),
};

/** Boards without the value (no top model, no update date) go last whichever way the column runs. */
const missing = (x: SortableBenchmark, sort: DirectorySort) => sort === "leader" ? !x.leader : sort === "updated" ? !x.lastUpdated : false;

/** A sorted copy. */
export function sortDirectory<T extends SortableBenchmark>(items: readonly T[], sort: DirectorySort, dir: SortDir = naturalDir(sort)): T[] {
  const sign = dir === naturalDir(sort) ? 1 : -1, cmp = COMPARE[sort];
  return [...items].sort((a, b) => Number(missing(a, sort)) - Number(missing(b, sort)) || sign * cmp(a, b));
}

/** Switch every row's active quality between the adjusted score (default) and the base score before bonuses and penalties. */
export function withQualityAdjustments<T extends SortableBenchmark>(items: readonly T[], on: boolean): T[] {
  return on ? [...items] : items.map((x) => (x.baseQuality == null || x.baseQuality === x.quality ? x : { ...x, quality: x.baseQuality }));
}

/** A click on a column header: a new column starts in its natural direction, the current one flips. */
export function clickColumn(current: { sort: DirectorySort; dir: SortDir }, column: DirectorySort): { sort: DirectorySort; dir: SortDir } {
  if (current.sort !== column) return { sort: column, dir: naturalDir(column) };
  return { sort: column, dir: current.dir === "asc" ? "desc" : "asc" };
}
