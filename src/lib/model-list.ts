/**
 * The model directory's rows and everything that is worked out from them on the client: sorting, search, the filters and the lab counts
 * that follow them, and the plain words for dates, costs and why a model has no rank. Pure, so it is safe to import from client code
 * (`model-directory.ts`, which reads the snapshot, is not).
 */
import { effortIdx } from "./model-efforts";

/** Why a model has no rank, when it is not simply an older version (that is `superseded`). */
export type NotRanked = "estimated" | "coverage" | "window" | "thin";
/** One reasoning effort of a model and its score on the default index. */
export interface Effort { effort: string; score: number }

/** One row of the model directory: who made it, when, how it ranks on the default index, how much it has been measured, what a task costs. */
export interface ModelItem {
  id: string; name: string; labId: string; labName: string; labColor: string;
  releaseDate?: string; openWeights?: boolean; paramsB?: number; reasoning: boolean;
  /** Distinct benchmarks with a published result for any of its efforts (proxies such as prices and speeds left out). */
  benchmarks: number;
  /** Rank and score on the default index (`defaultConfig`), best effort, as the default ranking shows it. An older version keeps its score without a rank; both unset when too little is measured to rank. */
  rank?: number; score?: number;
  /** Ranked models with more than one effort: each effort's score, lowest first. */
  efforts?: Effort[];
  /** Measured cost of one task, USD, at its best effort (cost means measured cost per task, never token price). */
  costUsd?: number;
  /** An older version of a line that has a newer one: hidden until asked for, as rankings hide it. */
  superseded?: boolean;
  /** Why an unranked model that is not an older version has no rank, and for `coverage` the share of the index that is measured (0 to 1). */
  why?: NotRanked; share?: number;
  /** Lowercase names it is also known by, for search. */
  aliases: string[];
}

export type ModelSort = "rank" | "name" | "released" | "benchmarks" | "cost";
export type SortDir = "asc" | "desc";
export interface Order { sort: ModelSort; dir: SortDir }
export const MODEL_SORTS: { id: ModelSort; name: string; natural: SortDir; names: [string, string] }[] = [
  { id: "rank", name: "Priors rank", natural: "asc", names: ["Best first", "Worst first"] },
  { id: "released", name: "Release date", natural: "desc", names: ["Newest first", "Oldest first"] },
  { id: "benchmarks", name: "Benchmarks", natural: "desc", names: ["Most first", "Fewest first"] },
  { id: "cost", name: "Cost per task", natural: "asc", names: ["Cheapest first", "Priciest first"] },
  { id: "name", name: "Name", natural: "asc", names: ["A to Z", "Z to A"] },
];
export const RANK_ORDER: Order = { sort: "rank", dir: "asc" };

/** Click a column: a new column takes its natural direction, the same column flips. */
export function nextOrder(o: Order, id: ModelSort): Order {
  const s = MODEL_SORTS.find((x) => x.id === id)!;
  return o.sort === id ? { sort: id, dir: o.dir === "asc" ? "desc" : "asc" } : { sort: id, dir: s.natural };
}

/** Sorted rows. Missing values (unranked, no cost, no date) go last in either direction, then by name. Older versions follow the ranked models by score, then the rest by how much is measured. */
export function sortModels(items: ModelItem[], sort: ModelSort, dir: SortDir): ModelItem[] {
  const key = (x: ModelItem): number | string | undefined =>
    sort === "rank" ? x.rank ?? (x.score != null ? 1e6 - x.score : 2e6 - x.benchmarks) : sort === "released" ? x.releaseDate : sort === "benchmarks" ? x.benchmarks : sort === "cost" ? x.costUsd : x.name.toLowerCase();
  const sign = dir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const ka = key(a), kb = key(b);
    if (ka == null || kb == null) return ka == null && kb == null ? a.name.localeCompare(b.name) : ka == null ? 1 : -1;
    const c = typeof ka === "number" && typeof kb === "number" ? ka - kb : String(ka).localeCompare(String(kb));
    return c * sign || a.name.localeCompare(b.name);
  });
}

export const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9.]+/g, " ").trim();

