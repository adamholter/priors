"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { BenchBars, benchSheetSvg } from "./BenchBars";
import { IconAdjustmentsHorizontal, IconX } from "@tabler/icons-react";
import type { Lab, Snapshot } from "@/data/types";
import type { IndexConfig, IndexResult, RankedVariant } from "@/engine";
import { useLightDismiss } from "@/lib/useLightDismiss";
import { BenchmarkInfo } from "../BenchmarkInfo";
import { DARK_PALETTE, LIGHT_PALETTE, markColor, useChartPalette, useLabColor } from "./echarts";
import { ChartExport } from "./ChartExport";
import { ChartLink } from "./ChartLink";
import { useChartExpand } from "./ChartExpand";
import { radarHtml } from "./embed";
import { Radar, RadarSwatch } from "./Radar";
import { RadarModal } from "./RadarModal";
import { formatValue, RADAR_MIN_AXES, type RadarModel, type RadarNorm } from "./radar-data";
import { BARS_TOP, DEFAULT_RADAR, RADAR_ANCHOR, RADAR_NORMS, RADAR_PALETTES, RADAR_TOP, radarModelsFor, radarParams, radarRows, radarSeries, radarSvg, readRadarParams, selectedModels, type RadarColors, type RadarCompare, type RadarSeries, type RadarSettings, type RadarView } from "./radar-view";
import styles from "./ChartSettings.module.css";
import "./radar.css";

/** A radar needs three spokes to enclose an area; with fewer the panel is not shown. */
export const radarReady = (benchmarks: IndexResult["benchmarks"]) => benchmarks.length >= RADAR_MIN_AXES;

/** True when the page URL points at this chart (`#strengths` or `?c=strengths`). */
function linkedHere(anchor: string) {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  return decodeURIComponent(url.hash.slice(1)) === anchor || url.searchParams.get("c") === anchor;
}

/**
 * Overlaid radar of the top models across the index's benchmarks, plus one small radar per model.
 * Selection follows the live top 4 until the user picks models; then their picks stick.
 * Settings travel in chart links (rm/rs/rc/rk/rmed) so a shared link reproduces the view and its card.
 */
