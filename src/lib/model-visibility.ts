import type { IndexConfig } from "@/engine";
export type Vis = Pick<IndexConfig, "excludeModels" | "onlyModels">;
export function hiddenIds(c: Vis, pickerIds: string[]): Set<string> {
  if (c.onlyModels) { const only = new Set(c.onlyModels); return new Set(pickerIds.filter((id) => !only.has(id))); }
  return new Set(c.excludeModels ?? []);
}
/** Store whichever list is shorter. */
export function compactVisibility(hidden: Set<string>, pickerIds: string[]): Vis {
  const hiddenInPicker = pickerIds.filter((id) => hidden.has(id)).length;
  if (hiddenInPicker > pickerIds.length / 2) return { excludeModels: undefined, onlyModels: pickerIds.filter((id) => !hidden.has(id)) };
  return { excludeModels: hidden.size ? [...hidden] : undefined, onlyModels: undefined };
}
export function toggleVisibility(c: Vis, id: string, pickerIds: string[]): Vis {
  const h = hiddenIds(c, pickerIds); if (h.has(id)) h.delete(id); else h.add(id);
  return compactVisibility(h, pickerIds);
}
export const SHOW_ALL: Vis = { excludeModels: undefined, onlyModels: undefined };
export const HIDE_ALL: Vis = { excludeModels: undefined, onlyModels: [] };
