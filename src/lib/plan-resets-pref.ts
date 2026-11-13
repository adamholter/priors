"use client";
import { useSyncExternalStore } from "react";
import type { Snapshot } from "@/data/types";
import { DEFAULT_FABLE_RESETS, hasFableGrant, planResetNote, planResetRows } from "@/data/plan-resets";

/**
 * The visitor's "Count limit resets" choice, kept in this browser. Resets are off by default; turning them on
 * on any chart turns them on everywhere and on later visits, and turning them off clears it. A link's
 * `resets=on` turns them on for that view.
 */
export const PLAN_RESETS_KEY = "priors:plan-resets";
const EVENT = "priors:plan-resets";

const read = () => { try { return localStorage.getItem(PLAN_RESETS_KEY) === "on"; } catch { return false; } };

export function setPlanResetsPref(on: boolean) {
  try { if (on) localStorage.setItem(PLAN_RESETS_KEY, "on"); else localStorage.removeItem(PLAN_RESETS_KEY); } catch { /* storage blocked: the choice still applies this visit */ }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb); window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}

/** True when the visitor turned resets on. False on the server. */
export function usePlanResetsOn(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

/**
 * The "Count limit resets" props for ChartSettings: the toggle, what is counted, and how many Claude Fable grants the visitor
 * holds (asked only while one is in the window).
 */
export function planResetsProps<C extends { planResets?: boolean; fableResets?: number }>(snapshot: Snapshot, config: C, on: boolean, patch: (p: Partial<C>) => void) {
  const fableResets = config.fableResets;
  return {
    value: withResetsPref(config, on).planResets === true,
    onChange: (next: boolean) => { setPlanResetsPref(next); patch({ planResets: next ? true : undefined } as Partial<C>); },
    note: planResetNote(snapshot, { fableResets }), rows: planResetRows(snapshot, { fableResets }),
    fable: hasFableGrant(snapshot) ? { value: fableResets ?? DEFAULT_FABLE_RESETS, onChange: (n: number) => patch({ fableResets: n === DEFAULT_FABLE_RESETS ? undefined : n } as Partial<C>) } : undefined,
  };
}

/** The config with the visitor's choice applied, for pricing. */
export function withResetsPref<C extends { planResets?: boolean }>(config: C, on: boolean): C {
  return on && config.planResets !== true ? { ...config, planResets: true } : config;
}
