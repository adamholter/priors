"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import { IconAdjustmentsHorizontal, IconX } from "@tabler/icons-react";
import type { Lab } from "@/data/types";
import { selectVariants, type IndexResult, type RankedVariant } from "@/engine";
import { useLightDismiss } from "@/hooks/useLightDismiss";
import { useChartPalette, useLabColor } from "./echarts";
import { Radar, RadarSwatch, type RadarSeries } from "./Radar";
import { RadarModal } from "./RadarModal";
import { formatValue, medianPoints, radarAxes, radarModels, RADAR_MIN_AXES, type RadarModel, type RadarNorm } from "./radar-data";
import styles from "./ChartSettings.module.css";
import "./radar.css";

type Compare = "leader" | "median";
const NORMS: { id: RadarNorm; label: string; hint: string }[] = [
  { id: "field", label: "Range", hint: "Each spoke runs from the worst to the best ranked model on that benchmark." },
  { id: "rank", label: "Percentile", hint: "Each spoke is the model's percentile among ranked models." },
  { id: "score", label: "Raw", hint: "The index's 0–100 score per benchmark, unstretched." },
];
/** Validated categorical palette (dataviz reference) for the "one color per model" option. */
const DISTINCT = { light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"], dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"] };
const DASHES = [undefined, "7 4", "2 3", "10 3 2 3"];
const TOP = 4;

/** A radar needs three spokes to enclose an area; with fewer the panel is not shown. */
export const radarReady = (benchmarks: IndexResult["benchmarks"]) => benchmarks.length >= RADAR_MIN_AXES;

/**
 * Overlaid radar of the top models across the index's benchmarks, plus one small radar per model.
 * Selection follows the live top 4 until the user picks models; then their picks stick.
 */
