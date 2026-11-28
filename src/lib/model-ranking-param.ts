import type { IndexConfig } from "@/engine";
import { pageIndex } from "./compare-ref";
import type { mergeImports } from "./import";
import { anchorOf } from "./metrics";

/** A ranking a model can be shown in: who it belongs to, and what to rank it with (a standard one's config comes from the snapshot). */
export interface RankingOption { key: string; label: string; group: string; config?: IndexConfig; imports?: Parameters<typeof mergeImports>[1] }

/** The ranking made for one model no standard ranking places (`ownRanking` in model-ranks.ts): its key, name and group in the picker, and its `?r=` value. */
export const OWN_KEY = "own:its", OWN_LABEL = "This model's benchmarks", OWN_GROUP = "For this model", OWN_PARAM = "own";

/** Everything the visitor could rank a model in, best guess first: their page, their builder, then the standard mixes, then the model's own ranking when it needs one. */
export function rankingOptions(page: { indices: IndexConfig[]; imports?: RankingOption["imports"] } | null | undefined, builder: IndexConfig[], own?: IndexConfig): RankingOption[] {
  const out: RankingOption[] = [];
  if (page) {
    const main = pageIndex(page.indices);
    page.indices.forEach((c, i) => out.push({ key: `page:${i}`, label: i === 0 || c === main ? `${c.name} (your page)` : c.name, group: "Your page", config: c, imports: page.imports }));
  }
  builder.forEach((c, i) => out.push({ key: `builder:${i}`, label: c.name, group: "In your builder", config: c }));
  out.push({ key: "preset:general", label: "General frontier", group: "Standard" });
  out.push({ key: "preset:aa", label: "Artificial Analysis", group: "Standard" });
  if (own) out.push({ key: OWN_KEY, label: OWN_LABEL, group: OWN_GROUP, config: own });
  return out;
}

/** The `?r=` value for a ranking on a model page: stable across devices, unlike the position in someone's builder. */
export function rankParam(o: { key: string; label: string }): string {
  if (o.key === OWN_KEY) return OWN_PARAM;
  const [kind] = o.key.split(":");
  return kind === "preset" ? o.key.slice("preset:".length) : `${kind}-${anchorOf(o.label.replace(/ \(your page\)$/, ""))}`;
}

export function findRanking<T extends { key: string; label: string }>(options: T[], param: string | null | undefined): T | undefined {
  return param ? options.find((o) => rankParam(o) === param) : undefined;
}
