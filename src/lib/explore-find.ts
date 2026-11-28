import type { ExploreCardData, ExploreMixPart } from "./explore-cards";

/** `profiles.explore` takes the newest this many pages (convex/profiles.ts). */
export const EXPLORE_LIMIT = 300;

export type ExploreSort = "updated" | "newest" | "benchmarks" | "name" | "dist";
export const EXPLORE_SORTS: { id: ExploreSort; name: string }[] = [
  { id: "updated", name: "Recently updated" },
  { id: "newest", name: "Newest" },
  { id: "dist", name: "Furthest from default" },
  { id: "benchmarks", name: "Most benchmarks" },
  { id: "name", name: "Name A to Z" },
];
export const isExploreSort = (s: string | null | undefined): s is ExploreSort => EXPLORE_SORTS.some((x) => x.id === s);

/** Lower case with accents removed, so "ekstrom" finds "Ekström". */
export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** A card with its searchable text folded once, so a keystroke only compares strings. */
export interface Prepared { card: ExploreCardData; id: string[]; idx: string[]; models: string[]; parts: { p: ExploreMixPart; f: string }[]; name: string }
export const prepare = (cards: ExploreCardData[]): Prepared[] => cards.map((card) => ({
  card, name: fold(card.name), id: [fold(card.name), fold(card.handle)], idx: [fold(card.index), ...card.others.map(fold)],
  models: card.podium.map((m) => fold(m.name)), parts: card.mix.map((p) => ({ p, f: fold(p.name) })),
}));

export interface Found { item: Prepared; score: number; via?: ExploreMixPart }

/** Every word must hit the name, handle, index name, another tab, a benchmark in the mix or one of the top three models. Identity hits rank above benchmark hits. */
export function find(items: Prepared[], q: string): Found[] {
  const tokens = fold(q).split(/\s+/).filter(Boolean);
  if (!tokens.length) return items.map((item) => ({ item, score: 0 }));
  const out: Found[] = [];
  for (const item of items) {
    let score = 0, via: ExploreMixPart | undefined, ok = true;
    for (const t of tokens) {
      let best = 0;
      if (item.id.some((f) => f.includes(t))) best = 4;
      else if (item.idx.some((f) => f.includes(t))) best = 3;
      else if (item.models.some((f) => f.includes(t))) best = 2;
      else { const hit = item.parts.find((x) => x.f.includes(t)); if (hit) { best = 1; via ??= hit.p; } }
      if (!best) { ok = false; break; }
      score += best;
    }
    if (ok) out.push({ item, score, via });
  }
  return out;
}

const BY: Record<ExploreSort, (a: ExploreCardData, b: ExploreCardData, an: string, bn: string) => number> = {
  updated: (a, b) => b.updatedAt - a.updatedAt,
  newest: (a, b) => b.createdAt - a.createdAt,
  benchmarks: (a, b) => b.mix.length - a.mix.length || b.updatedAt - a.updatedAt,
  name: (a, b, an, bn) => an.localeCompare(bn) || b.updatedAt - a.updatedAt,
  dist: (a, b) => b.dist - a.dist || b.updatedAt - a.updatedAt,
};

/**
 * The cards to show: optionally only custom mixes, those that match the search, in the chosen order.
 * While searching the best match leads and the chosen order breaks ties. Pages that rank nothing come last.
 */
export function arrange(items: Prepared[], o: { q: string; sort: ExploreSort; custom: boolean }): Found[] {
  const hits = find(o.custom ? items.filter((x) => x.card.kind === "custom") : items, o.q);
  const by = BY[o.sort];
  hits.sort((a, b) => by(a.item.card, b.item.card, a.item.name, b.item.name));
  if (o.q.trim()) hits.sort((a, b) => b.score - a.score);
  return [...hits.filter((x) => x.item.card.kind !== "dead"), ...hits.filter((x) => x.item.card.kind === "dead")];
}

/** How many default copies and pages with no ranking match a search, for "Include default copies". */
export const hiddenMatches = (items: Prepared[], q: string) => find(items.filter((x) => x.card.kind !== "custom"), q).length;

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
/** "12%", or "<1%" for a sliver. */
export const pct = (n: number) => `${n < 1 ? "<1" : Math.round(n)}%`;

/** One piece of a card's weight bar. `tone` runs 1 (heaviest) down to 0.22; -1 marks the grey remainder. */
export interface MixSegment { label: string; share: number; tone: number }
/** The heaviest `max` benchmarks as indigo tones fading by rank (the way MixPie draws a mix), then the rest as one grey piece. */
export function mixSegments(parts: ExploreMixPart[], max = 5): MixSegment[] {
  const head = parts.slice(0, max), rest = parts.slice(max), rem = rest.reduce((t, x) => t + x.share, 0);
  const out = head.map((x, i): MixSegment => ({ label: `${x.name} ${pct(x.share)}`, share: x.share, tone: Math.max(0.22, 1 - (i / Math.max(1, head.length - 1)) * 0.78) }));
  return rem > 0.05 ? [...out, { label: `${rest.length.toLocaleString("en-US")} more ${pct(rem)}`, share: rem, tone: -1 }] : out;
}
