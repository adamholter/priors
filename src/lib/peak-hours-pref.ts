"use client";
import { useSyncExternalStore } from "react";
import { isPeakHours, type PeakHours } from "@/data/subscription";

/** Peak hours (Data → Subscription plans): which time-of-day row prices plans sold by time of day. A display choice kept in this browser, like Plan prices: Student; never in a link or a saved page. Unset is the headline rows. */
export const PEAK_HOURS_KEY = "priors:peak-hours";
const EVENT = "priors:peak-hours";

function read(): PeakHours | undefined {
  try { const v = localStorage.getItem(PEAK_HOURS_KEY); return isPeakHours(v) ? v : undefined; } catch { return undefined; }
}
export function setPeakHoursPref(value: PeakHours | undefined) {
  try { if (value) localStorage.setItem(PEAK_HOURS_KEY, value); else localStorage.removeItem(PEAK_HOURS_KEY); } catch { /* storage blocked: applies this visit only */ }
  window.dispatchEvent(new Event(EVENT));
}
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb); window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}
/** The visitor's Peak hours, for `ViewOptions.peakHours`. Unset on the server. */
export const usePeakHoursPref = () => useSyncExternalStore(subscribe, read, () => undefined);
