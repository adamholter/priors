"use client";
import { createContext, useContext } from "react";

/**
 * What a score chart's vertical axis shows. Everywhere else it is the index score (0 to 100); a benchmark's own page
 * plots the benchmark's published value instead (a dollar balance, an Elo), so the axis is named for it and fits the data.
 */
export interface ScoreAxis { name: string; format: (v: number) => string; fit: boolean }
export const INDEX_SCORE_AXIS: ScoreAxis = { name: "Index score", format: (v) => v.toFixed(1), fit: false };
export const ScoreAxisContext = createContext<ScoreAxis>(INDEX_SCORE_AXIS);
export const useScoreAxis = () => useContext(ScoreAxisContext);

/** Axis bounds: the index score keeps its 0 to 100 frame; a published value gets a padded range around its data. */
export function scoreRange(ys: number[], fit: boolean): [number, number] {
  if (!fit) return [Math.max(0, Math.floor((Math.min(...ys, 100) - 6) / 5) * 5), Math.min(100, Math.ceil((Math.max(...ys, 0) + 4) / 5) * 5)];
  const lo = Math.min(...ys), hi = Math.max(...ys), pad = (hi - lo || Math.abs(hi) || 1) * 0.08;
  const step = 10 ** Math.floor(Math.log10(hi - lo + 2 * pad || 1));
  return [lo >= 0 && lo - pad < 0 ? 0 : Math.floor((lo - pad) / step) * step, Math.ceil((hi + pad) / step) * step];
}
