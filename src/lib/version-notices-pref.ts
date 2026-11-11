"use client";
import { useSyncExternalStore } from "react";
import { MAX_DISMISSED, NOTICES_DISMISSED_KEY, NOTICES_OFF_KEY } from "./version-notices";

/**
 * Benchmark version notices are on unless the visitor turned them off: `priors:version-notices` = `off`, set from
 * the toast's "Turn off update notices" and cleared from Settings. Dismissed notices are kept by key in
 * `priors:version-notices-dismissed`.
 */
const EVENT = "priors:version-notices";

const readOff = () => { try { return localStorage.getItem(NOTICES_OFF_KEY) === "off"; } catch { return false; } };

export function setNoticesOn(on: boolean) {
  try { if (on) localStorage.removeItem(NOTICES_OFF_KEY); else localStorage.setItem(NOTICES_OFF_KEY, "off"); } catch { /* storage blocked: applies this visit */ }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb); window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}

/** True while notices are on. Off on the server, so nothing shows before the browser has read the choice. */
export function useNoticesOn(): boolean {
  return useSyncExternalStore(subscribe, () => !readOff(), () => false);
}

export function readDismissed(): Set<string> {
  try { const v = JSON.parse(localStorage.getItem(NOTICES_DISMISSED_KEY) ?? "[]"); return new Set(Array.isArray(v) ? v.filter((x) => typeof x === "string") : []); } catch { return new Set(); }
}

export function addDismissed(keys: string[]) {
  try { const all = [...readDismissed(), ...keys]; localStorage.setItem(NOTICES_DISMISSED_KEY, JSON.stringify([...new Set(all)].slice(-MAX_DISMISSED))); } catch { /* storage blocked */ }
}
