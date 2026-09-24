"use client";
import type { ReactNode } from "react";
import type { Lab } from "@/data/types";
import type { RankedVariant } from "@/engine";
import { ScoreScatter, type ScatterView } from "./ScoreScatter";
import { costChart, pickPoints } from "@/lib/metrics";

export function variantLabel(r: RankedVariant) {
  if (r.variant.configuration && r.variant.sourceModel) return r.variant.sourceModel.name;
  return r.variant.effort === "default" ? r.model.name : `${r.model.name} ${r.variant.effort}`;
}

/** Index score vs measured cost per task (log x), with the Pareto frontier traced in ink. */
export function ParetoChart({ ranked, mode = "all", labs, height = 460, title, actions, view, anchor }: { ranked: RankedVariant[]; mode?: "all" | "best"; labs: Lab[]; height?: number; title?: ReactNode; actions?: ReactNode; view: ScatterView; anchor?: string }) {
  const pts = pickPoints(costChart, ranked, mode);
  return <ScoreScatter pts={pts} labs={labs} better={costChart.better} xName={costChart.xName} xShort={costChart.xShort} scale={costChart.scale} formatX={costChart.formatX} formatValue={costChart.formatValue} height={height} aria={costChart.aria} title={title} actions={actions} view={view} anchor={anchor} exportName="Score vs cost per task"
    tooltipExtra={(p) => p.r.speed ? ` · ${Math.round(p.r.speed)} tok/s` : ""} extraRows={(p) => ({ speed_toks: p.r.speed ?? null, coverage: p.r.coverage })} />;
}
