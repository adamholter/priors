import type { Benchmark } from "@/data/types";

const squash = (value: string) => value.toLowerCase().replace(/[\s._-]+/g, "");
const words = (value: string) => value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Benchmarks matching a search, best first. Every word of the query must match somewhere: in the name
 * (highest), the short name or id, the lab, source or category, or the description, where a word has to
 * start a word of the description so "ui" does not match "build". A match in the name outranks any
 * number of matches in descriptions; ties keep their input order.
 */
export function searchBenchmarks(benchmarks: Benchmark[], query: string, categoryName: (category: string) => string = (c) => c): Benchmark[] {
  const terms = query.trim().split(/\s+/).filter(Boolean).map((t) => ({ squashed: squash(t), word: t.toLowerCase() }));
  if (!terms.length) return benchmarks;
  const scored: { b: Benchmark; score: number; at: number }[] = [];
  benchmarks.forEach((b, at) => {
    const name = squash(b.name), short = squash([b.shortName, b.id].join(" ")), meta = squash([b.sourceId, categoryName(b.category)].join(" "));
    const description = words(b.description ?? "");
    let score = 0;
    for (const t of terms) {
      const here = name.includes(t.squashed) ? 100 : short.includes(t.squashed) ? 60 : meta.includes(t.squashed) ? 20 : description.some((w) => w.startsWith(t.word)) ? 5 : 0;
      if (!here) return;
      score += here;
    }
    scored.push({ b, score, at });
  });
  return scored.sort((x, y) => y.score - x.score || x.at - y.at).map((x) => x.b);
}
