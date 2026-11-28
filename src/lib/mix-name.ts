import type { IndexConfig } from "@/engine";
import { isAAWeights } from "./default-index";

type Named = { benchmarks: { id: string; name: string; shortName?: string }[] };

/**
 * A name for a new copy of a mix, from what it holds: "AIME 2025 + CritPt", "Coding + 4 more". A copy of AA's index has nothing to
 * name it by, so it is "My mix". A name already taken gets " 2", " 3", and so on.
 */
export function derivedMixName(snapshot: Named, config: IndexConfig, taken: Iterable<string>): string {
  const on = Object.entries(config.weights).filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]);
  let base: string;
  if (!on.length) base = "New mix";
  else if (isAAWeights(config)) base = "My mix";
  else {
    const names = on.map(([id]) => { const b = snapshot.benchmarks.find((x) => x.id === id); return b ? (b.shortName ?? b.name) : id; });
    base = names.length <= 3 ? names.join(" + ") : `${names[0]} + ${names.length - 1} more`;
  }
  base = base.slice(0, 60);
  const used = new Set(taken);
  let name = base;
  for (let n = 2; used.has(name); n++) name = `${base} ${n}`;
  return name;
}
