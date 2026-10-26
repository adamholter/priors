"use client";
import { useEffect, useMemo, useState } from "react";
import { IconArrowDown, IconArrowUp, IconEye, IconEyeOff, IconSquare, IconSquareCheck } from "@tabler/icons-react";
import { taskMetricOptions, type TaskMetricSource } from "@/data/task-metrics";
import type { Snapshot, Lab } from "@/data/types";
import type { IndexConfig, IndexResult, RankedVariant } from "@/engine";
import { formulaInputs, metricPanels, pickPoints, speedChart, type FormulaInputs, type MetricChart } from "@/lib/metrics";
import { linkedFormula, useFormulaChart } from "../chart/formula-chart";
import { useBarModelVisibility } from "../chart/bar-model-visibility";
import { MetricScatter } from "../chart/MetricScatter";
import { SpeedChart } from "../chart/SpeedChart";
import { ChartSettings } from "../chart/ChartSettings";
import { toOwnerView, useScatterView, type OwnerView } from "../chart/ScoreScatter";
import type { GalleryMetric } from "../../../convex/validators";
import { arrangeMetrics } from "@/lib/gallery-layout";
import { MetricBars } from "../chart/MetricBars";
import { radarReady, StrengthsRadar } from "../chart/StrengthsRadar";
import { UsageStream } from "../chart/UsageStream";
import { usageData } from "@/lib/usage-stream";
import { anchorOf, useHashTarget } from "../chart/ChartLink";

import { linkedLabelScale } from "../chart/label-size";

type SharedSettings = Omit<React.ComponentProps<typeof ChartSettings>, "label" | "mode" | "onChange" | "view" | "onView" | "defaultScale" | "anchor">;

/** Collapsed-by-default metric charts for a profile page (AA-style gallery).
 *  Panels mount their chart only when first expanded. */
/** `ranked` is the full variant set; each panel picks best-effort or all efforts on its own. */

