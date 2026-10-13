"use client";
import { useSyncExternalStore } from "react";

/** Easter egg: the Konami code switches gravity on for Pareto charts (and off again). */
const CODE = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
let on = false, at = 0;
const subs = new Set<() => void>();

/**
 * True when this key is the next step of a code already past its ups and downs. Anything else that
 * listens for left and right (the page tabs) stands down for that press, so entering the code never
 * also switches tabs. The listener below still counts the key: nobody stops it on the way to window.
 */
export const midCode = (key: string) => at >= 4 && key === CODE[at];

function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) { at = 0; return; }
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  // A third "up" still leaves two ups entered.
  at = k === CODE[at] ? at + 1 : k === "ArrowUp" ? (at === 2 ? 2 : 1) : 0;
  if (at < CODE.length) return;
  at = 0; on = !on;
  subs.forEach((f) => f());
}
function subscribe(f: () => void) {
  if (!subs.size) window.addEventListener("keydown", onKey);
  subs.add(f);
  return () => { subs.delete(f); if (!subs.size) window.removeEventListener("keydown", onKey); };
}
export const useGravity = () => useSyncExternalStore(subscribe, () => on, () => false);
