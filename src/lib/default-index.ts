import { defaultConfig, type IndexConfig } from "../engine";
import type { Snapshot } from "../data/types";
import { encodeIndex } from "./url";

/** The reference index added on request ("Compare with the default mix"). It never counts as an untouched default, so it is not tidied away. */
export const REFERENCE_ID = "ref-general";
export const DEFAULT_LABEL = "Default mix";

// Compared through the URL encoding, which is how the index travels: a link or a saved copy loses its id and fills in defaults.
const signature = (i: IndexConfig) => encodeIndex({ ...i, id: "x", highlight: i.highlight?.length ? i.highlight : undefined });

/** True for the index every visitor starts with (General frontier), untouched. Anything edited, renamed or fitted is theirs. */
export function isPristineDefault(i: IndexConfig): boolean {
  const base = defaultConfig({} as Snapshot);
  return i.id !== REFERENCE_ID && i.name === base.name && signature(i) === signature(base);
}

/** Two near-identical rankings under two tabs read as a bug. When the visitor has made an index of their own, the untouched default steps aside. */
export function withoutPristineDefault<T extends IndexConfig>(list: T[]): T[] {
  if (list.length < 2) return list;
  const kept = list.filter((i) => !isPristineDefault(i));
  return kept.length ? kept : list;
}

/** What a tab is, in words: whose it is and where it came from. */
export function indexNote(i: IndexConfig, whose: "yours" | string): string | undefined {
  if (i.id === REFERENCE_ID || isPristineDefault(i)) return "The default mix: a standard starting point, not tuned to anyone.";
  if (i.focus) return whose === "yours" ? "Fitted from your comparisons. Every weight is open to edit." : `Fitted from ${whose}'s comparisons.`;
  return undefined;
}
export const tabLabel = (i: IndexConfig) => (i.id === REFERENCE_ID || isPristineDefault(i) ? DEFAULT_LABEL : i.name);
