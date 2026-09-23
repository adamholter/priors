"use client";
import type { ReactNode } from "react";
import type { Lab } from "@/data/types";
import { ScoreScatter, type ScatterPoint, type ScatterView } from "./ScoreScatter";

export type MetricPoint = ScatterPoint;

/** Index-score-vs-metric scatter used by the metric gallery. */
export function MetricScatter({ pts, labs, xLabel, xName, scale = "linear", better = "lower", formatX, formatValue, height = 400, aria, actions, view, exportName, anchor }: {
  pts: MetricPoint[]; labs: Lab[]; xLabel: string; xName: string; scale?: "linear" | "log" | "time"; better?: "lower" | "higher";
  formatX: (x: number) => string; formatValue?: (x: number) => string; height?: number; aria: string; actions?: ReactNode; view: ScatterView; exportName?: string; anchor?: string;
}) {
  return <ScoreScatter pts={pts} labs={labs} better={better} xName={xName} xUnit={xLabel} scale={scale} formatX={formatX} formatValue={formatValue} height={height} aria={aria} actions={actions} view={view} exportName={exportName ?? xName} anchor={anchor} />;
}
