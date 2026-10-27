import type { Benchmark } from "@/data/types";

const squash = (value: string) => value.toLowerCase().replace(/[\s._-]+/g, "");
const words = (value: string) => value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Benchmarks matching a search, best first. Every word of the query must match somewhere: in the name
 * (highest), the short name or id, the lab, source or category, or the description, where a word has to
 * start a word of the description so "ui" does not match "build". A match in the name outranks any
 * number of matches in descriptions; ties keep their input order.
 */
export function searchBenchmarks<B extends Pick<Benchmark, "id" | "name" | "shortName" | "sourceId" | "category" | "description">>(benchmarks: B[], query: string, categoryName: (category: string) => string = (c) => c, { loose = false }: { loose?: boolean } = {}): B[] {
  const terms = query.trim().split(/\s+/).filter(Boolean).map((t) => ({ squashed: squash(t), word: t.toLowerCase(), stem: stem(t.toLowerCase()) }));
  if (!terms.length) return benchmarks;
  const scored: { b: B; score: number; hits: number; at: number }[] = [];
  benchmarks.forEach((b, at) => {
    const name = squash(b.name), short = squash([b.shortName, b.id].join(" ")), meta = squash([b.sourceId, categoryName(b.category)].join(" "));
    const nameWords = words(`${b.name} ${b.shortName ?? ""}`), description = words(b.description ?? "");
    let score = 0, hits = 0;
    for (const t of terms) {
      const here = name.includes(t.squashed) ? 100 : short.includes(t.squashed) ? 60
        // Loose search forgives one typo in a name word ("vendng", "termnal").
        : loose && t.word.length >= 5 && nameWords.some((w) => w.length >= 4 && nearlyEqual(w, t.word)) ? 40
        : meta.includes(t.squashed) ? 20
        : description.some((w) => w.startsWith(t.word) || (loose && t.stem.length >= 3 && w.startsWith(t.stem))) ? 5 : 0;
      if (!here && !loose) return;
      if (here) { score += here; hits++; }
    }
    if (hits) scored.push({ b, score, hits, at });
  });
  // Loose: every matched word counts first, so a partial match never outranks one that matched the whole query.
  return scored.sort((x, y) => y.hits - x.hits || y.score - x.score || x.at - y.at).map((x) => x.b);
}

/** "coding" -> "cod", "agents" -> "agent": enough to meet a description's other forms of the word. */
const stem = (w: string) => w.length > 5 && w.endsWith("ing") ? w.slice(0, -3) : w.length > 4 && w.endsWith("es") ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w.length > 4 && w.endsWith("ed") ? w.slice(0, -2) : w;

/** Edit distance at most 1 (one insert, delete or substitution). */
function nearlyEqual(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
