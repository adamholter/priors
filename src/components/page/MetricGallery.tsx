"use client";
import { useMemo, useState } from "react";
import type { Observation, Snapshot, Lab } from "@/data/types";
import { selectVariants, type RankedVariant } from "@/engine";
import { MetricScatter, type MetricPoint } from "../chart/MetricScatter";
import { SpeedChart } from "../chart/SpeedChart";
import { ChartSettings } from "../chart/ChartSettings";
import { useScatterView } from "../chart/ScoreScatter";
import { MetricBars } from "../chart/MetricBars";

type SharedSettings = Omit<React.ComponentProps<typeof ChartSettings>, "label" | "mode" | "onChange" | "view" | "onView">;

/** Collapsed-by-default metric charts for a profile page (AA-style gallery).
 *  Panels mount their chart only when first expanded. */
/** `ranked` is the full variant set; each panel picks best-effort or all efforts on its own. */
const MIN_PTS = 3;

export function MetricGallery({ ranked, mode = "all", snapshot, labs, settings }: { ranked: RankedVariant[]; mode?: "all" | "best"; snapshot: Snapshot; labs: Lab[]; settings?: SharedSettings }) {
  const obs = useMemo(() => {
    const m = new Map<string, Map<string, Observation>>();
    for (const o of snapshot.observations) {
      const b = m.get(o.benchmarkId) ?? m.set(o.benchmarkId, new Map()).get(o.benchmarkId)!;
      b.set(o.variantId, o);
      // Source-qualified variants (`id@effort~source-conf`) back their base
      // effort variant's metrics, the same way the engine substitutes them.
      const base = o.variantId.split("~")[0];
      if (!b.has(base)) b.set(base, o);
    }
    return m;
  }, [snapshot]);

  const at = (benchId: string, pick: (o: Observation) => number | undefined = (o) => o.value) => (rows: RankedVariant[]): MetricPoint[] =>
    rows.flatMap((r) => { const o = obs.get(benchId)?.get(r.variant.id); const x = o && pick(o); return x != null && Number.isFinite(x) && x > 0 ? [{ x, r }] : []; });

  type Chart = { better: "lower" | "higher"; points: (rows: RankedVariant[]) => MetricPoint[]; xLabel: string; xName: string; scale?: "linear" | "log" | "time"; formatX: (x: number) => string; formatValue?: (x: number) => string; aria: string };
  const panels: { id: string; title: string; desc: string; open?: boolean; chart?: Chart; speed?: boolean }[] = [];
  const iiId = snapshot.benchmarks.filter((b) => b.id.startsWith("aa-intelligence-index")).sort((a, b) => b.id.localeCompare(a.id))[0]?.id;
  const ttft = at("aa-ttft");
  const decode = iiId ? at(iiId, (o) => (o.details?.estimatedDecodeSecondsPerTask as number | undefined) ?? undefined) : () => [];
  const tokens = iiId ? at(iiId, (o) => (o.details?.outputTokensPerTask as number | undefined) ?? o.outputTokens ?? undefined) : () => [];
  const uptime = at("openrouter-uptime");
  const dates = (rows: RankedVariant[]) => rows.flatMap((r) => r.model.releaseDate ? [{ x: Date.parse(r.model.releaseDate), r }] : []);
  const has = (f: (rows: RankedVariant[]) => MetricPoint[]) => f(ranked).length >= MIN_PTS;

  const fmt = (u: string) => (x: number) => `${x.toLocaleString(undefined, { maximumFractionDigits: 2 })}${u}`;
  const fmtDate = (x: number) => new Date(x).toISOString().slice(0, 10);
  const secs = (x: number) => x >= 1000 ? `${Math.round(x / 100) / 10}k s` : fmt("s")(x);

  if (has(decode)) panels.push({ id: "tpt", title: "Time per task", desc: "estimated decode time on the index suite", open: true, chart: { better: "lower", points: decode, xLabel: "s/task", xName: "Time per task (s)", scale: "log", formatX: secs, aria: "Index score versus estimated time per task" } });
  if (ranked.some((r) => r.speed)) panels.push({ id: "speed", title: "Output speed", desc: "tokens per second", open: !has(decode), speed: true });
  if (has(ttft)) panels.push({ id: "latency", title: "Latency", desc: "seconds to first token", chart: { better: "lower", points: ttft, xLabel: "s", xName: "Time to first token (s)", scale: "log", formatX: fmt("s"), aria: "Index score versus time to first token" } });
  if (has(tokens)) panels.push({ id: "tokens", title: "Output tokens", desc: "tokens generated per task", chart: { better: "lower", points: tokens, xLabel: "tok", xName: "Output tokens per task", scale: "log", formatX: (x) => x >= 1000 ? `${(x / 1000).toFixed(0)}k` : `${x.toFixed(0)}`, aria: "Index score versus output tokens per task" } });
  if (has(dates)) panels.push({ id: "date", title: "Release date", desc: "when each model shipped", chart: { better: "higher", points: dates, xLabel: "", xName: "Release date", scale: "time", formatX: fmtDate, aria: "Index score versus model release date" } });
  if (has(uptime)) {
    // "Nines" axis: plot -log10(downtime) so 90%, 99%, 99.9% get equal spacing.
    const nines = (rows: RankedVariant[]) => uptime(rows).map((p) => ({ r: p.r, raw: p.x, x: -Math.log10(Math.max(0.01, 100 - p.x)) }));
    panels.push({ id: "uptime", title: "Uptime", desc: "OpenRouter provider uptime, trailing 7 days", chart: { better: "higher", points: nines, xLabel: "", xName: "Uptime (%)", formatX: (t) => `${parseFloat((100 - 10 ** -t).toFixed(3))}%`, formatValue: fmt("%"), aria: "Index score versus OpenRouter uptime" } });
  }

  if (!panels.length) return null;
  return (
    <div className="border-t hairline">
      {panels.map((p) => <Panel key={p.id} title={p.title} desc={p.desc} defaultOpen={p.open}><GalleryChart id={p.id} title={p.title} chart={p.chart} speed={p.speed} ranked={ranked} defaultMode={mode} labs={labs} settings={settings} /></Panel>)}
    </div>
  );
}

