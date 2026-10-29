"use client";
import { useSyncExternalStore } from "react";
import { subscriptionPlanOptions } from "@/data/subscription";
import type { Snapshot } from "@/data/types";

/**
 * The visitor's plan per lab for subscription pricing (Advanced → Plan), kept in this browser. Unset, a lab's
 * models are priced at their median plan. Picking a plan on any chart applies it everywhere and on later visits;
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

const optionsCache = new WeakMap<Snapshot, { labId: string; name: string; plans: { plan: string; feeUsd?: number; models: number }[] }[]>();
/** Advanced → Plan: the labs with more than one plan, named, and the plan each is priced at. `update` stores the change on the index (this view, or the page being edited). */
export function planPicker(snapshot: Snapshot, config: { subscriptionPlans?: Record<string, string> }, pref: Record<string, string>, update: (plans: Record<string, string> | undefined) => void) {
  let labs = optionsCache.get(snapshot);
  if (!labs) { labs = subscriptionPlanOptions(snapshot).map((l) => ({ ...l, name: snapshot.labs.find((x) => x.id === l.labId)?.name ?? l.labId })); optionsCache.set(snapshot, labs); }
  const value = withPlansPref(config, pref).subscriptionPlans ?? {};
  return {
    labs, value,
    onChange: (labId: string, plan?: string) => {
      setSubscriptionPlanPref(labId, plan);
      const next = { ...config.subscriptionPlans };
      if (plan) next[labId] = plan; else delete next[labId];
      update(Object.keys(next).length ? next : undefined);
    },
  };
}
