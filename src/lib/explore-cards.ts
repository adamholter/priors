import { computeIndex, PAGE_VIEW, rankingRows, type IndexConfig } from "../engine";
import { aaComponentWeights, compositeParts, latestAAIndex } from "../data/aa-index";
import type { Snapshot } from "../data/types";
import { featuredMixes } from "./featured-mixes";
import { isAAWeights } from "./default-index";
import { encodeIndices, prettyQuery } from "./url";

/** One ranked model at its best reasoning effort. `effort` is "default" for a model with no effort levels. */
export interface ExploreLead { id: string; name: string; effort: string; score: number; lab: string; labName: string; base: string }
/** One benchmark in a page's mix, `share` in percent. */
export interface ExploreMixPart { name: string; share: number }
/**
 * custom: a mix someone made. default: AA's index as it opens. dead: ranks no model on today's data.
 */
export type ExploreKind = "custom" | "default" | "dead";

/** Everything a card on /explore draws, and everything finding and sorting need. Built on the server, once per page. */
export interface ExploreCardData {
  handle: string; name: string; avatarUrl?: string; theme?: { preset?: string; accent?: string; surface?: "bone" | "white"; mode?: "auto" | "fixed" };
  /** X handle, from the page's links. */ x?: string;
  updatedAt: number; createdAt: number; when: string; index: string;
  /** Names of the page's next tabs, and how many tabs follow the main one. */ others: string[]; more: number;
  kind: ExploreKind;
  /** The top three models, one row per model at its best effort. Empty on a dead page. */ podium: ExploreLead[];
  /** Every benchmark in the main index, heaviest first. */ mix: ExploreMixPart[];
  /** How far the mix sits from the default index's, 0 to 100 (half the L1 distance of the six category shares). */ dist: number;
  pageHref: string; remixHref: string; compareHref: string;
}

/** A starting point: a ranking anyone can open in the builder and change. */
export interface FeaturedMixData { name: string; href: string; podium: ExploreLead[]; mix: ExploreMixPart[] }

/** A page as `profiles.explore` returns it. `indices` holds the main index only; the page's other tabs come as names. */
export interface PublishedPage { handle: string; displayName: string; bio?: string; avatarUrl?: string; theme?: ExploreCardData["theme"]; socials?: { label: string; url: string }[]; updatedAt: number; createdAt?: number; indices: IndexConfig[]; others: string[]; more: number }

/** Benchmark names come with en and em dashes ("FM Tiers 1–3", "Context Arena — MRCR"): drawn with hyphens. */
export const plain = (s: string) => s.replace(/\s+[–—]\s+/g, " - ").replace(/[–—]/g, "-");

/** The six buckets a mix is read in for "furthest from default": coding, agents, work, science and math, knowledge and reasoning, other. */
const BUCKET_OF: Record<string, number> = { coding: 0, agentic: 1, professional: 2, science: 3, math: 3, knowledge: 4, reasoning: 4, "long-context": 4, games: 4 };
export const bucketOf = (category: string) => BUCKET_OF[category] ?? 5;

/** Half the L1 distance between two six-bucket profiles of 100: 0 for the same shape, 100 for none shared. */
export const profileDistance = (a: number[], b: number[]) => 0.5 * a.reduce((t, v, i) => t + Math.abs(v - (b[i] ?? 0)), 0);

const DAY = 86_400_000;
/** "today", "yesterday", "3 days ago", then the date. */
export const ago = (t: number, now: number) => {
  const d = Math.floor((now - t) / DAY);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : d < 30 ? `${d} days ago` : new Date(t).toISOString().slice(0, 10);
};

