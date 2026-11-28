import { money } from "@/lib/metrics";
import type { CompareOption, CompareSide } from "@/lib/model-view";

/* The pure parts of the Compare page's model chooser (CompareChooser.tsx): formatting, ordering, the best number per column, search. */

export const secs = (v: number) => (v >= 60 ? `${(v / 60).toFixed(v >= 600 ? 0 : 1)} min` : `${v.toFixed(v >= 10 ? 0 : 1)}s`);
export const fmtCost = (v: number) => (v === 0 ? "free" : money(v));
export const fmtScore = (v: number) => v.toFixed(1);
/** "2026-11" from a release date. */
export const fmtMonth = (d?: string) => (d ? d.slice(0, 7) : "");

export const optionOf = (s: CompareSide): CompareOption => ({ id: s.id, name: s.name, labId: s.lab?.id ?? "", labName: s.lab?.name ?? "", rank: s.rank, score: s.score, cost: s.costUsd, tpt: s.tpt, date: s.releaseDate });


export type SortKey = "rank" | "name" | "score" | "cost" | "tpt";
export type SortDir = "asc" | "desc";
/** The direction a column starts in when its header is first pressed. */
export const NATURAL: Record<SortKey, SortDir> = { rank: "asc", name: "asc", score: "desc", cost: "asc", tpt: "asc" };

const valueOf = (o: CompareOption, k: SortKey) => (k === "rank" ? o.rank : k === "name" ? o.name.toLowerCase() : k === "score" ? o.score : k === "cost" ? o.cost : o.tpt);
/** A copy sorted by one column. A missing value goes last in either direction; ties keep rank order. */
export function sortOptions(list: CompareOption[], key: SortKey, dir: SortDir): CompareOption[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    const x = valueOf(a, key), y = valueOf(b, key);
    if (x == null || y == null) return x == null && y == null ? (a.rank ?? 999) - (b.rank ?? 999) : x == null ? 1 : -1;
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return c * sign || (a.rank ?? 999) - (b.rank ?? 999);
  });
}

/** The first index of a window of `size` rows centred on `pivot`, kept inside a list of `total`. */
export const windowStart = (pivot: number, total: number, size: number) => Math.max(0, Math.min(pivot - Math.floor(size / 2), total - size));

export type Best = Partial<Record<"score" | "cost" | "tpt", string>>;
/** A win worth a colour next to the model you keep: the score two points up, the cost or the time a fifth or more down. */
const clearly = (key: keyof Best, x: number | undefined, y: number | undefined) => x != null && y != null && (key === "score" ? x - y >= 2 : x < y && x <= y * 0.8);
/** In each column the one model that beats the model you keep by the most, so a list carries three colours at most and each one means something. */
export function bestOf(list: CompareOption[], anchor?: CompareOption): Best {
  const out: Best = {};
  if (!anchor) return out;
  for (const key of ["score", "cost", "tpt"] as const) {
    let top: CompareOption | undefined;
    for (const o of list) {
      if (o.id === anchor.id || !clearly(key, o[key], anchor[key])) continue;
      if (!top || (key === "score" ? o[key]! > top[key]! : o[key]! < top[key]!)) top = o;
    }
    if (top) out[key] = top.id;
  }
  return out;
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9.]+/g, " ").trim();
const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** The models that fit what was typed, in the order given. Every typed word must start a word of the name, the lab and name, or another name it goes by; "gpt62" finds "GPT-6.2". */
export function searchOptions(opts: CompareOption[], q: string): CompareOption[] {
  const words = squash(q).split(" ").filter(Boolean), flat = compact(q);
  if (!words.length) return [];
  const fits = (text: string) => { const parts = squash(text).split(" "); return words.every((w) => parts.some((p) => p.startsWith(w))); };
  return opts.filter((o) => fits(o.name) || fits(`${o.labName} ${o.name}`) || compact(o.name).startsWith(flat) || compact(`${o.labName}${o.name}`).startsWith(flat) || !!o.aka?.some(fits));
}

/** Labs with a ranked model, best-ranked first, with how many they have ranked. */
export function labsOf(opts: CompareOption[]): { id: string; name: string; best: number; n: number }[] {
  const by = new Map<string, { id: string; name: string; best: number; n: number }>();
  for (const o of opts) {
    if (o.rank == null) continue;
    const l = by.get(o.labId) ?? by.set(o.labId, { id: o.labId, name: o.labName, best: o.rank, n: 0 }).get(o.labId)!;
    l.best = Math.min(l.best, o.rank); l.n++;
  }
  return [...by.values()].sort((a, b) => a.best - b.best);
}

/** Other names a model goes by that search could not already find from its name: an alias that holds the name, or is part of it, adds nothing, so effort suffixes, lab prefixes and repeats drop out. */
export function otherNames(name: string, aliases: string[], max = 3): string[] {
  const own = ` ${squash(name)} `, out = new Set<string>();
  for (const a of aliases) {
    const x = squash(a.replace(/\([^)]*\)/g, "").replace(/^[a-z0-9 .-]+: /, ""));
    if (x && x.length <= 40 && !` ${x} `.includes(own) && !own.includes(` ${x} `)) out.add(x);
    if (out.size >= max) break;
  }
  return [...out];
}
