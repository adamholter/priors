"use client";
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { isHighlighted, itemLabel, toggleModel, togglePoint, useHighlight, type HighlightModel, type HighlightState } from "./highlight";
import type { ScatterPoint } from "./scatter-option";
import { STAR_CAP, addStars, pickable, removeStars } from "./star-menu";

/** Small shared stores and hooks for the star picker, the starred-name line and the chart's point card. */

const store = <T,>(init: T) => {
  let v = init; const l = new Set<() => void>();
  return { get: () => v, set: (n: T) => { if (n === v) return; v = n; l.forEach((f) => f()); }, sub: (cb: () => void) => { l.add(cb); return () => { l.delete(cb); }; } };
};

/** The starred item (a model id or a variant id) whose name is under the pointer: every chart draws its guides and card, so thinning guides never hides a number. */
const hot = store<string | null>(null);
export const setHotStar = hot.set;
export const useHotStar = () => useSyncExternalStore(hot.sub, hot.get, () => null);

/** Bumped when a star is refused at the cap: the count on the star icon pulses. */
const pulse = store(0);
export const bumpStarPulse = () => pulse.set(pulse.get() + 1);
export const useStarPulse = () => useSyncExternalStore(pulse.sub, pulse.get, () => 0);

const mq = (q: string) => (cb: () => void) => { const m = window.matchMedia(q); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };
const PHONE = "(max-width: 639.98px)", COARSE = "(pointer: coarse)";
export const usePhone = () => useSyncExternalStore(mq(PHONE), () => window.matchMedia(PHONE).matches, () => false);
export const useCoarse = () => useSyncExternalStore(mq(COARSE), () => window.matchMedia(COARSE).matches, () => false);

/** Star or unstar one mark (that exact effort). A star past the cap is refused and pulses the count. */
export function toggleStar(h: HighlightState, pts: ScatterPoint[], p: ScatterPoint) {
  const next = togglePoint(h.items, pts, p);
  if (next.length > h.items.length && next.length > STAR_CAP) { bumpStarPulse(); return; }
  h.set(next);
}

/** What the picker, the name line and the point card read and write. Every action is stable across renders, which keeps lists of 65 rows from redrawing. */
export function useStars() {
  const h = useHighlight(), live = useRef(h);
  useEffect(() => { live.current = h; }, [h]);
  const models = useMemo(() => h?.models ?? [], [h?.models]);
  const items = useMemo(() => h?.items ?? [], [h?.items]);
  const byId = useMemo(() => new Map<string, HighlightModel>(models.map((m) => [m.id, m])), [models]);
  // `live` moves on at once, so two stars in one tick (a quick pick, then another) build on each other instead of the render in between.
  const set = useCallback((next: string[]) => { const cur = live.current; if (!cur) return; const items = next.slice(0, STAR_CAP); live.current = { ...cur, items }; cur.set(items); }, []);
  const toggle = useCallback((id: string) => {
    const cur = live.current?.items; if (!cur) return;
    if (!isHighlighted(cur, id) && cur.length >= STAR_CAP) { bumpStarPulse(); return; }
    set(toggleModel(cur, id));
  }, [set]);
  const add = useCallback((ids: string[]) => {
    const cur = live.current?.items; if (!cur) return;
    const next = addStars(cur, ids);
    if (next.length === cur.length && ids.length) bumpStarPulse(); else set(next);
  }, [set]);
  const remove = useCallback((ids: string[]) => { const cur = live.current?.items; if (cur) set(removeStars(cur, ids)); }, [set]);
  const removeItem = useCallback((it: string) => { const cur = live.current?.items; if (cur) set(cur.filter((x) => x !== it)); }, [set]);
  const clear = useCallback(() => set([]), [set]);
  const on = useCallback((id: string) => isHighlighted(items, id), [items]);
  const label = useCallback((it: string) => itemLabel(it, models), [models]);
  // The list only changes when a starred model beyond the ranked ones comes or goes, so starring a ranked model redraws no row.
  const ranked = h?.ranked;
  const tail = useMemo(() => (ranked && ranked < models.length ? models.slice(ranked).filter((m) => isHighlighted(items, m.id)).map((m) => m.id).join("|") : ""), [models, ranked, items]);
  const list = useMemo(() => pickable(models, ranked, tail ? tail.split("|") : []), [models, ranked, tail]);
  return { h, models, items, byId, list, full: items.length >= STAR_CAP, toggle, add, remove, removeItem, clear, on, label };
}
export type Stars = ReturnType<typeof useStars>;