const X_URL = /^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/@?([A-Za-z0-9_]{1,15})\/?(?:[?#].*)?$/;
/** The page's X handle, from the first x.com or twitter.com link in its socials. */
export const xHandle = (socials?: { url: string }[]) => socials?.map((l) => l.url.match(X_URL)?.[1]).find(Boolean);

/** True for a copy of AA's index: its composite alone, or its evaluations at AA's own weights (within half a point each). */
export function isDefaultMix(snapshot: Pick<Snapshot, "benchmarks">, index: IndexConfig): boolean {
  if (isAAWeights(index)) return true;
  const parts = aaComponentWeights(snapshot), mine = Object.entries(index.weights).filter(([, w]) => w > 0);
  if (!parts || mine.length !== Object.keys(parts).length) return false;
  const total = mine.reduce((t, [, w]) => t + w, 0), want = Object.values(parts).reduce((t, w) => t + w, 0) || 1;
  return mine.every(([id, w]) => id in parts && Math.abs((w / total - parts[id] / want) * 100) < 0.5);
}

interface Analysis { podium: ExploreLead[]; mix: ExploreMixPart[]; profile: number[] }

/** The six bucket shares of a mix: AA's composite is read as its own evaluations, so a copy of the default index gets the default's shape. */
function profileOf(snapshot: Snapshot, weights: Record<string, number>, mix: { share: number; bucket: number }[]): number[] {
  const profile = [0, 0, 0, 0, 0, 0], parts = compositeParts(snapshot, weights);
  if (parts) {
    const byId = new Map(snapshot.benchmarks.map((b) => [b.id, b])), total = Object.values(parts).reduce((a, v) => a + v, 0) || 1;
    for (const [id, w] of Object.entries(parts)) profile[bucketOf(byId.get(id)?.category ?? "other")] += (w / total) * 100;
  } else for (const m of mix) profile[m.bucket] += m.share;
  return profile;
}

/** Indices that rank the same share one analysis; the snapshot object is the cache key, so a new day starts clean. */
const analyses = new WeakMap<Snapshot, Map<string, Analysis>>();
const MAX_CACHED = 400;
const keyOf = (i: IndexConfig) => JSON.stringify({ ...i, id: undefined, name: undefined });

/** The top three at each model's best effort (the page's own effort choices apply), and the full mix, for one index. */
function analyze(snapshot: Snapshot, index: IndexConfig): Analysis {
  let memo = analyses.get(snapshot);
  if (!memo) analyses.set(snapshot, memo = new Map());
  const key = keyOf(index), hit = memo.get(key);
  if (hit) return hit;
  const labs = new Map(snapshot.labs.map((l) => [l.id, l]));
  let out: Analysis;
  try {
    const r = computeIndex(snapshot, { ...index, variants: "all" }, PAGE_VIEW);
    const podium = rankingRows(r.ranked, { ...index, rankingVariants: "best" }).slice(0, 3).map((x): ExploreLead => ({
      id: x.model.id, name: x.model.name, effort: x.variant.effort, score: x.score, lab: x.model.labId, labName: labs.get(x.model.labId)?.name ?? x.model.labId, base: labs.get(x.model.labId)?.color ?? "#A3A39B",
    }));
    const full = r.benchmarks.map((b) => ({ name: plain(b.benchmark.shortName ?? b.benchmark.name), share: b.share, bucket: bucketOf(b.benchmark.category) })).sort((a, b) => b.share - a.share);
    out = { podium, mix: full.map(({ name, share }) => ({ name, share })), profile: profileOf(snapshot, index.weights, full) };
  } catch {
    out = { podium: [], mix: [], profile: [0, 0, 0, 0, 0, 0] };
  }
  if (memo.size >= MAX_CACHED) memo.clear();
  memo.set(key, out);
  return out;
}

/** A model's name alone: starting points show who leads, not at what effort. */
const nameOnly = (l: ExploreLead): ExploreLead => ({ ...l, effort: "default" });

/** The starting points on Explore with their leaders and mixes. */
export function featuredCards(snapshot: Snapshot | null): FeaturedMixData[] {
  if (!snapshot) return [];
  return featuredMixes(snapshot).flatMap((index): FeaturedMixData[] => {
    const a = analyze(snapshot, index);
    return a.podium.length ? [{ name: index.name, href: `/builder?${prettyQuery(encodeIndices([index]))}`, podium: a.podium.map(nameOnly), mix: a.mix }] : [];
  });
}

/** Cards for the published pages, newest first as the query returns them. Pages that share an index share one analysis (and, in the page payload, one mix array). */
export function buildCards(snapshot: Snapshot | null, pages: PublishedPage[], now = Date.now()): ExploreCardData[] {
  const baseWeights = snapshot && latestAAIndex(snapshot) ? { [latestAAIndex(snapshot)!.id]: 100 } : undefined;
  const base = snapshot && baseWeights ? profileOf(snapshot, baseWeights, []) : undefined;
  return pages.flatMap((p): ExploreCardData[] => {
    const index = p.indices[0];
    if (!index) return [];
    const a = snapshot ? analyze(snapshot, index) : null;
    const dead = !a?.podium.length;
    return [{
      handle: p.handle, name: p.displayName, avatarUrl: p.avatarUrl, theme: p.theme, x: xHandle(p.socials),
      updatedAt: p.updatedAt, createdAt: p.createdAt ?? p.updatedAt, when: ago(p.updatedAt, now), index: index.name ?? "Rankings", others: p.others, more: p.more,
      kind: dead ? "dead" : snapshot && isDefaultMix(snapshot, index) ? "default" : "custom",
      podium: a?.podium ?? [], mix: dead ? [] : a!.mix, dist: !dead && base ? profileDistance(a!.profile, base) : 0,
      pageHref: `/${p.handle}`, compareHref: `/compare?a=me&b=@${p.handle}`, remixHref: `/builder?${prettyQuery(encodeIndices([{ ...index, name: `From @${p.handle}` }]))}`,
    }];
  });
}
