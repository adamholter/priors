"use client";
import type { ReactNode } from "react";
import type { Lab } from "@/data/types";
import { ScoreScatter, type ScatterPoint, type ScatterView } from "./ScoreScatter";
import type { ChartLinkParams } from "./ChartLink";

/** Index score vs output speed (tok/s); faster is better, so the frontier runs toward the right. */
export function SpeedChart({ pts, labs, height = 400, title, actions, view, anchor, linkParams }: { pts: ScatterPoint[]; labs: Lab[]; height?: number; title?: ReactNode; actions?: ReactNode; view: ScatterView; anchor?: string; linkParams?: ChartLinkParams }) {
  return <ScoreScatter pts={pts} labs={labs} better="higher" xName="Output speed (tok/s)" xShort="tok/s" xUnit="tok/s" formatX={(v) => `${Math.round(v)}`} height={height} aria="Index score versus output speed" title={title} actions={actions} view={view} anchor={anchor} exportName="Output speed" linkParams={linkParams}
    extraRows={(p) => ({ cost_per_task_usd: p.r.costUsd ?? null, coverage: p.r.coverage })} />;
}
