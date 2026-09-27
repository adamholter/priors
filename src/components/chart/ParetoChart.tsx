"use client";
import { useEffect, useState, type ReactNode } from "react";
import { MetricBars } from "./MetricBars";
import type { Lab } from "@/data/types";
import type { RankedVariant } from "@/engine";
import { ScoreScatter, type ScatterView } from "./ScoreScatter";
import { costChart, pickPoints } from "@/lib/metrics";

export function variantLabel(r: RankedVariant) {
  if (r.variant.configuration && r.variant.sourceModel) return r.variant.sourceModel.name;
  return r.variant.effort === "default" ? r.model.name : `${r.model.name} ${r.variant.effort}`;
}

/** Index score vs measured cost per task (log x), with the Pareto frontier traced in ink. */
export function ParetoChart({ ranked, mode = "all", labs, height = 460, title, actions, view, onView, anchor, description }: { ranked: RankedVariant[]; mode?: "all" | "best"; labs: Lab[]; height?: number; title?: ReactNode; actions?: ReactNode; view: ScatterView; onView: (view: ScatterView) => void; anchor?: string; description?: string }) {
  const [linkedKind, setLinkedKind] = useState<"bars" | "scatter">();
  useEffect(() => {
    if (!anchor) return;
    const url = new URL(window.location.href);
    if (decodeURIComponent(url.hash.slice(1)) !== anchor && url.searchParams.get("c") !== anchor) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- apply chart deep link after hydration
    setLinkedKind(url.searchParams.get("cv") === "bars" ? "bars" : "scatter");
  }, [anchor]);
  const bars = (linkedKind ?? view.kind) === "bars";
  const changeKind = (kind: "bars" | "scatter") => {
    setLinkedKind(kind);
    onView({ ...view, kind });
    const url = new URL(window.location.href);
    if (anchor && (decodeURIComponent(url.hash.slice(1)) === anchor || url.searchParams.get("c") === anchor)) {
      if (kind === "bars") url.searchParams.set("cv", "bars"); else url.searchParams.delete("cv");
      window.history.replaceState(null, "", url.toString());
    }
  };
  const controls = <><div className="seg" role="group" aria-label="Cost chart type">
    <button type="button" aria-pressed={!bars} title="Score vs cost" onClick={() => changeKind("scatter")}><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="4" cy="11" r="1.6" /><circle cx="8" cy="6" r="1.6" /><circle cx="12.5" cy="4" r="1.6" /><circle cx="10" cy="10" r="1.6" /></svg></button>
    <button type="button" aria-pressed={bars} title="Bar chart" onClick={() => changeKind("bars")}><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="2" y="3" width="3" height="11" /><rect x="6.5" y="6" width="3" height="8" /><rect x="11" y="9" width="3" height="5" /></svg></button>
  </div>{actions}</>;
  const linkParams = { cv: bars ? "bars" as const : undefined };
  const pts = pickPoints(costChart, ranked, mode);
  const heading = <div>{bars ? <h2 className="text-[22px]">Cost per task</h2> : title}{description && <p className="cap mt-1">{description}</p>}</div>;
  if (bars) return <MetricBars pts={pts} labs={labs} better={costChart.better} xName="Cost per task ($)" formatValue={costChart.formatX} height={height} aria="Cost per task by model" title={heading} actions={controls} anchor={anchor} linkParams={linkParams} exportName="Cost per task" />;
  return <ScoreScatter pts={pts} labs={labs} better={costChart.better} xName={costChart.xName} xShort={costChart.xShort} scale={costChart.scale} formatX={costChart.formatX} formatValue={costChart.formatValue} height={height} aria={costChart.aria} title={heading} actions={controls} linkParams={linkParams} view={view} anchor={anchor} exportName="Score vs cost per task"
    tooltipExtra={(p) => p.r.speed ? ` · ${Math.round(p.r.speed)} tok/s` : ""} extraRows={(p) => ({ speed_toks: p.r.speed ?? null, coverage: p.r.coverage })} />;
}