/** Every word typed must start a word of the name, lab or an alias ("opus 5", "gemini neon", "deepseek"); best matches first: name, then lab, then alias. */
export function searchModels(items: ModelItem[], q: string): ModelItem[] {
  const words = squash(q).split(" ").filter(Boolean);
  if (!words.length) return items;
  const fits = (text: string) => { const parts = squash(text).split(" "); return words.every((w) => parts.some((p) => p.startsWith(w))); };
  const score = (x: ModelItem) => fits(x.name) ? 3 : fits(`${x.labName} ${x.name}`) ? 2 : x.aliases.some(fits) || fits(`${x.labName} ${x.aliases.join(" ")}`) ? 1 : 0;
  return items.map((x) => [x, score(x)] as const).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).map(([x]) => x);
}

/* ------------------------------------------------------------------ */
/* Labs, filters and the counts that follow them                       */
/* ------------------------------------------------------------------ */

export interface LabInfo { id: string; name: string; color: string; ranked: number; best?: number }

/** Labs in an order that does not move with search: most ranked models, then best rank, then size; Other last. */
export function labsOf(items: ModelItem[]): LabInfo[] {
  const m = new Map<string, LabInfo>(), size = new Map<string, number>();
  for (const x of items) {
    const l = m.get(x.labId) ?? m.set(x.labId, { id: x.labId, name: x.labName, color: x.labColor, ranked: 0 }).get(x.labId)!;
    if (!x.superseded) size.set(x.labId, (size.get(x.labId) ?? 0) + 1);
    if (x.rank != null) { l.ranked++; if (l.best == null || x.rank < l.best) l.best = x.rank; }
  }
  const big = (l: LabInfo) => size.get(l.id) ?? 0;
  return [...m.values()].sort((a, b) => (a.id === "other" ? 1 : 0) - (b.id === "other" ? 1 : 0) || b.ranked - a.ranked || (a.best ?? 1e9) - (b.best ?? 1e9) || big(b) - big(a) || a.name.localeCompare(b.name));
}

export type Tier = "ranked" | "all";
export interface Filters { q: string; lab: string; open: boolean; since: number; tier: Tier; older: boolean }
export const NO_FILTERS: Filters = { q: "", lab: "all", open: false, since: 0, tier: "ranked", older: false };
/** The "released since" windows, in days; 0 is any time. */
export const SINCE = [{ days: 30, label: "30 days" }, { days: 90, label: "90 days" }, { days: 183, label: "6 months" }, { days: 0, label: "Any" }];

export interface Facet { ranked: number; total: number }
export interface ModelView {
  /** The rows to list, in order. */
  rows: ModelItem[];
  /** Per lab, ranked and total models that pass the search, open weights and release window (whatever lab or tier is chosen). */
  counts: Map<string, Facet>;
  /** The same two counts over every lab. */
  total: Facet;
  /** How many the chosen lab has under each tier, so the Ranked | All switch can tell when it would change nothing. */
  rankedN: number; allN: number;
  searching: boolean;
}

const DAY = 864e5;

/**
 * Everything the filters leave and the counts that describe it. Searching looks at older versions and unranked models too, as an old model
 * is often exactly what someone typed; the default order then means best match first, and a column picked by hand orders the matches.
 */
export function modelView(items: ModelItem[], f: Filters, order: Order, now = Date.now()): ModelView {
  const searching = f.q.trim().length > 0, older = f.older || searching, tier: Tier = searching ? "all" : f.tier;
  const cut = f.since ? now - f.since * DAY : 0;
  const kept = items.filter((x) => (!f.open || x.openWeights) && (!cut || (x.releaseDate != null && Date.parse(x.releaseDate) >= cut)));
  const scope = searching ? searchModels(kept, f.q) : kept;
  const counts = new Map<string, Facet>(), total = { ranked: 0, total: 0 };
  for (const x of scope) {
    const c = counts.get(x.labId) ?? counts.set(x.labId, { ranked: 0, total: 0 }).get(x.labId)!;
    if (x.rank != null) { c.ranked++; total.ranked++; }
    if (older || !x.superseded) { c.total++; total.total++; }
  }
  const inLab = f.lab === "all" ? scope : scope.filter((x) => x.labId === f.lab);
  const pick = (t: Tier) => inLab.filter((x) => (older || !x.superseded) && (t === "all" || x.rank != null || (older && x.score != null)));
  const shown = pick(tier);
  const byRank = order.sort === "rank" && order.dir === "asc";
  const rows = searching ? (byRank ? searchModels(sortModels(shown, "rank", "asc"), f.q) : sortModels(shown, order.sort, order.dir)) : sortModels(shown, order.sort, order.dir);
  return { rows, counts, total, rankedN: pick("ranked").length, allN: pick("all").length, searching };
}

