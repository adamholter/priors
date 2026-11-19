"use client";
import { useMemo, useSyncExternalStore } from "react";
import { currentPlanName, subscriptionPlanOptions } from "@/data/subscription";
import { adjustSnapshot, labPlanMultiples, validAdjustment, type PlanAdjustment } from "@/data/plan-defaults";
import type { Snapshot } from "@/data/types";

/**
 * The visitor's plan per lab for subscription pricing (Advanced → Subscription plans), kept in this browser. Unset, a lab's
 * models are priced at their default plan (the best common one, src/data/plan-defaults.ts). Picking a plan on any chart applies it everywhere and on later visits;
 * a link's or saved page's choice for a lab wins over the visitor's.
 */
export const SUBSCRIPTION_PLANS_KEY = "priors:subscription-plans";
const EVENT = "priors:subscription-plans";
const EMPTY: Record<string, string> = {};

let lastRaw: string | null = null, lastValue = EMPTY;
function read(): Record<string, string> {
  let raw: string | null = null;
  try { raw = localStorage.getItem(SUBSCRIPTION_PLANS_KEY); } catch { /* storage blocked */ }
  if (raw === lastRaw) return lastValue;
  lastRaw = raw;
  try {
    const v = raw ? JSON.parse(raw) : null;
    lastValue = v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => typeof e[1] === "string" && !!e[1])) : EMPTY;
  } catch { lastValue = EMPTY; }
  return lastValue;
}

export function setSubscriptionPlanPref(labId: string, plan: string | undefined) {
  const next = { ...read() };
  if (plan) next[labId] = plan; else delete next[labId];
  try { if (Object.keys(next).length) localStorage.setItem(SUBSCRIPTION_PLANS_KEY, JSON.stringify(next)); else localStorage.removeItem(SUBSCRIPTION_PLANS_KEY); } catch { /* storage blocked: the choice still applies this visit */ }
  window.dispatchEvent(new Event(EVENT));
}

export function clearSubscriptionPlansPref() {
  try { localStorage.removeItem(SUBSCRIPTION_PLANS_KEY); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb); window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}

/** The visitor's plans by lab id. Empty on the server. */
export function useSubscriptionPlansPref(): Record<string, string> {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** The config with the visitor's plans applied under its own, for pricing. */
export function withPlansPref<C extends { subscriptionPlans?: Record<string, string> }>(config: C, pref: Record<string, string>): C {
  return Object.keys(pref).length ? { ...config, subscriptionPlans: { ...pref, ...config.subscriptionPlans } } : config;
}

/**
 * The visitor's adjustments to plan data (bonus credits, a discount), written by the chart settings agent and kept in this browser.
 * Every chart on the page prices with them (`useAdjustedSnapshot`), and the agent's bar lists them, each removable.
 */
export const PLAN_ADJUSTMENTS_KEY = "priors:plan-adjustments";
const ADJUST_EVENT = "priors:plan-adjustments";
const NONE: PlanAdjustment[] = [];
let lastAdjustRaw: string | null = null, lastAdjust = NONE;
function readAdjustments(): PlanAdjustment[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(PLAN_ADJUSTMENTS_KEY); } catch { /* storage blocked */ }
  if (raw === lastAdjustRaw) return lastAdjust;
  lastAdjustRaw = raw;
  try { const v = raw ? JSON.parse(raw) : null; lastAdjust = Array.isArray(v) ? v.filter(validAdjustment) : NONE; } catch { lastAdjust = NONE; }
  return lastAdjust;
}
let sessionAdjustments: PlanAdjustment[] | null = null;
export function setPlanAdjustments(next: PlanAdjustment[]) {
  const list = next.filter(validAdjustment);
  try { if (list.length) localStorage.setItem(PLAN_ADJUSTMENTS_KEY, JSON.stringify(list)); else localStorage.removeItem(PLAN_ADJUSTMENTS_KEY); sessionAdjustments = null; }
  catch { sessionAdjustments = list; /* storage blocked: the change still applies this visit */ }
  window.dispatchEvent(new Event(ADJUST_EVENT));
}
function subscribeAdjustments(cb: () => void) {
  window.addEventListener(ADJUST_EVENT, cb); window.addEventListener("storage", cb);
  return () => { window.removeEventListener(ADJUST_EVENT, cb); window.removeEventListener("storage", cb); };
}
export function usePlanAdjustments(): PlanAdjustment[] {
  return useSyncExternalStore(subscribeAdjustments, () => sessionAdjustments ?? readAdjustments(), () => NONE);
}
/** The snapshot with the visitor's plan adjustments applied; the same object when there are none. */
export function useAdjustedSnapshot(snapshot: Snapshot): Snapshot {
  const adjustments = usePlanAdjustments();
  return useMemo(() => adjustSnapshot(snapshot, adjustments), [snapshot, adjustments]);
}

const optionsCache = new WeakMap<Snapshot, (Omit<ReturnType<typeof subscriptionPlanOptions>[number], "plans"> & { name: string; plans: { plan: string; feeUsd?: number; models: number; multiple?: number }[] })[]>();
/** Advanced → Subscription plans: the labs with more than one plan, named, and the plan each is priced at. `update` stores the change on the index (this view, or the page being edited). */
export function planPicker(snapshot: Snapshot, config: { subscriptionPlans?: Record<string, string> }, pref: Record<string, string>, update: (plans: Record<string, string> | undefined) => void) {
  let labs = optionsCache.get(snapshot);
  if (!labs) {
    // Each plan's subsidy for the lab's models (median), so the picker can draw it and list the biggest first.
    const multiples = labPlanMultiples(snapshot);
    labs = subscriptionPlanOptions(snapshot).map((l) => ({ ...l, name: snapshot.labs.find((x) => x.id === l.labId)?.name ?? l.labId, plans: l.plans.map((p) => ({ ...p, multiple: multiples.get(l.labId)?.get(p.plan) })) }));
    optionsCache.set(snapshot, labs);
  }
  const value = Object.fromEntries(Object.entries(withPlansPref(config, pref).subscriptionPlans ?? {}).map(([lab, plan]) => [lab, currentPlanName(plan)]));
  return {
    labs, value,
    onChange: (labId: string, plan?: string) => {
      setSubscriptionPlanPref(labId, plan);
      const next = { ...config.subscriptionPlans };
      if (plan) next[labId] = plan; else delete next[labId];
      update(Object.keys(next).length ? next : undefined);
    },
    onReset: () => { clearSubscriptionPlansPref(); update(undefined); },
  };
}
