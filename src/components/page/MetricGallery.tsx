"use client";
import { useMemo, useState } from "react";
import type { Snapshot, Lab } from "@/data/types";
import { selectVariants, type RankedVariant } from "@/engine";
import { metricPanels, type MetricChart } from "@/lib/metrics";
import { MetricScatter } from "../chart/MetricScatter";
import { SpeedChart } from "../chart/SpeedChart";
import { ChartSettings } from "../chart/ChartSettings";
import { useScatterView } from "../chart/ScoreScatter";
import { MetricBars } from "../chart/MetricBars";
import { anchorOf, useHashTarget } from "../chart/ChartLink";

type SharedSettings = Omit<React.ComponentProps<typeof ChartSettings>, "label" | "mode" | "onChange" | "view" | "onView">;

/** Collapsed-by-default metric charts for a profile page (AA-style gallery).
 *  Panels mount their chart only when first expanded. */
/** `ranked` is the full variant set; each panel picks best-effort or all efforts on its own. */

export function MetricGallery({ ranked, mode = "all", snapshot, labs, settings, anchorPrefix = "" }: { ranked: RankedVariant[]; mode?: "all" | "best"; snapshot: Snapshot; labs: Lab[]; settings?: SharedSettings; anchorPrefix?: string }) {
  const panels = useMemo(() => metricPanels(snapshot, ranked), [snapshot, ranked]);
  if (!panels.length) return null;
  return (
    <div className="border-t hairline">
      {panels.map((p) => { const anchor = `${anchorPrefix}${anchorOf(p.title)}`; return <Panel key={p.id} anchor={anchor} title={p.title} desc={p.desc} defaultOpen={p.open}><GalleryChart id={p.id} anchor={anchor} title={p.title} chart={p.chart} speed={p.speed} ranked={ranked} defaultMode={mode} labs={labs} settings={settings} /></Panel>; })}
    </div>
  );
}

/** One gallery chart with its own effort mode and display settings; shared index filters pass through. */
function GalleryChart({ id, anchor, title, chart, speed, ranked, defaultMode, labs, settings }: { id: string; anchor: string; title: string; chart?: MetricChart; speed?: boolean; ranked: RankedVariant[]; defaultMode: "all" | "best"; labs: Lab[]; settings?: SharedSettings }) {
  const [mode, setMode] = useState<"all" | "best">(defaultMode);
  const [view, setView] = useScatterView(`gallery-${id}`);
  const rows = useMemo(() => selectVariants(ranked, mode), [ranked, mode]);
  const bars = view.kind === "bars";
  const toggle = <div className="seg" role="group" aria-label={`${title} chart type`}>
    <button type="button" aria-pressed={!bars} title="Score vs metric" onClick={() => setView({ ...view, kind: "scatter" })}><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="4" cy="11" r="1.6" /><circle cx="8" cy="6" r="1.6" /><circle cx="12.5" cy="4" r="1.6" /><circle cx="10" cy="10" r="1.6" /></svg></button>
    <button type="button" aria-pressed={bars} title="Bar chart" onClick={() => setView({ ...view, kind: "bars" })}><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="2" y="3" width="3" height="11" /><rect x="6.5" y="6" width="3" height="8" /><rect x="11" y="9" width="3" height="5" /></svg></button>
  </div>;
  const actions = <>{chart?.scale !== "time" && toggle}<ChartSettings label={title} mode={mode} onChange={setMode} view={bars ? undefined : view} onView={setView} {...settings} /></>;
  if (bars && speed) return <MetricBars pts={rows.filter((r) => r.speed && r.speed > 0).map((r) => ({ x: r.speed!, r }))} labs={labs} better="higher" xName="Output speed (tok/s)" formatValue={(v) => `${Math.round(v)}`} aria="Output speed by model" actions={actions} exportName="Output speed" anchor={anchor} />;
  if (speed) return <SpeedChart ranked={rows} labs={labs} view={view} actions={actions} anchor={anchor} />;
  if (!chart) return null;
  if (bars && chart.scale !== "time") return <MetricBars pts={chart.points(rows)} labs={labs} better={chart.better} xName={chart.xName} formatValue={chart.formatValue ?? chart.formatX} aria={chart.aria.replace("Index score versus", "By model:")} actions={actions} exportName={title} anchor={anchor} />;
  return <MetricScatter pts={chart.points(rows)} labs={labs} better={chart.better} xLabel={chart.xLabel} xName={chart.xName} scale={chart.scale} formatX={chart.formatX} formatValue={chart.formatValue} aria={chart.aria} view={view} actions={actions} exportName={title} anchor={anchor} />;
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