/* ------------------------------------------------------------------ */
/* Plain words                                                         */
/* ------------------------------------------------------------------ */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ageDays = (d: string, now: number) => Math.floor((now - Date.parse(d)) / DAY);

/** How long ago: 12d, 3mo, 2.1y. */
export function age(d?: string, now = Date.now()): string {
  if (!d) return "";
  const n = ageDays(d, now);
  if (Number.isNaN(n)) return "";
  if (n < 30) return `${Math.max(0, n)}d`;
  if (n < 365) return `${Math.max(1, Math.round(n / 30.44))}mo`;
  return `${(n / 365.25).toFixed(1).replace(/\.0$/, "")}y`;
}
/** Released in the last 30 days. */
export const isNew = (d?: string, now = Date.now()) => !!d && ageDays(d, now) < 30;
export function dateText(d?: string, now = new Date()): string {
  if (!d) return "No release date";
  const [y, m, day] = d.split("-").map(Number);
  return `${MONTHS[m - 1]} ${day}${y === now.getFullYear() ? "" : `, ${y}`}`;
}
/** Dollars per task at the precision a reader needs: $12, $1.5, $0.12, $0.034, $0.0042. */
export const usd = (v: number) => (v >= 10 ? `$${Math.round(v)}` : v >= 1 ? `$${v.toFixed(1).replace(/\.0$/, "")}` : v >= 0.1 ? `$${v.toFixed(2)}` : v >= 0.01 ? `$${v.toFixed(3)}` : v === 0 ? "free" : `$${v.toPrecision(2)}`);
export const params = (b?: number) => (b ? (b >= 1000 ? `${(b / 1000).toFixed(b >= 10000 ? 0 : 1)}T` : `${b >= 10 ? Math.round(b) : b}B`) : "");
/** Parameter count for the sub line, left out when the name already says it ("Gemma 4 12B"). */
export const paramsHint = (x: ModelItem) => { const p = params(x.paramsB); return p && !x.name.toLowerCase().includes(p.toLowerCase()) ? p : ""; };

/** One short plain phrase for why a model has no rank. */
export function reasonWord(x: ModelItem): string {
  if (x.superseded) return "Older version";
  switch (x.why) {
    case "estimated": return "Estimated";
    case "window": return x.releaseDate ? "Too old" : "No date";
    default: return "Too few benchmarks";
  }
}
/** The same reason in full, for the hover label. */
export function reasonText(x: ModelItem): string {
  if (x.superseded) return "Older version of a newer model, so not ranked";
  switch (x.why) {
    case "estimated": return "Score is estimated, so not ranked";
    case "coverage": return x.share != null ? `Not ranked: ${Math.round(x.share * 100)}% of the index is measured` : "Not ranked: too few benchmarks";
    case "window": return x.releaseDate ? "Not ranked: released over 6 months ago" : "Not ranked: no release date";
    default: return `Not ranked: measured on ${x.benchmarks} benchmark${x.benchmarks === 1 ? "" : "s"}`;
  }
}

/** "max 64.7, high 62.1": every effort's score, highest effort first. */
export const effortsText = (efforts: Effort[]) => [...efforts].sort((a, b) => effortIdx(b.effort) - effortIdx(a.effort)).map((e) => `${e.effort} ${e.score.toFixed(1)}`).join(", ");
/** The efforts that sit below the best one, to mark as gaps in a score bar. */
export const lowerEfforts = (efforts: Effort[] | undefined, score: number) => (efforts ?? []).filter((e) => e.score < score - 0.05);