export function StrengthsRadar({ ranked, benchmarks, labs }: { ranked: RankedVariant[]; benchmarks: IndexResult["benchmarks"]; labs: Lab[] }) {
  const [norm, setNorm] = useState<RadarNorm>("field");
  const [compare, setCompare] = useState<Compare>("leader");
  const [colorMode, setColorMode] = useState<"lab" | "distinct">("lab");
  const [showMedian, setShowMedian] = useState(true);
  const [custom, setCustom] = useState<string[] | null>(null);
  const [slots, setSlots] = useState<Record<string, number>>({});
  const [focus, setFocus] = useState<string | null>(null);
  const [axis, setAxis] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const pal = useChartPalette();
  const labColor = useLabColor();

  const rows = useMemo(() => selectVariants(ranked, "best"), [ranked]);
  const axes = useMemo(() => radarAxes(benchmarks, rows), [benchmarks, rows]);
  const models = useMemo(() => radarModels(rows, axes, norm), [rows, axes, norm]);
  const median = useMemo(() => medianPoints(rows, axes, norm), [rows, axes, norm]);
  const byId = useMemo(() => new Map(models.map((m) => [m.id, m])), [models]);
  const defaults = useMemo(() => models.slice(0, TOP).map((m) => m.id), [models]);
  const selected = custom ?? defaults;
  const colorOfLab = useCallback((m: RadarModel) => labColor(m.labId, labs.find((l) => l.id === m.labId)?.color), [labColor, labs]);

  const toggle = useCallback((id: string) => {
    const base = custom ?? defaults;
    const baseSlots = custom ? slots : Object.fromEntries(defaults.map((x, i) => [x, i]));
    if (base.includes(id)) {
      const next = { ...baseSlots }; delete next[id];
      setCustom(base.filter((x) => x !== id)); setSlots(next);
    } else {
      const used = new Set(Object.values(baseSlots)); let slot = 0; while (used.has(slot)) slot++;
      setCustom([...base, id]); setSlots({ ...baseSlots, [id]: slot });
    }
  }, [custom, defaults, slots]);
  const setAll = (ids: string[] | null) => { setCustom(ids); setSlots({}); };

  // Series follow index rank so the legend and small radars read top to bottom.
  const series: RadarSeries[] = useMemo(() => {
    const seen = new Map<string, number>();
    return models.filter((m) => selected.includes(m.id)).map((m) => {
      if (colorMode === "distinct") {
        const slot = custom ? slots[m.id] ?? 0 : defaults.indexOf(m.id);
        return { id: m.id, name: m.name, points: m.points, color: (pal.dark ? DISTINCT.dark : DISTINCT.light)[slot % 8] };
      }
      const n = seen.get(m.labId) ?? 0; seen.set(m.labId, n + 1);
      return { id: m.id, name: m.name, points: m.points, color: colorOfLab(m), dash: DASHES[n % DASHES.length] };
    });
  }, [models, selected, colorMode, custom, slots, defaults, pal.dark, colorOfLab]);

  if (axes.length < RADAR_MIN_AXES) return null;
  const leader = series[0];
  const open = series.find((s) => s.id === expanded);
  const step = (dir: 1 | -1) => setExpanded((id) => { const i = series.findIndex((s) => s.id === id); return series[(i + dir + series.length) % series.length]?.id ?? null; });
  const caption = (s: RadarSeries) => {
    const m = byId.get(s.id)!;
    if (axis != null) return <span className="num cap rl-caption"><b className="rl-on">{formatValue(m.points[axis], axes[axis])}{m.points[axis].estimated ? " est." : ""}</b> {axes[axis].label}</span>;
    return <span className="num cap">#{m.rank} · {m.score.toFixed(1)}</span>;
  };

  return <div>
    <div className="rl-panel-head">
      <ul className="rl-legend" aria-label="Models on the radar">
        {series.map((s) => <li key={s.id} onMouseEnter={() => setFocus(s.id)} onMouseLeave={() => setFocus(null)}><RadarSwatch color={s.color} dash={s.dash} />{s.name}</li>)}
        {showMedian && <li className="rl-legend-median"><i aria-hidden="true" />Field median</li>}
      </ul>
      <RadarSettings models={models} series={series} selected={selected} onToggle={toggle} onTop={() => setAll(null)} onNone={() => setAll([])} labColor={colorOfLab}
        norm={norm} onNorm={setNorm} colorMode={colorMode} onColorMode={setColorMode} showMedian={showMedian} onShowMedian={setShowMedian} compare={compare} onCompare={setCompare} />
    </div>
    {!series.length ? <p className="cap py-10 text-center">No models selected. Pick some in the chart settings.</p> :
    <div className="rl-strengths">
      <div className="rl-main">
        <Radar axes={axes} series={series} ghost={showMedian ? median : undefined} norm={norm} size={380} focus={focus} hoverAxis={axis} onHoverAxis={setAxis}
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
    {open && <RadarModal key={open.id} onClose={() => setExpanded(null)} onStep={step} series={open} all={series} axes={axes} norm={norm} model={byId.get(open.id)!} leader={leader} median={median} />}
  </div>;
}

function RadarSettings({ models, series, selected, onToggle, onTop, onNone, labColor, norm, onNorm, colorMode, onColorMode, showMedian, onShowMedian, compare, onCompare }: {
  models: RadarModel[]; series: RadarSeries[]; selected: string[]; onToggle: (id: string) => void; onTop: () => void; onNone: () => void; labColor: (m: RadarModel) => string;
  norm: RadarNorm; onNorm: (n: RadarNorm) => void; colorMode: "lab" | "distinct"; onColorMode: (c: "lab" | "distinct") => void;
  showMedian: boolean; onShowMedian: (v: boolean) => void; compare: Compare; onCompare: (v: Compare) => void;
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
          <div className={styles.modelCount}><span>{selected.length} of {models.length} on the radar</span><button type="button" onClick={onTop}>Top {TOP}</button><button type="button" onClick={onNone}>None</button></div>
          <input type="search" className={styles.search} aria-label="Search models" placeholder="Search models" value={query} onChange={(e) => setQuery(e.target.value)} />
          {selected.length > 6 && <p className="rl-menu-warn">More than 6 overlaid shapes get hard to read. The small radars still show each one.</p>}
          <div className={styles.modelList}>{list.map((m) => { const s = seriesOf.get(m.id);
            return <div key={m.id} className={styles.model}><label><input type="checkbox" checked={!!s} onChange={() => onToggle(m.id)} />
              {s ? <RadarSwatch color={s.color} dash={s.dash} /> : <i aria-hidden="true" style={{ background: labColor(m) }} />}
              <span>{m.name}</span><span className="cap rl-menu-rank">#{m.rank}</span></label></div>; })}
            {!list.length && <p>No matching models.</p>}</div>
        </> : <>
          <div className={styles.row}><span id={`${id}-norm`}>Scale</span><div className={styles.choice} role="group" aria-labelledby={`${id}-norm`}>
            {NORMS.map((n) => <button key={n.id} type="button" aria-pressed={norm === n.id} title={n.hint} onClick={() => onNorm(n.id)}>{n.label}</button>)}</div></div>
          <p className="rl-menu-hint">{NORMS.find((n) => n.id === norm)!.hint}</p>
          <div className={styles.row}><label htmlFor={`${id}-compare`}>Small radars vs</label><select id={`${id}-compare`} value={compare} onChange={(e) => onCompare(e.target.value as Compare)}>
            <option value="leader">Leader</option><option value="median">Field median</option></select></div>
          <div className={styles.row}><label htmlFor={`${id}-colors`}>Colors</label><select id={`${id}-colors`} value={colorMode} onChange={(e) => onColorMode(e.target.value as "lab" | "distinct")}>
            <option value="lab">Lab color</option><option value="distinct">One per model</option></select></div>
          <div className={styles.toggles}>
            <label><span>Field median</span><input type="checkbox" checked={showMedian} onChange={(e) => onShowMedian(e.target.checked)} /></label>
          </div>
        </>}
      </div>
    </div>
  </details>;
}
