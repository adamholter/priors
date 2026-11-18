"use client";
import { useSyncExternalStore } from "react";

/**
 * Easter egg: model paths on the cost chart. Type IDDT, Doom's reveal-the-map cheat, to leave them on until it is typed
 * again. Hold Shift for the path under the cursor plus its history on the hover card; only Shift touches the card.
 */
const CODE = "iddt";
let on = false, held = false, at = 0;
const subs = new Set<() => void>();
const tell = () => subs.forEach((f) => f());
const setHeld = (next: boolean) => { if (held !== next) { held = next; tell(); } };

function onKey(e: KeyboardEvent) {
  if (e.key === "Shift") { setHeld(true); return; }
  const t = e.target as HTMLElement | null;
  if (e.metaKey || e.ctrlKey || e.altKey || (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) { at = 0; return; }
  const k = e.key.toLowerCase();
  at = k === CODE[at] ? at + 1 : k === CODE[0] ? 1 : 0;
  if (at < CODE.length) return;
  at = 0; on = !on; tell();
}
const onKeyUp = (e: KeyboardEvent) => { if (e.key === "Shift") setHeld(false); };
const release = () => setHeld(false);

function subscribe(f: () => void) {
  if (!subs.size) { window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKeyUp); window.addEventListener("blur", release); }
  subs.add(f);
  return () => {
    subs.delete(f);
    if (!subs.size) { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKeyUp); window.removeEventListener("blur", release); }
  };
}
export const useModelPathsOn = () => useSyncExternalStore(subscribe, () => on, () => false);
export const useShiftHeld = () => useSyncExternalStore(subscribe, () => held, () => false);
