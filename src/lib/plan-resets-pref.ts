"use client";
import { useSyncExternalStore } from "react";

/**
 * The visitor's "Count limit resets" choice, kept in this browser. Turning it off on any chart turns it
 * off everywhere and on later visits; turning it back on clears it. A link's `resets=off` still applies.
 */
export const PLAN_RESETS_KEY = "priors:plan-resets";
const EVENT = "priors:plan-resets";

const read = () => { try { return localStorage.getItem(PLAN_RESETS_KEY) === "off"; } catch { return false; } };

export function setPlanResetsPref(on: boolean) {
  try { if (on) localStorage.removeItem(PLAN_RESETS_KEY); else localStorage.setItem(PLAN_RESETS_KEY, "off"); } catch { /* storage blocked: the choice still applies this visit */ }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb); window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}

/** True when the visitor turned resets off. False on the server. */
export function usePlanResetsOff(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

/** The config with the visitor's choice applied, for pricing. */
export function withResetsPref<C extends { planResets?: false }>(config: C, off: boolean): C {
  return off && config.planResets === undefined ? { ...config, planResets: false } : config;
}
