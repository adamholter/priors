import type { IndexConfig } from "@/engine";
export type Vis = Pick<IndexConfig, "excludeModels" | "onlyModels">;
/** Models the view hides. An index nobody has curated hides `auto` (superseded versions); any explicit choice replaces that. */
export function hiddenIds(c: Vis, pickerIds: string[], auto: string[] = []): Set<string> {
  if (c.onlyModels === undefined && c.excludeModels === undefined) return new Set(auto);
  if (c.onlyModels) { const only = new Set(c.onlyModels); return new Set(pickerIds.filter((id) => !only.has(id))); }
  return new Set(c.excludeModels ?? []);
}
/** Store hidden models explicitly so models added later remain visible. */
export function compactVisibility(hidden: Set<string>, pickerIds: string[]): Vis {
  const known = new Set(pickerIds);
  return { excludeModels: [...pickerIds.filter((id) => hidden.has(id)), ...[...hidden].filter((id) => !known.has(id))], onlyModels: undefined };
}
export function toggleVisibility(c: Vis, id: string, pickerIds: string[], auto: string[] = []): Vis {
  const h = hiddenIds(c, pickerIds, auto); if (h.has(id)) h.delete(id); else h.add(id);
  return compactVisibility(h, pickerIds);
}
/** Shown models are an explicit choice: an empty list, so the default view of superseded versions no longer applies. */
export const SHOW_ALL: Vis = { excludeModels: [], onlyModels: undefined };
export const HIDE_ALL: Vis = { excludeModels: undefined, onlyModels: [] };
