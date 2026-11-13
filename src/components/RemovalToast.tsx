"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { IndexConfig } from "@/engine";

const SHOW_MS = 8000;

/** The benchmarks a mix lost between two versions: weighted before, at 0 or gone after. */
export function removedBenchmarks(before: Record<string, number>, after: Record<string, number>): string[] {
  return Object.keys(before).filter((id) => before[id] > 0 && !(after[id] > 0));
}

/** "⌘Z" on Apple keyboards, "Ctrl+Z" elsewhere. */
const undoKey = () => (typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘Z" : "Ctrl+Z");

/**
 * Taking a benchmark out of the mix (its × , its slider to 0%, unticking it, Clear all) drops it from the ranking, and finding
 * it again means searching for it. So a removal says what left and offers it back for a few seconds; ⌘Z / Ctrl+Z does the same.
 * `undo` is the mix's own undo (`useUndoable`): a slider drag is one step, so undoing it brings back the weight from before the drag.
 */
export function useRemovalToast(config: IndexConfig, nameOf: (id: string) => string, undo: () => void) {
  const [removed, setRemoved] = useState<string[] | null>(null);
  const prev = useRef(config), undoing = useRef(false);
  useEffect(() => {
    const before = prev.current;
    prev.current = config;
    if (undoing.current) { undoing.current = false; setRemoved(null); return; }
    if (before === config || before.id !== config.id) return;
    const gone = removedBenchmarks(before.weights, config.weights);
    if (gone.length) setRemoved(gone);
    // Adding a benchmark back by hand makes the offer moot.
    else if (removed?.some((id) => config.weights[id] > 0)) setRemoved(null);
  }, [config, removed]);
  useEffect(() => {
    if (!removed) return;
    const t = setTimeout(() => setRemoved(null), SHOW_MS);
    return () => clearTimeout(t);
  }, [removed]);
  const undoRemoval = useCallback(() => { undoing.current = true; undo(); }, [undo]);
  const text = removed && (removed.length === 1 ? <>Removed <b className="font-medium">{nameOf(removed[0])}</b> from your mix.</> : <>Removed {removed.length} benchmarks from your mix.</>);
  const toast = removed && (
    <div className="assistant-toast flex items-center gap-3" role="status" aria-live="polite">
      <span>{text}</span>
      <button type="button" className="text-control text-indigo" onClick={undoRemoval}>Undo</button>
      <span className="cap" aria-hidden="true">{undoKey()}</span>
    </div>
  );
  return { toast, undo: undoRemoval };
}
