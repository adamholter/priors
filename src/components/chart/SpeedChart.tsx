"use client";
import type { ReactNode } from "react";
import type { Lab } from "@/data/types";
import type { RankedVariant } from "@/engine";
import { ScoreScatter, type ScatterView } from "./ScoreScatter";

/** Index score vs output speed (tok/s); faster is better, so the frontier runs toward the right. */
export function SpeedChart({ ranked, labs, height = 400, title, actions, view }: { ranked: RankedVariant[]; labs: Lab[]; height?: number; title?: ReactNode; actions?: ReactNode; view: ScatterView }) {
  const pts = ranked.filter((r) => r.speed && r.speed > 0).map((r) => ({ x: r.speed!, r }));
  return <ScoreScatter pts={pts} labs={labs} better="higher" xName="Output speed (tok/s)" xShort="tok/s" xUnit="tok/s" formatX={(v) => `${Math.round(v)}`} height={height} aria="Index score versus output speed" title={title} actions={actions} view={view} exportName="Speed chart"
    extraRows={(p) => ({ cost_per_task_usd: p.r.costUsd ?? null, coverage: p.r.coverage })} />;
}
