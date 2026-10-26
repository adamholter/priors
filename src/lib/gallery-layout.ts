import type { GalleryMetric } from "../../convex/validators";

/**
 * Gallery order and visibility. Without a saved layout every metric shows in the default order. With
 * one, saved entries come first in their order; metrics added since are listed (hidden) so the owner
 * can turn them on, and never appear to visitors unannounced.
 */
export function arrangeMetrics<T extends { id: string; open?: boolean }>(panels: T[], layout?: GalleryMetric[]): (T & { hidden: boolean; open: boolean; entry?: GalleryMetric })[] {
  if (!layout) return panels.map((p) => ({ ...p, hidden: false, open: !!p.open }));
  const byId = new Map(panels.map((p) => [p.id, p]));
  const saved = layout.flatMap((e) => { const p = byId.get(e.id); return p ? [{ ...p, hidden: !!e.hidden, open: e.open ?? !!p.open, entry: e }] : []; });
  const fresh = panels.filter((p) => !layout.some((e) => e.id === p.id)).map((p) => ({ ...p, hidden: true, open: !!p.open }));
  return [...saved, ...fresh];
}