export function StrengthsRadar({ ranked, benchmarks, labs, snapshot, config, anchor = RADAR_ANCHOR }: { ranked: RankedVariant[]; benchmarks: IndexResult["benchmarks"]; labs: Lab[]; snapshot: Snapshot; config: IndexConfig; anchor?: string }) {
  // Deep link: read once on mount, before any URL mirroring.
  const [settings, setSettings] = useState<RadarSettings>(() => linkedHere(anchor) ? readRadarParams(new URL(window.location.href).searchParams) : DEFAULT_RADAR);
  const [slots, setSlots] = useState<Record<string, number>>(() => Object.fromEntries((settings.models ?? []).map((id, i) => [id, i])));
  const [focus, setFocus] = useState<string | null>(null);
  const [axis, setAxis] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const pal = useChartPalette();
  const labColor = useLabColor();
  const expand = useChartExpand("Strengths");
  const { norm, compare, colors, median: showMedian, view } = settings;
  const sheets = useRef(new Map<string, () => string | undefined>());
  const register = useCallback((id: string, svg: (() => string | undefined) | null) => { if (svg) sheets.current.set(id, svg); else sheets.current.delete(id); }, []);
  const update = (patch: Partial<RadarSettings>) => setSettings((s) => ({ ...s, ...patch }));

  const rows = useMemo(() => radarRows(snapshot, config, ranked, benchmarks), [snapshot, config, ranked, benchmarks]);
  const { axes, models, median } = useMemo(() => radarModelsFor(rows, benchmarks, norm), [rows, benchmarks, norm]);
  const byId = useMemo(() => new Map(models.map((m) => [m.id, m])), [models]);
  // Until the user picks models, the radar follows the top 4 and the bar charts the top 8.
  const selected = useMemo(() => view === "bars" && !settings.models ? models.slice(0, BARS_TOP).map((m) => m.id) : selectedModels(models, settings.models), [models, settings.models, view]);
  const labOf = useMemo(() => new Map(labs.map((l) => [l.id, l])), [labs]);
  const colorOfLab = useCallback((m: RadarModel) => labColor(m.labId, labOf.get(m.labId)?.color), [labColor, labOf]);
  const slotOf = useCallback((id: string) => settings.models ? slots[id] ?? 0 : selected.indexOf(id), [settings.models, slots, selected]);
  const seriesFor = useCallback((dark: boolean, color: (labId: string) => string) => radarSeries(models, selected, colors, dark, color, slotOf), [models, selected, colors, slotOf]);
  const series = useMemo(() => seriesFor(pal.dark, (id) => labColor(id, labOf.get(id)?.color)), [seriesFor, pal.dark, labColor, labOf]);

  const toggle = useCallback((id: string) => {
    const base = settings.models ? slots : Object.fromEntries(selected.map((x, i) => [x, i]));
    if (selected.includes(id)) {
      const next = { ...base }; delete next[id];
      setSlots(next); update({ models: selected.filter((x) => x !== id) });
    } else {
      const used = new Set(Object.values(base)); let slot = 0; while (used.has(slot)) slot++;
      setSlots({ ...base, [id]: slot }); update({ models: [...selected, id] });
    }
  }, [settings.models, slots, selected]);
  const setAll = (ids: string[] | undefined) => { setSlots({}); update({ models: ids }); };

  // While this chart is the linked one, keep its params in the address bar current.
  const params = radarParams(settings);
  const paramKey = JSON.stringify(params);
  useEffect(() => {
    if (!linkedHere(anchor)) return;
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(params)) { if (value) url.searchParams.set(key, value); else url.searchParams.delete(key); }
    window.history.replaceState(window.history.state, "", url.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey, anchor]);

  if (axes.length < RADAR_MIN_AXES) return null;
  const leader = series[0];
  const open = series.find((s) => s.id === expanded);
  const step = (dir: 1 | -1) => setExpanded((id) => { const i = series.findIndex((s) => s.id === id); return series[(i + dir + series.length) % series.length]?.id ?? null; });
  const caption = (s: RadarSeries) => {
    const m = byId.get(s.id)!;
    if (axis != null) return <span className="num cap rl-caption"><b className="rl-on">{formatValue(m.points[axis], axes[axis])}{m.points[axis].estimated ? " est." : ""}</b> {axes[axis].label}</span>;
    return <span className="num cap">#{m.rank} · {m.score.toFixed(1)}</span>;
  };
  const title = `Strengths · ${config.name}`;
  const meta = new Map(models.map((m) => [m.id, { rank: m.rank, score: m.score }]));
  const staticSvg = (dark: boolean) => radarSvg({ axes, norm, meta, pal: RADAR_PALETTES[dark ? "dark" : "light"], ghost: showMedian ? median : undefined,
    series: seriesFor(dark, (id) => markColor(labOf.get(id)?.color, dark ? DARK_PALETTE : LIGHT_PALETTE, id)) });
  const exportRows = () => series.flatMap((s) => { const m = byId.get(s.id)!; return axes.map((a, i) => ({ model: s.name, rank: m.rank, index_score: +m.score.toFixed(2), benchmark: a.name, share_pct: +a.share.toFixed(1), value: m.points[i].value == null ? null : +(m.points[i].raw ?? m.points[i].value!).toFixed(3), radius: m.points[i].r == null ? null : +m.points[i].r!.toFixed(3), estimated: m.points[i].estimated })); });

  return <div>
    {expand.backdrop}
    <div className={expand.expanded ? "chart-expanded" : undefined} role={expand.expanded ? "dialog" : undefined} aria-modal={expand.expanded || undefined} aria-label={expand.expanded ? "Strengths" : undefined}>
    <div className="chart-toolbar rl-panel-head">
      <ul className="rl-legend" aria-label="Models on the radar">
        {series.map((s) => <li key={s.id} onMouseEnter={() => setFocus(s.id)} onMouseLeave={() => setFocus(null)}><RadarSwatch color={s.color} dash={s.dash} />{s.name}</li>)}
        {showMedian && view === "radar" && <li className="rl-legend-median"><i aria-hidden="true" />Field median</li>}
      </ul>
      <div className="flex items-center gap-1 ml-auto">
        <div className="seg" role="group" aria-label="Strengths view">
          <button type="button" aria-pressed={view === "radar"} title="Radar" onClick={() => update({ view: "radar" })}><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" aria-hidden="true"><path d="M8 1.5 14 6l-2.3 7.5H4.3L2 6z" /><path d="M8 5.5 10.6 7.4 9.6 10.5H6.4l-1-3.1z" /></svg></button>
          <button type="button" aria-pressed={view === "bars"} title="A bar chart per benchmark" onClick={() => update({ view: "bars" })}><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="2" y="3" width="3" height="11" /><rect x="6.5" y="6" width="3" height="8" /><rect x="11" y="9" width="3" height="5" /></svg></button>
        </div>
        <RadarSettingsMenu view={view} topN={view === "bars" ? BARS_TOP : RADAR_TOP} models={models} series={series} selected={selected} onToggle={toggle} onTop={() => setAll(undefined)} onNone={() => setAll([])} labColor={colorOfLab}
          norm={norm} onNorm={(n) => update({ norm: n })} colorMode={colors} onColorMode={(c) => update({ colors: c })} showMedian={showMedian} onShowMedian={(v) => update({ median: v })} compare={compare} onCompare={(c) => update({ compare: c })} />
        <ChartLink id={anchor} name="Strengths" params={{ extra: params }} />
        <ChartExport name="Strengths" frame getSvg={() => view === "bars" ? benchSheetSvg(axes, sheets.current, RADAR_PALETTES[pal.dark ? "dark" : "light"], title) : staticSvg(pal.dark)} getRows={exportRows} getHtml={view === "radar" ? () => radarHtml({ title, date: snapshot.date, light: staticSvg(false), dark: staticSvg(true) }) : undefined} />
        {expand.button}
      </div>
    </div>
    {!series.length ? <p className="cap py-10 text-center">No models selected. Pick some in the chart settings.</p> : view === "bars" ?
    <BenchBars axes={axes} series={series} focus={focus} onInfo={setInfo} register={register} /> :
    <div className={`rl-strengths${expand.expanded ? " rl-strengths-expanded" : ""}`}>
      <div className="rl-main">
        <Radar axes={axes} series={series} ghost={showMedian ? median : undefined} norm={norm} size={380} focus={focus} hoverAxis={axis} onHoverAxis={setAxis} onAxisClick={setInfo}
          ariaLabel={`Radar of ${series.map((s) => s.name).join(", ")} across ${axes.length} benchmarks`} />
      </div>
      <div>
        <ol className="rl-rail" aria-label="Each model's shape">
          {series.map((s) => {
            const vsLeader = compare === "leader" && s.id !== leader.id;
            return <li key={s.id} className={focus === s.id ? "rl-rail-on" : undefined} onMouseEnter={() => setFocus(s.id)} onMouseLeave={() => setFocus(null)}>
              <button type="button" className="rl-rail-btn" aria-label={`Expand ${s.name}`} onClick={() => setExpanded(s.id)}>
                <Radar axes={axes} series={[s]} ghost={vsLeader ? leader.points : median} ghostStyle={vsLeader ? "outline" : "median"} norm={norm} size={112} labels={false} compact hoverAxis={axis} ariaLabel={`${s.name} across ${axes.length} benchmarks`} />
                <span className="rl-rail-text">
                  <span className="rl-rail-name"><RadarSwatch color={s.color} dash={s.dash} />{s.name}</span>
                  {caption(s)}
                  <span className="cap">{vsLeader ? `vs ${leader.name}` : "vs field median"}</span>
                </span>
              </button>
            </li>;
          })}
        </ol>
        <p className="cap rl-rail-hint">Click a model to expand it.</p>
      </div>
    </div>}
    </div>
    {open && <RadarModal key={open.id} onClose={() => setExpanded(null)} onStep={step} series={open} all={series} axes={axes} norm={norm} model={byId.get(open.id)!} leader={leader} median={median} onAxisClick={setInfo} />}
    <BenchmarkInfo snapshot={snapshot} benchmarkId={info} inMix onClose={() => setInfo(null)} />
  </div>;
}