/** `benchmarks` + `config` (the index's weighted benchmarks and its config) enable the Strengths radar, placed after Time per task by default. */
export function MetricGallery({ ranked, mode = "all", snapshot, labs, settings, anchorPrefix = "", timeSource = "aa", onTimeSourceChange, benchmarks, config, layout, editing, onLayout }: { ranked: RankedVariant[]; mode?: "all" | "best"; snapshot: Snapshot; labs: Lab[]; settings?: SharedSettings; anchorPrefix?: string; timeSource?: TaskMetricSource; onTimeSourceChange?: (source: TaskMetricSource) => void; benchmarks?: IndexResult["benchmarks"]; config?: IndexConfig; /** Owner's saved order/visibility/defaults. */ layout?: GalleryMetric[]; /** Owner edit mode: every metric listed with controls; changes go to `onLayout`. */ editing?: boolean; onLayout?: (layout: GalleryMetric[]) => void }) {
  const metricList = useMemo(() => metricPanels(snapshot, ranked, timeSource), [snapshot, ranked, timeSource]);
  const inputs = formulaInputs(snapshot, ranked, timeSource, metricList);
  const hasStrengths = !!(benchmarks && config && radarReady(benchmarks));
  const all = useMemo(() => {
    const list: { id: string; title: string; desc: string; open?: boolean }[] = metricList.map((p) => ({ id: p.id, title: p.title, desc: p.desc, open: p.open }));
    if (hasStrengths) { const at = list.findIndex((p) => p.id === "tpt") + 1; list.splice(at, 0, { id: "strengths", title: "Strengths", desc: `each model's shape across the ${benchmarks!.length} benchmarks in this index` }); }
    return list;
  }, [metricList, hasStrengths, benchmarks]);
  const arranged = arrangeMetrics(all, layout);
  if (!arranged.length) return null;
  const current = (): GalleryMetric[] => arranged.map((p) => ({ id: p.id, ...(p.hidden ? { hidden: true } : {}), ...(p.entry?.open !== undefined || p.open !== !!all.find((x) => x.id === p.id)?.open ? { open: p.open } : {}), ...(p.entry?.view ? { view: p.entry.view } : {}) }));
  const patch = (id: string, change: Partial<GalleryMetric>) => onLayout?.(current().map((e) => e.id === id ? { ...e, ...change } : e));
  const move = (id: string, d: number) => { const l = current(), i = l.findIndex((e) => e.id === id), j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; onLayout?.(l); };
  const shown = editing ? arranged : arranged.filter((p) => !p.hidden);
  return (
    <div className="border-t hairline">
      {editing && <p className="cap py-2.5">Choose which metrics show, their order, and which start open. Chart settings you change here become the page default.</p>}
      {shown.map((p, i) => {
        const anchor = `${anchorPrefix}${anchorOf(p.title)}`;
        const chart = metricList.find((m) => m.id === p.id);
        const tools = editing && <span className="metric-tools" onClick={(e) => e.preventDefault()}>
          <button type="button" className="edit-btn" aria-pressed={p.open} disabled={p.hidden} title="Whether visitors see this chart expanded" onClick={() => patch(p.id, { open: !p.open })}>{p.open ? <IconSquareCheck size={15} /> : <IconSquare size={15} />}Starts open</button>
          <button type="button" className="edit-btn" onClick={() => patch(p.id, { hidden: !p.hidden })}>{p.hidden ? <IconEye size={15} /> : <IconEyeOff size={15} />}{p.hidden ? "Show" : "Hide"}</button>
          <button type="button" className="edit-icon" aria-label={`Move ${p.title} up`} title="Move up" disabled={i === 0} onClick={() => move(p.id, -1)}><IconArrowUp size={16} /></button>
          <button type="button" className="edit-icon" aria-label={`Move ${p.title} down`} title="Move down" disabled={i === shown.length - 1} onClick={() => move(p.id, 1)}><IconArrowDown size={16} /></button>
        </span>;
        const scatterBody = p.id === "strengths"
          ? <div id={anchor} className="scroll-mt-20"><StrengthsRadar ranked={ranked} benchmarks={benchmarks!} labs={labs} snapshot={snapshot} config={config!} /></div>
          : chart && <GalleryChart inputs={inputs} id={p.id} anchor={anchor} title={p.title} chart={chart.chart} speed={chart.speed} ranked={ranked} defaultMode={mode} labs={labs} settings={settings} owner={p.entry?.view} onOwner={editing ? (view) => patch(p.id, { view }) : undefined} dataSource={p.id === "tpt" && onTimeSourceChange ? { value: timeSource, options: taskMetricOptions(snapshot, "time"), onChange: onTimeSourceChange } : undefined} />;
        // Usage opens as daily share over time (the Slopalytics view); the score-against-usage chart stays one click away.
        const body = p.id === "usage" && usageData(snapshot) ? <UsageGallery snapshot={snapshot} labs={labs} scatter={scatterBody} /> : scatterBody;
        return <Panel key={`${p.id}-${editing ? "edit" : p.open}`} anchor={anchor} title={p.title} desc={p.desc} defaultOpen={p.open && !p.hidden} dim={editing && p.hidden} tools={tools}>{body}</Panel>;
      })}
    </div>
  );
}

/** Usage: daily share over time by default, with the score-against-usage chart behind a toggle. */
function UsageGallery({ snapshot, labs, scatter }: { snapshot: Snapshot; labs: Lab[]; scatter: React.ReactNode }) {
  const [view, setView] = useState<"time" | "score">("time");
  const toggle = <div className="seg whitespace-nowrap" role="group" aria-label="Usage chart">
    <button type="button" aria-pressed={view === "time"} onClick={() => setView("time")}>Over time</button>
    <button type="button" aria-pressed={view === "score"} onClick={() => setView("score")}>Score vs usage</button>
  </div>;
  return view === "time" ? <UsageStream snapshot={snapshot} labs={labs} extra={toggle} /> : <div><div className="flex justify-end mb-2 max-sm:px-4">{toggle}</div>{scatter}</div>;
}

