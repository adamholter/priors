"use client";
import { useEffect, type ReactNode } from "react";
import type { Lab } from "@/data/types";
import { ScoreScatter, type ScatterPoint, type ScatterView } from "./ScoreScatter";
import type { ChartLinkParams } from "./ChartLink";

import { linkedLabelScale } from "./label-size";

/** Index score vs output speed (tok/s); faster is better, so the frontier runs toward the right. */
export function SpeedChart({ pts, labs, height = 400, title, actions, view, anchor, linkParams, onView }: { pts: ScatterPoint[]; labs: Lab[]; height?: number; title?: ReactNode; actions?: ReactNode; view: ScatterView; onView?: (view: ScatterView, persist?: boolean) => void; anchor?: string; linkParams?: ChartLinkParams }) {
  useEffect(() => {
    if (!anchor || !onView) return;
    const url = new URL(window.location.href);
    if (decodeURIComponent(url.hash.slice(1)) !== anchor && url.searchParams.get("c") !== anchor) return;
    const labelScale = linkedLabelScale(url.searchParams);
    if (labelScale != null) onView({ ...view, labelScale }, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialize only for this chart link
  }, [anchor]);
  return <ScoreScatter pts={pts} labs={labs} better="higher" xName="Output speed (tok/s)" xShort="tok/s" xUnit="tok/s" formatX={(v) => `${Math.round(v)}`} height={height} aria="Index score versus output speed" title={title} actions={actions} view={view} anchor={anchor} exportName="Output speed" linkParams={linkParams}
    extraRows={(p) => ({ cost_per_task_usd: p.r.costUsd ?? null, coverage: p.r.coverage })} />;
}
