import { defaultConfig, type IndexConfig } from "../engine";
import type { Snapshot } from "../data/types";
import { AA_INDEX_SETTINGS } from "../onboarding/defaults";
import { encodeIndex } from "./url";

/** The reference index added on request ("Compare with the AA Index"). It never counts as an untouched default, so it is not tidied away. */
export const REFERENCE_ID = "ref-general";
export const REFERENCE_LABEL = "Compare with the AA Index";

// Compared through the URL encoding, which is how the index travels: a link or a saved copy loses its id and fills in defaults.
// Sorted, because AA's own component order changes between versions and that is not an edit.
const signature = (i: IndexConfig) => encodeIndex({ ...i, id: "x", weights: Object.fromEntries(Object.entries(i.weights).sort(([a], [b]) => a.localeCompare(b))), highlight: i.highlight?.length ? i.highlight : undefined });

/** True when the weights are only AA's composite. Hiding a model or starring one leaves this true; changing the mix does not. */
export function isAAWeights(i: IndexConfig): boolean {
  const on = Object.entries(i.weights).filter(([, w]) => w > 0);
  return on.length === 1 && on[0][0].startsWith("aa-intelligence-index-");
}

/** True for the index every visitor starts with (AA's index, at any version), untouched. Anything edited, renamed or fitted is theirs. */
export function isPristineDefault(i: IndexConfig): boolean {
  return i.id !== REFERENCE_ID && /^Artificial Analysis Index( v[\d.]+)?$/.test(i.name) && isAAWeights(i) && signature(i) === signature({ ...AA_INDEX_SETTINGS, name: i.name, weights: i.weights });
}

/** The old opening mix, saved in the browser of anyone who visited before AA's index became the default. Nobody chose it. */
export function isOldDefault(i: IndexConfig): boolean {
  const old = defaultConfig({} as Snapshot);
  return i.id !== REFERENCE_ID && i.name === old.name && signature(i) === signature(old);
}

/** Two near-identical rankings under two tabs read as a bug. When the visitor has made an index of their own, the untouched default steps aside. */
export function withoutPristineDefault<T extends IndexConfig>(list: T[]): T[] {
  if (list.length < 2) return list;
  const kept = list.filter((i) => !isPristineDefault(i));
  return kept.length ? kept : list;
}

/** What to restore from this browser: the visitor's own indices only, so a saved default never pins someone to an old index. */
export const restorable = <T extends IndexConfig>(list: T[]): T[] => list.filter((i) => !isPristineDefault(i) && !isOldDefault(i));

/** What a tab is, in words: whose it is and where it came from. */
export function indexNote(i: IndexConfig, whose: "yours" | string): string | undefined {
  if (i.id === REFERENCE_ID || isPristineDefault(i)) return "As published by Artificial Analysis.";
  if (i.focus) return whose === "yours" ? "Fitted from your comparisons. Every weight is open to edit." : `Fitted from ${whose}'s comparisons.`;
  return undefined;
}
