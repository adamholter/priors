import { useCallback, useState, type SetStateAction } from "react";

/** A value and the versions before it. Edits within `QUIET_MS` of each other are one step, so a slider drag or a run of quick clicks undoes at once. */
export type Undoable<T> = { present: T; past: T[]; at: number };
export const QUIET_MS = 800;
const DEPTH = 30;

export const startUndoable = <T,>(present: T): Undoable<T> => ({ present, past: [], at: 0 });

export function applyEdit<T>(state: Undoable<T>, next: T, now: number): Undoable<T> {
  if (next === state.present) return state;
  return { present: next, past: now - state.at < QUIET_MS ? state.past : [...state.past.slice(-(DEPTH - 1)), state.present], at: now };
}

export function undoEdit<T>(state: Undoable<T>): Undoable<T> {
  if (!state.past.length) return state;
  return { present: state.past[state.past.length - 1], past: state.past.slice(0, -1), at: 0 };
}

export function useUndoable<T>(initial: () => T) {
  const [state, setState] = useState(() => startUndoable(initial()));
  const set = useCallback((action: SetStateAction<T>) => setState((s) => applyEdit(s, typeof action === "function" ? (action as (prev: T) => T)(s.present) : action, Date.now())), []);
  /** For state that is not an edit, such as restoring a saved mix on load: nothing to undo back to. */
  const load = useCallback((value: T) => setState(startUndoable(value)), []);
  const undo = useCallback(() => setState(undoEdit), []);
  return { value: state.present, set, load, undo, canUndo: state.past.length > 0 };
}
