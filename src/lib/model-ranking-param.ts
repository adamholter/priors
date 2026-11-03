import type { IndexConfig } from "@/engine";
import { pageIndex } from "./compare-ref";
import type { mergeImports } from "./import";
import { anchorOf } from "./metrics";

/** A ranking a model can be shown in: who it belongs to, and what to rank it with (a standard one's config comes from the snapshot). */
export interface RankingOption { key: string; label: string; group: string; config?: IndexConfig; imports?: Parameters<typeof mergeImports>[1] }

/** Everything the visitor could rank a model in, best guess first: their page, their builder, then the standard mixes. */
export function rankingOptions(page: { indices: IndexConfig[]; imports?: RankingOption["imports"] } | null | undefined, builder: IndexConfig[]): RankingOption[] {
  const out: RankingOption[] = [];
  if (page) {
    const main = pageIndex(page.indices);
    page.indices.forEach((c, i) => out.push({ key: `page:${i}`, label: i === 0 || c === main ? `${c.name} (your page)` : c.name, group: "Your page", config: c, imports: page.imports }));
  }
  builder.forEach((c, i) => out.push({ key: `builder:${i}`, label: c.name, group: "In your builder", config: c }));
  out.push({ key: "preset:general", label: "General frontier", group: "Standard" });
  out.push({ key: "preset:aa", label: "Artificial Analysis", group: "Standard" });
  return out;
}

/** The `?r=` value for a ranking on a model page: stable across devices, unlike the position in someone's builder. */
export function rankParam(o: { key: string; label: string }): string {
  const [kind] = o.key.split(":");
  return kind === "preset" ? o.key.slice("preset:".length) : `${kind}-${anchorOf(o.label.replace(/ \(your page\)$/, ""))}`;
}

export function findRanking<T extends { key: string; label: string }>(options: T[], param: string | null | undefined): T | undefined {
  return param ? options.find((o) => rankParam(o) === param) : undefined;
}
