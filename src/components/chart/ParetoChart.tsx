"use client";
import type { ReactNode } from "react";
import type { Lab } from "@/data/types";
import type { RankedVariant } from "@/engine";
import { ScoreScatter, type ScatterView } from "./ScoreScatter";

export function variantLabel(r: RankedVariant) {
  if (r.variant.configuration && r.variant.sourceModel) return r.variant.sourceModel.name;
  return r.variant.effort === "default" ? r.model.name : `${r.model.name} ${r.variant.effort}`;
}

const money = (v: number) => `$${v >= 10 ? Math.round(v) : v >= 1 ? v.toFixed(1).replace(/\.0$/, "") : v >= 0.01 ? v.toFixed(2).replace(/0$/, "") : v.toPrecision(1)}`;

/** Index score vs measured cost per task (log x), with the Pareto frontier traced in ink. */
export function ParetoChart({ ranked, labs, height = 460, title, actions, view }: { ranked: RankedVariant[]; labs: Lab[]; height?: number; title?: ReactNode; actions?: ReactNode; view: ScatterView }) {
  const pts = ranked.filter((r) => r.costUsd != null && r.costUsd > 0).map((r) => ({ x: r.costUsd!, r }));
  return <ScoreScatter pts={pts} labs={labs} better="lower" xName="Cost per task ($, log)" xShort="$ / task (log)" scale="log" formatX={money} formatValue={(v) => `$${v.toFixed(v < 0.1 ? 3 : 2)}/task`} height={height} aria="Index score versus cost per task" title={title} actions={actions} view={view} exportName="Score vs cost per task"
    tooltipExtra={(p) => p.r.speed ? ` · ${Math.round(p.r.speed)} tok/s` : ""} extraRows={(p) => ({ speed_toks: p.r.speed ?? null, coverage: p.r.coverage })} />;
}