/** One gallery chart with its own effort mode and display settings; shared index filters pass through. */
function GalleryChart({ id, anchor, title, chart, speed, ranked, defaultMode, labs, settings, dataSource, owner, onOwner, inputs }: { inputs: FormulaInputs; id: string; anchor: string; title: string; chart?: MetricChart; speed?: boolean; ranked: RankedVariant[]; defaultMode: "all" | "best"; labs: Lab[]; settings?: SharedSettings; dataSource?: React.ComponentProps<typeof ChartSettings>["dataSource"]; owner?: OwnerView; onOwner?: (view: OwnerView) => void }) {
  const [modeState, setModeState] = useState<"all" | "best">(owner?.mode ?? defaultMode);
  const mode = onOwner ? owner?.mode ?? defaultMode : modeState;
  const base = speed ? speedChart : chart;
  const defaultKind = base?.scale === "time" ? "scatter" : base?.defaultKind ?? "scatter";
  const [savedView, setView] = useScatterView(`gallery-${id}`, defaultKind, base?.defaultFrontier ?? true, owner, onOwner ? (v) => onOwner(toOwnerView(v, owner?.mode)) : undefined);
  // Advanced settings can swap the panel's metric for a custom formula.
  const formula = useFormulaChart(base, savedView, inputs, ranked), metric = formula.metric, view = formula.view;
  const setMode = (m: "all" | "best") => { if (onOwner) onOwner({ ...owner, mode: m }); else setModeState(m); };
  const bars = view.kind === "bars" && metric?.scale !== "time";
  const allMetricPoints = useMemo(() => metric?.points(ranked) ?? [], [metric, ranked]);
  // Deep links carry the chart view (`cv=bars`, `cm=best|all`). Captured once per mount —
  // mirror effects may rewrite the URL before init effects run (and StrictMode mounts twice).
  const linked = useMemo(() => {
    if (typeof window === "undefined") return { linked: false } as { linked: boolean; cv?: string | null; cm?: string | null; cs?: string | null; labelScale?: number; formula?: ReturnType<typeof linkedFormula> };
    const url = new URL(window.location.href);
    return decodeURIComponent(url.hash.slice(1)) === anchor || url.searchParams.get("c") === anchor
      ? { linked: true, cv: url.searchParams.get("cv"), cm: url.searchParams.get("cm"), cs: url.searchParams.get("cs"), labelScale: linkedLabelScale(url.searchParams), formula: linkedFormula(url.searchParams) }
      : { linked: false };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Apply the linked view for this session only (localStorage defaults untouched).
  useEffect(() => {
    if (!linked.linked) return;
    const kind = linked.cv === "bars" || linked.cv === "scatter" ? linked.cv : defaultKind;
    setView({ ...savedView, ...linked.formula, ...(linked.labelScale != null ? { labelScale: linked.labelScale } : {}), kind: kind === "bars" && (linked.formula || base?.scale !== "time") ? "bars" : "scatter", kindChosen: true, ...((linked.formula || base?.scale === "log") && (linked.cs === "log" || linked.cs === "linear") ? { scale: linked.cs } : {}) }, false);
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
    if (!bars && formula.defaultScale && view.scale) url.searchParams.set("cs", view.scale);
    else if (bars || !formula.defaultScale) url.searchParams.delete("cs");
    for (const [key, value] of Object.entries(formula.link)) { if (value) url.searchParams.set(key, value); else url.searchParams.delete(key); }
    window.history.replaceState(null, "", url.toString());
  }, [bars, mode, anchor, defaultMode, defaultKind, formula.defaultScale, view.scale, formula.link.cf, formula.link.cb]); // eslint-disable-line react-hooks/exhaustive-deps
  const kind = bars ? ("bars" as const) : ("scatter" as const);
  const linkParams = { cv: kind !== defaultKind ? kind : undefined, cm: mode !== defaultMode ? mode : undefined, cs: !bars && formula.defaultScale ? view.scale : undefined, extra: formula.link };
  const pts = useMemo(() => (metric ? pickPoints(metric, ranked, mode) : []), [metric, ranked, mode]);
  const barVisibility = useBarModelVisibility({ metricPoints: allMetricPoints, points: pts, better: metric?.better ?? "higher", ranked, modelOptions: settings?.models });
  const chartModelSettings = bars ? barVisibility.picker : {};
  const toggle = <div className="seg" role="group" aria-label={`${title} chart type`}>
    <button type="button" aria-pressed={!bars} title="Score vs metric" onClick={() => setView({ ...savedView, kind: "scatter" })}><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="4" cy="11" r="1.6" /><circle cx="8" cy="6" r="1.6" /><circle cx="12.5" cy="4" r="1.6" /><circle cx="10" cy="10" r="1.6" /></svg></button>
    <button type="button" aria-pressed={bars} title="Bar chart" onClick={() => setView({ ...savedView, kind: "bars" })}><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="2" y="3" width="3" height="11" /><rect x="6.5" y="6" width="3" height="8" /><rect x="11" y="9" width="3" height="5" /></svg></button>
  </div>;
  const actions = <>{metric?.scale !== "time" && toggle}<ChartSettings anchor={anchor} defaultScale={formula.defaultScale} formula={formula.settings} dataSource={dataSource} label={title} mode={mode} onChange={setMode} view={savedView} onView={setView} {...settings} {...chartModelSettings} /></>;
  if (!metric) return null;
  const caption = formula.custom && <p className="cap max-sm:px-4">{formula.caption}: <span className="mono text-ink-2">{formula.custom.source}</span></p>;
  if (formula.custom) {
    const name = `${title} (custom formula)`;
    if (bars) return <MetricBars bestFirst labelScale={view.labelScale} pts={barVisibility.points} labs={labs} better={metric.better} xName={metric.xName} formatValue={metric.formatX} aria={`By model: ${formula.custom.source}`} title={caption} actions={actions} exportName={name} anchor={anchor} linkParams={linkParams} />;
    return <MetricScatter pts={pts} labs={labs} better={metric.better} xLabel="" xName={metric.xName} scale={metric.scale} formatX={metric.formatX} aria={metric.aria} view={view} title={caption} actions={actions} exportName={name} anchor={anchor} linkParams={linkParams} />;
  }
  if (bars) return <MetricBars labelScale={view.labelScale} pts={barVisibility.points} labs={labs} better={metric.better} xName={metric.xName} formatValue={metric.formatValue ?? metric.formatX} zoomAxis={metric.zoomAxis} aria={metric.aria.replace("Index score versus", "By model:")} actions={actions} exportName={title} anchor={anchor} linkParams={linkParams} />;
  if (speed) return <SpeedChart pts={pts} labs={labs} view={view} actions={actions} anchor={anchor} linkParams={linkParams} />;
  return <MetricScatter pts={pts} labs={labs} better={metric.better} xLabel={metric.xLabel} xName={metric.xName} scale={metric.scale} formatX={metric.formatX} formatValue={metric.formatValue} aria={metric.aria} view={view} actions={actions} exportName={title} anchor={anchor} linkParams={linkParams} />;
}

function Panel({ anchor, title, desc, defaultOpen, dim, tools, children }: { anchor: string; title: string; desc: string; defaultOpen?: boolean; dim?: boolean; tools?: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [mounted, setMounted] = useState(!!defaultOpen);
  // A deep link to a collapsed panel opens it.
  useHashTarget(anchor, () => { setOpen(true); setMounted(true); });
  return (
    <details className={`gallery-panel border-b hairline ${dim ? "is-dim" : ""}`} open={open} onToggle={(e) => { const o = e.currentTarget.open; setOpen(o); if (o) setMounted(true); }}>
      <summary className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 py-3.5 pr-6 relative cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
        <span className="gallery-title text-[15px] font-medium whitespace-nowrap">{title}</span>
        <span className="cap text-grey">{desc}</span>
        {tools}
        <span className="absolute right-0 top-3.5 text-grey transition-transform duration-200" style={{ transform: open ? "rotate(180deg)" : undefined }} aria-hidden="true">⌄</span>
      </summary>
      {mounted && <div className="pb-6">{children}</div>}
    </details>
  );
}
