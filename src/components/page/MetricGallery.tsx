"use client";
import { useEffect, useMemo, useState } from "react";
import { taskMetricOptions, type TaskMetricSource } from "@/data/task-metrics";
import type { Snapshot, Lab } from "@/data/types";
import type { RankedVariant } from "@/engine";
import { metricPanels, pickPoints, speedChart, type MetricChart } from "@/lib/metrics";
import { MetricScatter } from "../chart/MetricScatter";
import { SpeedChart } from "../chart/SpeedChart";
import { ChartSettings } from "../chart/ChartSettings";
import { useScatterView } from "../chart/ScoreScatter";
import { MetricBars } from "../chart/MetricBars";
import { anchorOf, useHashTarget } from "../chart/ChartLink";

import { linkedLabelScale } from "../chart/label-size";

type SharedSettings = Omit<React.ComponentProps<typeof ChartSettings>, "label" | "mode" | "onChange" | "view" | "onView" | "defaultScale" | "anchor">;

/** Collapsed-by-default metric charts for a profile page (AA-style gallery).
 *  Panels mount their chart only when first expanded. */
/** `ranked` is the full variant set; each panel picks best-effort or all efforts on its own. */

export function MetricGallery({ ranked, mode = "all", snapshot, labs, settings, anchorPrefix = "", timeSource = "aa", onTimeSourceChange }: { ranked: RankedVariant[]; mode?: "all" | "best"; snapshot: Snapshot; labs: Lab[]; settings?: SharedSettings; anchorPrefix?: string; timeSource?: TaskMetricSource; onTimeSourceChange?: (source: TaskMetricSource) => void }) {
  const panels = useMemo(() => metricPanels(snapshot, ranked, timeSource), [snapshot, ranked, timeSource]);
  if (!panels.length) return null;
  return (
    <div className="border-t hairline">
      {panels.map((p) => { const anchor = `${anchorPrefix}${anchorOf(p.title)}`; return <Panel key={p.id} anchor={anchor} title={p.title} desc={p.desc} defaultOpen={p.open}><GalleryChart id={p.id} anchor={anchor} title={p.title} chart={p.chart} speed={p.speed} ranked={ranked} defaultMode={mode} labs={labs} settings={settings} dataSource={p.id === "tpt" && onTimeSourceChange ? { value: timeSource, options: taskMetricOptions(snapshot, "time"), onChange: onTimeSourceChange } : undefined} /></Panel>; })}
    </div>
  );
}