function RadarSettingsMenu({ view, topN, models, series, selected, onToggle, onTop, onNone, labColor, norm, onNorm, colorMode, onColorMode, showMedian, onShowMedian, compare, onCompare }: {
  view: RadarView; topN: number;
  models: RadarModel[]; series: RadarSeries[]; selected: string[]; onToggle: (id: string) => void; onTop: () => void; onNone: () => void; labColor: (m: RadarModel) => string;
  norm: RadarNorm; onNorm: (n: RadarNorm) => void; colorMode: RadarColors; onColorMode: (c: RadarColors) => void;
  showMedian: boolean; onShowMedian: (v: boolean) => void; compare: RadarCompare; onCompare: (v: RadarCompare) => void;
}) {
  const id = useId(), root = useRef<HTMLDetailsElement>(null), trigger = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false), [tab, setTab] = useState<"models" | "settings">("models"), [query, setQuery] = useState("");
  const dismiss = useCallback((reason: "outside" | "escape") => { setOpen(false); if (reason === "escape") trigger.current?.focus(); }, []);
  useLightDismiss(root, dismiss);
  const q = query.trim().toLowerCase();
  // Selected models pin to the top, then index rank.
  const list = models.filter((m) => m.name.toLowerCase().includes(q)).sort((a, b) => Number(selected.includes(b.id)) - Number(selected.includes(a.id)));
  const seriesOf = new Map(series.map((s) => [s.id, s]));
  return <details ref={root} open={open} className={styles.picker} name="chart-settings">
    <summary ref={trigger} aria-label="Strengths settings" title="Strengths settings" onClick={(e) => { e.preventDefault(); setOpen(!open); }}><IconAdjustmentsHorizontal size={16} stroke={1.5} aria-hidden="true" /></summary>
    <div className={`${styles.menu} chart-settings-menu`}>
      <div className={styles.heading}><span>Chart settings</span><button type="button" aria-label="Close chart settings" onClick={() => dismiss("escape")}><IconX size={16} stroke={1.5} aria-hidden="true" /></button></div>
      <div className={styles.tabs} role="tablist" aria-label="Strengths settings sections">
        {(["models", "settings"] as const).map((value) => <button key={value} id={`${id}-${value}-tab`} role="tab" type="button" aria-selected={tab === value} onClick={() => setTab(value)}>{value === "models" ? "Models" : "Settings"}</button>)}
      </div>
      <div className={styles.body} role="tabpanel" aria-labelledby={`${id}-${tab}-tab`}>
        {tab === "models" ? <>
          <div className={styles.modelCount}><span>{selected.length} of {models.length} {view === "bars" ? "charted" : "on the radar"}</span><button type="button" onClick={onTop}>Top {topN}</button><button type="button" onClick={onNone}>None</button></div>
          <input type="search" className={styles.search} aria-label="Search models" placeholder="Search models" value={query} onChange={(e) => setQuery(e.target.value)} />
          {view === "radar" && selected.length > 6 && <p className="rl-menu-warn">More than 6 overlaid shapes get hard to read. The small radars still show each one.</p>}
          <div className={styles.modelList}>{list.map((m) => { const s = seriesOf.get(m.id);
            return <div key={m.id} className={styles.model}><label><input type="checkbox" checked={!!s} onChange={() => onToggle(m.id)} />
              {s ? <RadarSwatch color={s.color} dash={s.dash} /> : <i aria-hidden="true" style={{ background: labColor(m) }} />}
              <span>{m.name}</span><span className="cap rl-menu-rank">#{m.rank}</span></label></div>; })}
            {!list.length && <p>No matching models.</p>}</div>
        </> : <>
          {view === "radar" && <><div className={styles.row}><span id={`${id}-norm`}>Scale</span><div className={styles.choice} role="group" aria-labelledby={`${id}-norm`}>
            {RADAR_NORMS.map((n) => <button key={n.id} type="button" aria-pressed={norm === n.id} title={n.hint} onClick={() => onNorm(n.id)}>{n.label}</button>)}</div></div>
          <p className="rl-menu-hint">{RADAR_NORMS.find((n) => n.id === norm)!.hint}</p>
          <div className={styles.row}><label htmlFor={`${id}-compare`}>Small radars vs</label><select id={`${id}-compare`} value={compare} onChange={(e) => onCompare(e.target.value as RadarCompare)}>
            <option value="leader">Leader</option><option value="median">Field median</option></select></div></>}
          <div className={styles.row}><label htmlFor={`${id}-colors`}>Colors</label><select id={`${id}-colors`} value={colorMode} onChange={(e) => onColorMode(e.target.value as RadarColors)}>
            <option value="lab">Lab color</option><option value="distinct">One per model</option></select></div>
          {view === "radar" && <div className={styles.toggles}>
            <label><span>Field median</span><input type="checkbox" checked={showMedian} onChange={(e) => onShowMedian(e.target.checked)} /></label>
          </div>}
        </>}
      </div>
    </div>
  </details>;
}
