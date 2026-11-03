import { useEffect, useState } from "react";

const KEY = "priors:seen-models";

/**
 * Which of these models are new to this visitor. A first visit has nothing to compare with, so nothing is new and every
 * model counts as seen from then on. `stored` is what the last visit saved (null when there was none).
 */
export function newModels(ids: string[], stored: string | null): { fresh: Set<string>; save: string } {
  let seen: Set<string> | null = null;
  try { const parsed = JSON.parse(stored ?? "null"); if (Array.isArray(parsed)) seen = new Set(parsed.filter((x) => typeof x === "string")); } catch { /* a damaged value counts as a first visit */ }
  return { fresh: new Set(seen ? ids.filter((id) => !seen.has(id)) : []), save: JSON.stringify([...new Set([...(seen ?? []), ...ids])]) };
}

// Decided once per page load, so a model stays labeled while moving between pages, then counts as seen on the next visit.
let decided: Set<string> | null = null;
const EMPTY = new Set<string>();

/** The models to label New. Pages showing a whole snapshot call this; a benchmark page's trimmed snapshot would make everything else look new later. */
export function useNewModels(models: { id: string }[]): Set<string> {
  const [fresh, setFresh] = useState(EMPTY);
  useEffect(() => {
    if (!models.length) return;
    const id = requestAnimationFrame(() => {
      try {
        if (!decided) { const { fresh: found, save } = newModels(models.map((m) => m.id), localStorage.getItem(KEY)); decided = found; localStorage.setItem(KEY, save); }
        setFresh(decided);
      } catch { /* storage can be disabled */ }
    });
    return () => cancelAnimationFrame(id);
  }, [models]);
  return fresh;
}
