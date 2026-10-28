"use client";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { IconAdjustmentsHorizontal, IconStar, IconStarFilled, IconX } from "@tabler/icons-react";
import { COST_BASES, type CostBasis } from "@/data/subscription";
import type { TaskMetricSource } from "@/data/task-metrics";
import { useLightDismiss } from "@/lib/useLightDismiss";
import { EFFORT_CHOICES } from "@/engine";
import { isHighlighted, toggleModel, useHighlight } from "./highlight";
import type { ScatterView } from "./ScoreScatter";
import { labelScale } from "./label-size";
import { chartLinkUrl } from "@/lib/highlight-link";
import { FormulaEditor, type FormulaSettings } from "./formula-chart";
import styles from "./ChartSettings.module.css";

const EFFORT_LABELS: Record<string, string> = { none: "none", low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" };

export function ChartSettings({ label, mode, onChange, efforts, releasedAfter, onChangeReleased, models = [], excluded, onToggleModel, onShowAllModels, onHideAllModels, onShowOnly, view, onView, dataSource, costBasis, planResets, defaultScale, anchor, formula }: {
  /** Advanced: a custom formula for this chart's metric. Omitted where a chart has no formula support. */
  formula?: FormulaSettings;
  /** Cost charts: price tasks at API list prices or at each lab's subscription plan. */
  costBasis?: { value: CostBasis; onChange: (basis: CostBasis) => void };
  /** Subscription pricing: count limit resets (what each lab gave its subscribers in the last 30 days). Shown under Advanced. */
  planResets?: { value: boolean; onChange: (on: boolean) => void; note?: string };
  anchor?: string;
  /** Default metric scale, when the chart supports switching to linear. */
  defaultScale?: "log" | "linear";
  dataSource?: { value: TaskMetricSource; options: { id: TaskMetricSource; name: string; modelCount: number }[]; onChange: (source: TaskMetricSource) => void };
  label: string; mode: "all" | "best"; onChange: (mode: "all" | "best") => void;
  /** Cost, time and speed charts: pick which reasoning efforts show, one by one, instead of the all/best dropdown. */
  efforts?: { value: string[]; onChange: (efforts: string[]) => void; /** Also show the best-or-all dropdown (the ranking list, which has both). */ withMode?: boolean };
  /** Model-age filter: ISO date cutoff; "" means all time. */
  releasedAfter?: string;
  onChangeReleased?: (value: string) => void;
  /** Model picker: ranked-order list + the index's excluded set. */
  models?: { id: string; name: string; color?: string; /** weights are downloadable; undefined when unknown */ open?: boolean }[];
  excluded?: Set<string>;
  onToggleModel?: (id: string) => void;
  onShowAllModels?: () => void;
  onHideAllModels?: () => void;
  /** Show only these models (the open-weights and closed-weights shortcuts). */
  onShowOnly?: (ids: string[]) => void;
  /** Scatter display: label density, frontier line, reasoning-effort lines. */
  view?: ScatterView;
  onView?: (view: ScatterView, persist?: boolean) => void;
}) {
  const id = useId(), root = useRef<HTMLDetailsElement>(null), trigger = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false), [tab, setTab] = useState<"models" | "settings">(models.length && onToggleModel ? "models" : "settings"), [query, setQuery] = useState(""), [advanced, setAdvanced] = useState(false);
  const [placement, setPlacement] = useState({ height: 620, above: false });
  useEffect(() => {
    if (!open) return;
    const position = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const below = innerHeight - rect.bottom - 16, above = rect.top - 16;
      const flip = innerWidth >= 640 && below < 240 && above > below;
      setPlacement({ height: Math.max(120, flip ? above : below), above: flip });
    };
    const frame = requestAnimationFrame(position);
    addEventListener("resize", position);
    addEventListener("scroll", position, true);
    return () => { cancelAnimationFrame(frame); removeEventListener("resize", position); removeEventListener("scroll", position, true); };
  }, [open]);
  const hl = useHighlight();
  const dismiss = useCallback((reason: "outside" | "escape") => { setOpen(false); if (reason === "escape") trigger.current?.focus(); }, []);
  useLightDismiss(root, dismiss);
  const releaseDate = (months: number) => { const d = new Date(); d.setMonth(d.getMonth() - months); return d.toISOString().slice(0, 10); };
  const releaseValue = releasedAfter === "" ? "all" : releasedAfter === undefined ? "6" : [6, 12, 24].find(m => Math.abs(Date.parse(releasedAfter) - Date.parse(releaseDate(m))) < 45 * 86400000)?.toString() ?? "custom";
  // Rows keep the order they had when the menu opened, so a model you untick stays under your cursor instead of jumping to the bottom.
  const [openOrder, setOpenOrder] = useState<string[]>([]);
  const place = useMemo(() => new Map(openOrder.map((id, i) => [id, i])), [openOrder]);
  const filtered = useMemo(() => models.filter(m => m.name.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => (place.get(a.id) ?? 1e9) - (place.get(b.id) ?? 1e9)).sort((a, b) => Number(!!hl && isHighlighted(hl.items, b.id)) - Number(!!hl && isHighlighted(hl.items, a.id))), [models, query, hl, place]);
  function tabKey(event: KeyboardEvent, current: "models" | "settings") {
    const arrows = ["ArrowLeft", "ArrowRight"];
    if (![...arrows, "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? "models" : event.key === "End" ? "settings" : current === "models" ? "settings" : "models";
    setTab(next); document.getElementById(`${id}-${next}-tab`)?.focus();
  }
  const hasModels = !!onToggleModel && models.length > 0;
  const modelPanel = <>
    <div className={styles.modelCount}><span>{models.filter(m => !excluded?.has(m.id)).length} of {models.length} selected</span>{onShowAllModels && <button type="button" onClick={onShowAllModels}>All</button>}{onHideAllModels && <button type="button" onClick={onHideAllModels}>None</button>}{onShowOnly && models.some((m) => m.open !== undefined) && <>
      <button type="button" onClick={() => onShowOnly(models.filter((m) => m.open === true).map((m) => m.id))} title="Show only models whose weights can be downloaded">Open</button>
      <button type="button" onClick={() => onShowOnly(models.filter((m) => m.open === false).map((m) => m.id))} title="Show only models with closed weights">Closed</button></>}</div>
    <input type="search" className={styles.search} aria-label="Search models" placeholder="Search models" value={query} onChange={e => setQuery(e.target.value)} />
    <div className={styles.modelList}>{filtered.map(m => {
      const star = !!hl && isHighlighted(hl.items, m.id);
      return <div key={m.id} className={styles.model}><label><input type="checkbox" checked={!excluded?.has(m.id)} onChange={() => onToggleModel?.(m.id)} />{m.color && <i aria-hidden="true" style={{ background: m.color }} />}<span>{m.name}</span></label>{hl && <button type="button" className={star ? styles.starred : undefined} aria-label={`${star ? "Unstar" : "Star"} ${m.name}`} aria-pressed={star} onClick={() => { if (!hl) return; if (!star && excluded?.has(m.id)) onToggleModel?.(m.id); hl.set(toggleModel(hl.items, m.id)); }}>{star ? <IconStarFilled size={15} aria-hidden="true" /> : <IconStar size={15} stroke={1.5} aria-hidden="true" />}</button>}</div>;
    })}{!filtered.length && <p>No matching models.</p>}</div>
  </>;
  const resets = costBasis?.value === "subscription" ? planResets : undefined;
  const settingsPanel = <>
    {(dataSource || onChangeReleased) && <div className={styles.dataControls}>
      {dataSource && <div className={styles.dataField}><label htmlFor={`${id}-source`}>Data source</label><select aria-label={`${label} data source`} id={`${id}-source`} value={dataSource.value} onChange={e => dataSource.onChange(e.target.value as TaskMetricSource)}>{dataSource.options.map(s => <option key={s.id} value={s.id}>{s.name} ({s.modelCount} models)</option>)}</select></div>}
      {onChangeReleased && <div className={styles.dataField}><label htmlFor={`${id}-release`}>Released</label><select aria-label={`${label} release window`} id={`${id}-release`} value={releaseValue} onChange={e => onChangeReleased?.(e.target.value === "all" ? "" : releaseDate(+e.target.value))}><option value="6">Last 6 months</option><option value="12">Last year</option><option value="24">Last 2 years</option><option value="all">All time</option>{releaseValue === "custom" && <option value="custom" disabled>Custom</option>}</select></div>}
    </div>}
    {costBasis && <div className={styles.row}><span id={`${id}-basis-label`}>Pricing</span><div className={styles.choice} role="group" aria-labelledby={`${id}-basis-label`}>{COST_BASES.map(b => <button key={b.id} type="button" aria-pressed={costBasis.value === b.id} onClick={() => costBasis.onChange(b.id)}>{b.name}</button>)}</div></div>}
    {defaultScale && view && onView && view.kind !== "bars" && <div className={styles.row}><span id={`${id}-scale-label`}>Scale</span><div className={styles.choice} role="group" aria-labelledby={`${id}-scale-label`}>{(["log", "linear"] as const).map(value => <button key={value} type="button" aria-pressed={(view.scale ?? defaultScale) === value} onClick={() => onView({ ...view, scale: value })}>{value === "log" ? "Log" : "Linear"}</button>)}</div></div>}
    {efforts && <div className={styles.row}><span id={`${id}-efforts-label`}>Reasoning</span><div className={styles.efforts} role="group" aria-labelledby={`${id}-efforts-label`}>{EFFORT_CHOICES.map(e => { const on = efforts.value.includes(e); return <button key={e} type="button" aria-pressed={on} data-effort={e} title={e === "none" ? "Models run with no reasoning" : undefined} onClick={() => efforts.onChange(EFFORT_CHOICES.filter(x => x === e ? !on : efforts.value.includes(x)))}>{EFFORT_LABELS[e]}</button>; })}</div></div>}
    {(!efforts || efforts.withMode) && <div className={styles.row}><label htmlFor={`${id}-effort`}>{efforts ? "Show" : "Reasoning efforts"}</label><select aria-label={`${label} reasoning efforts`} id={`${id}-effort`} value={mode} onChange={e => onChange(e.target.value as "all" | "best")}><option value="all">All efforts</option><option value="best">Best per model</option></select></div>}
    {view && onView && view.kind !== "bars" && <>
      <div className={styles.labels}><div><label htmlFor={`${id}-density`}>Labels</label><span>{view.density === 0 ? "Frontier only" : view.density === 1 ? "All" : `${Math.round(view.density * 100)}%`}</span></div><input aria-label={`${label} label density`} id={`${id}-density`} type="range" min={0} max={100} step={5} value={Math.round(view.density * 100)} onChange={e => onView({ ...view, density: +e.target.value / 100 })} /></div>
    </>}
    {view && onView && <div className={styles.labels}><div><label htmlFor={`${id}-label-size`}>Label size</label><span>{Math.round(labelScale(view.labelScale) * 100)}%</span></div><input aria-label={`${label} label size`} id={`${id}-label-size`} type="range" min={75} max={175} step={5} value={Math.round(labelScale(view.labelScale) * 100)} onChange={e => {
      const ls = +e.target.value;
      onView({ ...view, labelScale: ls / 100 });
      if (anchor) {
        const url = chartLinkUrl(window.location.href, anchor, { cv: view.kind, cm: mode, cs: view.kind !== "bars" ? view.scale ?? defaultScale : undefined, ls }, hl ?? undefined);
        window.history.replaceState(window.history.state, "", url.toString());
      }
    }} /></div>}
    {view && onView && view.kind !== "bars" && <>
      <div className={styles.toggles}>
        <label><span>Pareto frontier</span><input type="checkbox" checked={view.frontier} onChange={e => onView({ ...view, frontier: e.target.checked, frontierChosen: true })} /></label>
        <label><span>Connect efforts</span><input type="checkbox" checked={view.links} onChange={e => onView({ ...view, links: e.target.checked })} /></label>
        <label title="Off: the frontier and each lab's current models only"><span>All models</span><input type="checkbox" checked={!!view.allModels} onChange={e => onView({ ...view, allModels: e.target.checked })} /></label>
        {!!hl?.items.length && <label><span>Highlight guides</span><input type="checkbox" checked={view.guides !== false} onChange={e => onView({ ...view, guides: e.target.checked })} /></label>}
      </div>
    </>}
    {((formula && view && onView) || resets) && <details className={styles.advanced} open={advanced} onToggle={e => setAdvanced(e.currentTarget.open)}>
      <summary>Advanced{view?.formula?.trim() ? <em>formula on</em> : resets && !resets.value ? <em>resets off</em> : null}</summary>
      {resets && <div className={styles.toggles}>
        <label title={resets.note}><span>Count limit resets</span><input type="checkbox" checked={resets.value} onChange={e => resets.onChange(e.target.checked)} /></label>
        {resets.note && <p className={styles.resetNote}>{resets.note}</p>}
      </div>}
      {advanced && formula && view && onView && <FormulaEditor id={id} label={label} formula={formula} view={view} onView={onView} />}
    </details>}
  </>;
  return <details ref={root} open={open} className={styles.picker} name="chart-settings">
    <summary ref={trigger} aria-label={`${label} settings`} title={`${label} settings`} onClick={e => { e.preventDefault(); if (!open) { setTab(hasModels ? "models" : "settings"); setOpenOrder(models.map(m => m.id)); } setOpen(!open); }}><IconAdjustmentsHorizontal size={16} stroke={1.5} aria-hidden="true" /></summary>
    <div className={`${styles.menu} chart-settings-menu`} data-above={placement.above} style={{ "--picker-space": `${placement.height}px` } as CSSProperties}>
      <div className={styles.heading}><span>Chart settings</span><button type="button" aria-label="Close chart settings" onClick={() => dismiss("escape")}><IconX size={16} stroke={1.5} aria-hidden="true" /></button></div>
      {hasModels && <div className={styles.tabs} role="tablist" aria-label={`${label} settings sections`}>
        {(["models", "settings"] as const).map(value => <button key={value} id={`${id}-${value}-tab`} role="tab" type="button" aria-selected={tab === value} aria-controls={`${id}-${value}-panel`} tabIndex={tab === value ? 0 : -1} onKeyDown={e => tabKey(e, value)} onClick={() => setTab(value)}>{value === "models" ? "Models" : "Settings"}</button>)}
      </div>}
      <div className={styles.body} role={hasModels ? "tabpanel" : "region"} id={`${id}-${tab}-panel`} aria-labelledby={hasModels ? `${id}-${tab}-tab` : undefined} aria-label={hasModels ? undefined : `${label} settings`}>{hasModels && tab === "models" ? modelPanel : settingsPanel}</div>
    </div>
  </details>;
}