/** One gallery chart with its own effort mode and display settings; shared index filters pass through. */
function GalleryChart({ id, title, chart, speed, ranked, defaultMode, labs, settings }: { id: string; title: string; chart?: { better: "lower" | "higher"; points: (rows: RankedVariant[]) => MetricPoint[]; xLabel: string; xName: string; scale?: "linear" | "log" | "time"; formatX: (x: number) => string; formatValue?: (x: number) => string; aria: string }; speed?: boolean; ranked: RankedVariant[]; defaultMode: "all" | "best"; labs: Lab[]; settings?: SharedSettings }) {
  const [mode, setMode] = useState<"all" | "best">(defaultMode);
  const [view, setView] = useScatterView(`gallery-${id}`);
  const rows = useMemo(() => selectVariants(ranked, mode), [ranked, mode]);
  const bars = view.kind === "bars";
  const toggle = <div className="seg" role="group" aria-label={`${title} chart type`}>
    <button type="button" aria-pressed={!bars} title="Score vs metric" onClick={() => setView({ ...view, kind: "scatter" })}><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="4" cy="11" r="1.6" /><circle cx="8" cy="6" r="1.6" /><circle cx="12.5" cy="4" r="1.6" /><circle cx="10" cy="10" r="1.6" /></svg></button>
    <button type="button" aria-pressed={bars} title="Bar chart" onClick={() => setView({ ...view, kind: "bars" })}><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="2" y="3" width="3" height="11" /><rect x="6.5" y="6" width="3" height="8" /><rect x="11" y="9" width="3" height="5" /></svg></button>
  </div>;
  const actions = <>{chart?.scale !== "time" && toggle}<ChartSettings label={title} mode={mode} onChange={setMode} view={bars ? undefined : view} onView={setView} {...settings} /></>;
  if (bars && speed) return <MetricBars pts={rows.filter((r) => r.speed && r.speed > 0).map((r) => ({ x: r.speed!, r }))} labs={labs} better="higher" xName="Output speed (tok/s)" formatValue={(v) => `${Math.round(v)}`} aria="Output speed by model" actions={actions} exportName="Output speed" />;
  if (speed) return <SpeedChart ranked={rows} labs={labs} view={view} actions={actions} />;
  if (!chart) return null;
  if (bars && chart.scale !== "time") return <MetricBars pts={chart.points(rows)} labs={labs} better={chart.better} xName={chart.xName} formatValue={chart.formatValue ?? chart.formatX} aria={chart.aria.replace("Index score versus", "By model:")} actions={actions} exportName={chart.xName} />;
  return <MetricScatter pts={chart.points(rows)} labs={labs} better={chart.better} xLabel={chart.xLabel} xName={chart.xName} scale={chart.scale} formatX={chart.formatX} formatValue={chart.formatValue} aria={chart.aria} view={view} actions={actions} />;
}

function Panel({ title, desc, defaultOpen, children }: { title: string; desc: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [mounted, setMounted] = useState(!!defaultOpen);
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
