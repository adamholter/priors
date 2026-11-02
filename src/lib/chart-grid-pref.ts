"use client";
import { useSyncExternalStore } from "react";
import type { ChartPalette } from "@/components/chart/palette";

/**
 * The visitor's Background grid choice (Advanced), kept in this browser and applied to every chart. Unset, a chart
 * follows its theme: on, except where the theme starts it off (Slop). Choosing what the theme already does clears it.
 */
export const CHART_GRID_KEY = "priors:chart-grid";
const EVENT = "priors:chart-grid";

const read = () => { try { return localStorage.getItem(CHART_GRID_KEY); } catch { return null; } };

export function setChartGridPref(on: boolean, pal: ChartPalette) {
  try { if (on === !pal.style?.gridOff) localStorage.removeItem(CHART_GRID_KEY); else localStorage.setItem(CHART_GRID_KEY, on ? "on" : "off"); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb); window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}

/** Whether charts under this palette draw gridlines. The theme's default on the server. */
export function useChartGrid(pal: ChartPalette): boolean {
  const pref = useSyncExternalStore(subscribe, read, () => null);
  return pref === "on" ? true : pref === "off" ? false : !pal.style?.gridOff;
}
