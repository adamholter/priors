"use client";
import { useSyncExternalStore } from "react";

/** Whether plan prices show student offers (Data → Subscription plans → Plan prices). A display choice kept in this browser: never in a link, a saved page or any price. */
export const STUDENT_PRICING_KEY = "priors:student-pricing";
const EVENT = "priors:student-pricing";

function read(): boolean {
  try { return localStorage.getItem(STUDENT_PRICING_KEY) === "on"; } catch { return false; }
}
export function setStudentPricingPref(on: boolean) {
  try { if (on) localStorage.setItem(STUDENT_PRICING_KEY, "on"); else localStorage.removeItem(STUDENT_PRICING_KEY); } catch { /* storage blocked: applies this visit only */ }
  window.dispatchEvent(new Event(EVENT));
}
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb); window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}
/** Student prices on. Off on the server. */
export const useStudentPricingPref = () => useSyncExternalStore(subscribe, read, () => false);