/** One gallery chart with its own effort mode and display settings; shared index filters pass through. */
function GalleryChart({ id, anchor, title, chart, speed, ranked, defaultMode, labs, settings, dataSource }: { id: string; anchor: string; title: string; chart?: MetricChart; speed?: boolean; ranked: RankedVariant[]; defaultMode: "all" | "best"; labs: Lab[]; settings?: SharedSettings; dataSource?: React.ComponentProps<typeof ChartSettings>["dataSource"] }) {
  const [mode, setMode] = useState<"all" | "best">(defaultMode);
  const metric = speed ? speedChart : chart;
  const defaultKind = metric?.scale === "time" ? "scatter" : metric?.defaultKind ?? "scatter";
  const [view, setView] = useScatterView(`gallery-${id}`, defaultKind, metric?.defaultFrontier ?? true);
  const bars = view.kind === "bars" && chart?.scale !== "time";
  // Deep links carry the chart view (`cv=bars`, `cm=best|all`). Captured once per mount —
  // mirror effects may rewrite the URL before init effects run (and StrictMode mounts twice).
  const linked = useMemo(() => {
    if (typeof window === "undefined") return { linked: false } as { linked: boolean; cv?: string | null; cm?: string | null; cs?: string | null; labelScale?: number };
    const url = new URL(window.location.href);
    return decodeURIComponent(url.hash.slice(1)) === anchor || url.searchParams.get("c") === anchor
      ? { linked: true, cv: url.searchParams.get("cv"), cm: url.searchParams.get("cm"), cs: url.searchParams.get("cs"), labelScale: linkedLabelScale(url.searchParams) }
      : { linked: false };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Apply the linked view for this session only (localStorage defaults untouched).
  useEffect(() => {
    if (!linked.linked) return;
    const kind = linked.cv === "bars" || linked.cv === "scatter" ? linked.cv : defaultKind;
    setView({ ...view, ...(linked.labelScale != null ? { labelScale: linked.labelScale } : {}), kind: kind === "bars" && chart?.scale !== "time" ? "bars" : "scatter", kindChosen: true, ...(metric?.scale === "log" && (linked.cs === "log" || linked.cs === "linear") ? { scale: linked.cs } : {}) }, false);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL deep-link init
    if (linked.cm === "best" || linked.cm === "all") setMode(linked.cm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // While this panel is the linked chart, keep cv/cm in the URL in sync with the toggles.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (decodeURIComponent(url.hash.slice(1)) !== anchor && url.searchParams.get("c") !== anchor) return;
    const kind = bars ? "bars" : "scatter";
    if (kind !== defaultKind) url.searchParams.set("cv", kind); else url.searchParams.delete("cv");
    if (mode !== defaultMode) url.searchParams.set("cm", mode); else url.searchParams.delete("cm");
    if (!bars && metric?.scale === "log" && view.scale) url.searchParams.set("cs", view.scale);
    else if (bars || metric?.scale !== "log") url.searchParams.delete("cs");
    window.history.replaceState(null, "", url.toString());
  }, [bars, mode, anchor, defaultMode, defaultKind, metric?.scale, view.scale]);
  const kind = bars ? ("bars" as const) : ("scatter" as const);
  const linkParams = { cv: kind !== defaultKind ? kind : undefined, cm: mode !== defaultMode ? mode : undefined, cs: !bars && metric?.scale === "log" ? view.scale : undefined };
  const pts = useMemo(() => (metric ? pickPoints(metric, ranked, mode) : []), [metric, ranked, mode]);
  const toggle = <div className="seg" role="group" aria-label={`${title} chart type`}>
    <button type="button" aria-pressed={!bars} title="Score vs metric" onClick={() => setView({ ...view, kind: "scatter" })}><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="4" cy="11" r="1.6" /><circle cx="8" cy="6" r="1.6" /><circle cx="12.5" cy="4" r="1.6" /><circle cx="10" cy="10" r="1.6" /></svg></button>
    <button type="button" aria-pressed={bars} title="Bar chart" onClick={() => setView({ ...view, kind: "bars" })}><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="2" y="3" width="3" height="11" /><rect x="6.5" y="6" width="3" height="8" /><rect x="11" y="9" width="3" height="5" /></svg></button>
  </div>;
  const actions = <>{chart?.scale !== "time" && toggle}<ChartSettings anchor={anchor} defaultScale={metric?.scale === "log" ? "log" : undefined} dataSource={dataSource} label={title} mode={mode} onChange={setMode} view={view} onView={setView} {...settings} /></>;
  if (!metric) return null;
  if (bars) return <MetricBars labelScale={view.labelScale} pts={pts} labs={labs} better={metric.better} xName={metric.xName} formatValue={metric.formatValue ?? metric.formatX} aria={metric.aria.replace("Index score versus", "By model:")} actions={actions} exportName={title} anchor={anchor} linkParams={linkParams} />;
  if (speed) return <SpeedChart pts={pts} labs={labs} view={view} actions={actions} anchor={anchor} linkParams={linkParams} />;
  return <MetricScatter pts={pts} labs={labs} better={metric.better} xLabel={metric.xLabel} xName={metric.xName} scale={metric.scale} formatX={metric.formatX} formatValue={metric.formatValue} aria={metric.aria} view={view} actions={actions} exportName={title} anchor={anchor} linkParams={linkParams} />;
}

function Panel({ anchor, title, desc, defaultOpen, children }: { anchor: string; title: string; desc: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [mounted, setMounted] = useState(!!defaultOpen);
  // A deep link to a collapsed panel opens it.
  useHashTarget(anchor, () => { setOpen(true); setMounted(true); });
  return (
    <details className="gallery-panel border-b hairline" open={open} onToggle={(e) => { const o = e.currentTarget.open; setOpen(o); if (o) setMounted(true); }}>
      <summary className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 py-3.5 pr-6 relative cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
        <span className="text-[15px] font-medium whitespace-nowrap">{title}</span>
        <span className="cap text-grey">{desc}</span>
        <span className="absolute right-0 top-3.5 text-grey transition-transform duration-200" style={{ transform: open ? "rotate(180deg)" : undefined }} aria-hidden="true">⌄</span>
      </summary>
      {mounted && <div className="pb-6">{children}</div>}
    </details>
  );
}
