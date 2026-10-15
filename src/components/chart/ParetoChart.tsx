"use client";
import { useEffect, useState, type ReactNode } from "react";
import { MetricBars } from "./MetricBars";
import type { Lab } from "@/data/types";
import { subscriptionShare, type RankedVariant } from "@/engine";
import { ScoreScatter, type ScatterView } from "./ScoreScatter";
import { costChartFor, pickPoints, type FormulaInputs } from "@/lib/metrics";
import { linkedFormula, useFormulaChart, type FormulaSettings } from "./formula-chart";
import type { CostBasis } from "@/data/subscription";
import { useBarModelVisibility, type BarModelPicker } from "./bar-model-visibility";

import { linkedLabelScale } from "./label-size";

export function variantLabel(r: RankedVariant) {
  if (r.variant.configuration && r.variant.sourceModel) return r.variant.sourceModel.name;
  return r.variant.effort === "default" ? r.model.name : `${r.model.name} ${r.variant.effort}`;
}

/** Index score vs measured cost per task (log x), with the Pareto frontier traced in ink. */
/** `actions` receives the bar view's model picker plus what chart settings need for the custom formula. */
export type ParetoSettings = Partial<BarModelPicker> & { formula?: FormulaSettings; defaultScale?: "log" | "linear" };

export function ParetoChart({ ranked, mode = "all", labs, height = 460, title, actions, view: savedView, onView, anchor, description, basis = "subscription", formulaInputs }: { /** Enables the custom formula in Advanced settings. */ formulaInputs?: FormulaInputs; basis?: CostBasis; ranked: RankedVariant[]; mode?: "all" | "best"; labs: Lab[]; height?: number; title?: ReactNode; actions?: ReactNode | ((settings?: ParetoSettings) => ReactNode); view: ScatterView; onView: (view: ScatterView, persist?: boolean) => void; anchor?: string; description?: string }) {
  const [linkedKind, setLinkedKind] = useState<"bars" | "scatter">();
  // Read once: the effect below that mirrors the formula into the URL would otherwise erase a linked one before a remount reads it.
  const [linkedCustom] = useState(() => (typeof window === "undefined" ? undefined : linkedFormula(new URL(window.location.href).searchParams)));
  useEffect(() => {
    if (!anchor) return;
    const url = new URL(window.location.href);
    if (decodeURIComponent(url.hash.slice(1)) !== anchor && url.searchParams.get("c") !== anchor) return;
    const kind = url.searchParams.get("cv") === "bars" ? "bars" : "scatter";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- apply chart deep link after hydration
    setLinkedKind(kind);
    const scale = url.searchParams.get("cs"), labelScale = linkedLabelScale(url.searchParams);
    onView({ ...savedView, ...linkedCustom, kind, kindChosen: true, ...(labelScale != null ? { labelScale } : {}), ...(scale === "log" || scale === "linear" ? { scale } : {}) }, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialize only when the chart anchor changes
  }, [anchor]);
  const bars = (linkedKind ?? savedView.kind) === "bars";
  const changeKind = (kind: "bars" | "scatter") => {
    setLinkedKind(kind);
    onView({ ...savedView, kind });
    const url = new URL(window.location.href);
    if (anchor && (decodeURIComponent(url.hash.slice(1)) === anchor || url.searchParams.get("c") === anchor)) {
      if (kind === "bars") url.searchParams.set("cv", "bars"); else url.searchParams.delete("cv");
      window.history.replaceState(null, "", url.toString());
    }
  };
  const baseChart = costChartFor(basis), subscription = basis === "subscription";
  // Advanced settings can swap cost for a custom formula.
  const formula = useFormulaChart(baseChart, savedView, formulaInputs, ranked), view = formula.view;
  const costChart = formula.custom ? { ...formula.custom, xShort: formula.custom.xName, formatValue: undefined } : baseChart;
  const allPoints = costChart.points(ranked), pts = pickPoints(costChart, ranked, mode);
  const barVisibility = useBarModelVisibility({ metricPoints: allPoints, points: pts, better: costChart.better, ranked });
  const formulaSettings = { formula: formula.settings, defaultScale: formula.defaultScale };
  const scatterActions = typeof actions === "function" ? actions(formulaSettings) : actions;
  const barActions = typeof actions === "function" ? actions({ ...barVisibility.picker, ...formulaSettings }) : actions;
  const controls = <><div className="seg" role="group" aria-label="Cost chart type">
    <button type="button" aria-pressed={!bars} title="Score vs cost" onClick={() => changeKind("scatter")}><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="4" cy="11" r="1.6" /><circle cx="8" cy="6" r="1.6" /><circle cx="12.5" cy="4" r="1.6" /><circle cx="10" cy="10" r="1.6" /></svg></button>
    <button type="button" aria-pressed={bars} title="Bar chart" onClick={() => changeKind("bars")}><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="2" y="3" width="3" height="11" /><rect x="6.5" y="6" width="3" height="8" /><rect x="11" y="9" width="3" height="5" /></svg></button>
  </div>{bars ? barActions : scatterActions}</>;
  const linkParams = { cv: bars ? "bars" as const : undefined, cs: !bars ? view.scale : undefined, extra: formula.link };
  useEffect(() => {
    if (!anchor) return;
    const url = new URL(window.location.href);
    if (decodeURIComponent(url.hash.slice(1)) !== anchor && url.searchParams.get("c") !== anchor) return;
    if (!bars && view.scale) url.searchParams.set("cs", view.scale);
    else if (bars) url.searchParams.delete("cs");
    for (const [key, value] of Object.entries(formula.link)) { if (value) url.searchParams.set(key, value); else url.searchParams.delete(key); }
    window.history.replaceState(null, "", url.toString());
  }, [anchor, bars, view.scale, formula.link.cf, formula.link.cb]); // eslint-disable-line react-hooks/exhaustive-deps
  const heading = <div>{bars ? <h2 className="text-[22px]">{subscription ? "Subscription cost per task" : "Cost per task"}</h2> : title}{description && <p className="cap mt-1">{description}</p>}</div>;
  if (formula.custom) {
    const source = formula.custom.source, customHeading = <div><h2 className="text-[22px] break-words">{bars ? source : `Score vs ${source}`}</h2><p className="cap mt-1">{formula.caption}</p></div>;
    if (bars) return <MetricBars bestFirst labelScale={view.labelScale} pts={barVisibility.points} labs={labs} better={costChart.better} xName={costChart.xName} formatValue={costChart.formatX} height={height} aria={`By model: ${source}`} title={customHeading} actions={controls} anchor={anchor} linkParams={linkParams} exportName="Custom formula" />;
    return <ScoreScatter pts={pts} labs={labs} better={costChart.better} xName={costChart.xName} scale={costChart.scale} formatX={costChart.formatX} height={height} aria={costChart.aria} title={customHeading} actions={controls} linkParams={linkParams} view={view} anchor={anchor} exportName="Score vs custom formula"
      extraRows={(p) => ({ cost_per_task_usd: p.r.costUsd ?? null, speed_toks: p.r.speed ?? null, coverage: p.r.coverage })} />;
  }
  if (bars) return <MetricBars labelScale={view.labelScale} pts={barVisibility.points} labs={labs} better={costChart.better} xName={subscription ? "Subscription cost per task ($)" : "Cost per task ($)"} formatValue={costChart.formatX} height={height} aria={subscription ? "Subscription cost per task by model" : "Cost per task by model"} title={heading} actions={controls} anchor={anchor} linkParams={linkParams} exportName={subscription ? "Subscription cost per task" : "Cost per task"} />;
  return <ScoreScatter pts={pts} labs={labs} better={costChart.better} xName={costChart.xName} xShort={costChart.xShort} scale={costChart.scale} formatX={costChart.formatX} formatValue={costChart.formatValue} height={height} aria={costChart.aria} title={heading} actions={controls} linkParams={linkParams} view={view} anchor={anchor} exportName={subscription ? "Score vs subscription cost per task" : "Score vs cost per task"}
    tooltipExtra={(p) => `${p.r.speed ? ` · ${Math.round(p.r.speed)} tok/s` : ""}${subscription ? ` · ${p.r.costPlan ? p.r.costPlan.ratio === 0 ? p.r.costPlan.plan : `${p.r.costPlan.plan}, ${subscriptionShare(p.r.costPlan.ratio)} of API price` : "API price, no plan data"}` : ""}`}
    extraRows={(p) => ({ speed_toks: p.r.speed ?? null, coverage: p.r.coverage, ...(subscription ? { subscription_plan: p.r.costPlan?.plan ?? null, share_of_api_price: p.r.costPlan?.ratio ?? null } : {}) })} />;
}
