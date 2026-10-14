"use client";
import { useSyncExternalStore } from "react";
import type { ChartSize } from "./chart/theme";

/**
 * Builder chart scale by viewport width. Mirrors the `--t` steps in builder.css: text and ranking rows
 * grow 1.1× from 1280px and 1.2× from 1600px, chart dots a little more, so big screens read as big.
 */
const STEPS: [number, ChartSize][] = [[0, { mark: 1.15 }], [1280, { text: 1.1, mark: 1.3, height: 1.12, row: 1.1 }], [1600, { text: 1.2, mark: 1.45, height: 1.25, row: 1.2 }]];
const level = () => { let at = 0; STEPS.forEach(([w], i) => { if (window.innerWidth >= w) at = i; }); return at; };
const subscribe = (on: () => void) => { window.addEventListener("resize", on); return () => window.removeEventListener("resize", on); };
const NONE: ChartSize = {};
export function useBuilderSize(): ChartSize {
  const at = useSyncExternalStore(subscribe, level, () => -1);
  return at < 0 ? NONE : STEPS[at][1];
}
