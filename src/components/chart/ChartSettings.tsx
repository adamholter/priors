"use client";
import { startTransition, useCallback, useEffect, useId, useMemo, useOptimistic, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { IconAdjustmentsHorizontal, IconStar, IconStarFilled, IconX } from "@tabler/icons-react";
import { COST_BASES, type CostBasis } from "@/data/subscription";
import { SPEED_TIERS } from "@/data/speed-tiers";
import type { TaskMetricSource } from "@/data/task-metrics";
import { useLightDismiss } from "@/lib/useLightDismiss";
import { EFFORT_CHOICES } from "@/engine";
import { isHighlighted, toggleModel, useHighlight } from "./highlight";
import type { ScatterView } from "./ScoreScatter";
import { labelScale } from "./label-size";
import { chartLinkUrl } from "@/lib/highlight-link";
import { FormulaEditor, type FormulaSettings } from "./formula-chart";
import { PlanReadingSwitch, PlanSection, type PlanOptions } from "./PlanPicker";
import { ChartComposer, type ChartChanges } from "./ChartComposer";
import { usePlanAdjustments } from "@/lib/subscription-plans-pref";
import { useChartPalette } from "./palette-context";
import { setChartGridPref, useChartGrid } from "@/lib/chart-grid-pref";
import styles from "./ChartSettings.module.css";

const EFFORT_LABELS: Record<string, string> = { none: "none", low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" };

export function ChartSettings({ freeTiers, planReading, speedTiers, label, mode, onChange, efforts, releasedAfter, onChangeReleased, models = [], excluded, onToggleModel, onShowAllModels, onHideAllModels, onShowOnly, view, onView, dataSource, costBasis, planResets, subscriptionPlans, defaultScale, anchor, formula, minUsers }: {
  /** Data tab: a custom formula for this chart's metric. Omitted where a chart has no formula support. */
  formula?: FormulaSettings;
  /** Subscription pricing: price models free today at nothing, or on their paid plans. Shown in the plans section. */
  freeTiers?: { value: "generous" | "limited" | "off"; onChange: (value: "generous" | "limited" | "off") => void; generous: number; limited: number };
  /** Two readings of a model's plan rate (Fable 5.2), from `planReadingSettings`. */
  planReading?: { models: { name: string }[]; options: { id: string; name: string; note: string }[]; value: string; onChange: (id: string) => void };
  /** Cost, time and speed charts: which speed tiers to draw, and one line per tier on what it costs and how it is billed. */
  speedTiers?: { value: string[]; onChange: (tiers: string[] | undefined) => void; rows: { tier: string; name: string; text: string }[] };
  /** Cost charts: price tasks at API list prices or at each lab's subscription plan. */
  costBasis?: { value: CostBasis; onChange: (basis: CostBasis) => void };
  /** Subscription pricing: count limit resets (what each lab gave its subscribers in the last 30 days). Shown in the plans section. */
  planResets?: { value: boolean; onChange: (on: boolean) => void; note?: string; rows?: { lab: string; text: string }[]; fable?: { value: number; onChange: (n: number) => void } };
  /** Subscription pricing: the plan each lab's models are priced at (`planPicker`). Unpicked labs use each model's default plan (its best common plan, `src/data/plan-defaults.ts`), which `median` names. Listed on every cost chart, under API pricing too, where it says how to turn it on. */
  subscriptionPlans?: PlanOptions;
  anchor?: string;
  /** Default metric scale, when the chart supports switching to linear. */
  defaultScale?: "log" | "linear";
  /** Real-use data (T3 Code): hide points resting on fewer users. `floor` is the least the data publishes. */
  minUsers?: { value?: number; floor: number; onChange: (value: number | undefined) => void };
  dataSource?: { value: TaskMetricSource; options: { id: TaskMetricSource; name: string; modelCount: number }[]; onChange: (source: TaskMetricSource) => void };
  label: string; mode: "all" | "best"; onChange: (mode: "all" | "best") => void;
  /** Cost, time and speed charts: pick which reasoning efforts show, one by one, instead of the all/best dropdown. */
  efforts?: { value: string[]; onChange: (efforts: string[]) => void; /** Also show the best-or-all dropdown (the ranking list, which has both). */ withMode?: boolean };
  /** Model-age filter: ISO date cutoff; "" means all time. */
  releasedAfter?: string;
  onChangeReleased?: (value: string) => void;
  /** Model picker: ranked-order list + the index's excluded set. */
  models?: { id: string; name: string; color?: string; /** weights are downloadable; undefined when unknown */ open?: boolean; /** Lab name: gives the picker a checkbox per lab. */ lab?: string }[];
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
  const [open, setOpen] = useState(false), [tab, setTab] = useState<"models" | "data" | "display">(models.length && onToggleModel ? "models" : "data"), [query, setQuery] = useState(""), [formulaOpen, setFormulaOpen] = useState(false);
  const pal = useChartPalette(), gridOn = useChartGrid(pal);
  const adjustments = usePlanAdjustments();
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => { if (open) setFullscreen(!!root.current?.closest(".chart-expanded")); }, [open]);
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
  // Opening puts the models on the chart first, so none hides below a run of unticked ones.
  const [openOrder, setOpenOrder] = useState<string[]>([]);
  const place = useMemo(() => new Map(openOrder.map((id, i) => [id, i])), [openOrder]);
  const filtered = useMemo(() => models.filter(m => `${m.name} ${m.lab ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => (place.get(a.id) ?? 1e9) - (place.get(b.id) ?? 1e9)).sort((a, b) => Number(!!hl && isHighlighted(hl.items, b.id)) - Number(!!hl && isHighlighted(hl.items, a.id))), [models, query, hl, place]);
  const hasModels = !!onToggleModel && models.length > 0;
  // Ticking a box redraws every chart: the box answers now and the charts follow when they are ready.
  const [ticked, tick] = useOptimistic(excluded, (now, { ids, show }: { ids: string[]; show: boolean }) => { const next = new Set(now); for (const id of ids) if (show) next.delete(id); else next.add(id); return next; });
  const toggleTick = (id: string) => startTransition(() => { tick({ ids: [id], show: !!ticked?.has(id) }); onToggleModel?.(id); });
  const labRows = useMemo(() => { const by = new Map<string, { lab: string; color?: string; ids: string[] }>(); for (const m of models) if (m.lab) { const row = by.get(m.lab) ?? by.set(m.lab, { lab: m.lab, color: m.color, ids: [] }).get(m.lab)!; row.ids.push(m.id); } return [...by.values()]; }, [models]);
  const setLab = (ids: string[], on: boolean) => { const shown = new Set(models.map((m) => m.id).filter((id) => !ticked?.has(id))); for (const id of ids) if (on) shown.add(id); else shown.delete(id); startTransition(() => { tick({ ids, show: on }); onShowOnly?.([...shown]); }); };
  const modelPanel = <>
    <div className={styles.modelCount}><span>{models.filter(m => !ticked?.has(m.id)).length} of {models.length} selected</span>{onShowAllModels && <button type="button" onClick={onShowAllModels}>All</button>}{onHideAllModels && <button type="button" onClick={onHideAllModels}>None</button>}{onShowOnly && models.some((m) => m.open !== undefined) && <>
      <button type="button" onClick={() => onShowOnly(models.filter((m) => m.open === true).map((m) => m.id))} title="Show only models whose weights can be downloaded">Open</button>
      <button type="button" onClick={() => onShowOnly(models.filter((m) => m.open === false).map((m) => m.id))} title="Show only models with closed weights">Closed</button></>}</div>
    {onShowOnly && labRows.length > 1 && <details className={`${styles.sub} ${styles.labs}`}><summary>Labs<span>{labRows.filter(({ ids }) => ids.some((id) => !ticked?.has(id))).length} of {labRows.length} labs</span></summary><div className={styles.labRows} role="group" aria-label="Models by lab">{labRows.map(({ lab, color, ids }) => { const on = ids.filter((id) => !ticked?.has(id)).length; return <label key={lab}><input type="checkbox" checked={on === ids.length} ref={(el) => { if (el) el.indeterminate = on > 0 && on < ids.length; }} onChange={() => setLab(ids, on !== ids.length)} />{color && <i aria-hidden="true" style={{ background: color }} />}<span>{lab}</span></label>; })}</div></details>}
    <input type="search" className={styles.search} aria-label="Search models" placeholder="Search models" value={query} onChange={e => setQuery(e.target.value)} />
    <div className={styles.modelList}>{filtered.map(m => {
      const star = !!hl && isHighlighted(hl.items, m.id);
      return <div key={m.id} className={styles.model}><label><input type="checkbox" checked={!ticked?.has(m.id)} onChange={() => toggleTick(m.id)} />{m.color && <i aria-hidden="true" style={{ background: m.color }} />}<span>{m.name}</span></label>{hl && <button type="button" className={star ? styles.starred : undefined} aria-label={`${star ? "Unstar" : "Star"} ${m.name}`} aria-pressed={star} onClick={() => { if (!hl) return; if (!star && excluded?.has(m.id)) onToggleModel?.(m.id); hl.set(toggleModel(hl.items, m.id)); }}>{star ? <IconStarFilled size={15} aria-hidden="true" /> : <IconStar size={15} stroke={1.5} aria-hidden="true" />}</button>}</div>;
    })}{!filtered.length && <p>No matching models.</p>}</div>
  </>;
  const resets = costBasis?.value === "subscription" ? planResets : undefined;
  const plans = costBasis && subscriptionPlans?.labs.length ? subscriptionPlans : undefined;
  const check = (text: string, on: boolean, change: (on: boolean) => void, title?: string) => <label title={title}><span>{text}</span><input type="checkbox" checked={on} onChange={e => change(e.target.checked)} /></label>;
  const scatter = view && onView && view.kind !== "bars" ? { view, onView } : undefined;
  const resetsRow = resets && <div className={styles.checks}>
    {check("Count limit resets", resets.value, resets.onChange, resets.note)}
    {resets.value && resets.rows?.length ? <dl className={styles.resetRows}>{resets.rows.map((r) => <div key={r.lab}><dt>{r.lab}</dt><dd>{r.text}</dd></div>)}</dl> : <p className={styles.resetNote}>Credits plans for the extra usage labs gave subscribers in the last 30 days.</p>}
    {resets.value && resets.fable && <div className={styles.row}><label htmlFor={`${id}-fable-resets`} title="Claude's Fable 5.2 reset grant: Max and Ultra accounts got 1 under 6 months of paid use, 2 at 6 to 12 months, 3 past a year; Pro and standard Team got 1. Priors assumes 1.">Fable resets you hold</label><select id={`${id}-fable-resets`} value={resets.fable.value} onChange={(e) => resets.fable!.onChange(Number(e.target.value))}>{[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n === 1 ? "1 (assumed)" : n}</option>)}</select></div>}
  </div>;
  const free = costBasis?.value === "subscription" ? freeTiers : undefined;
  const FREE_CHOICES = [{ id: "generous", name: "Generous" }, { id: "limited", name: "Plus rate-limited" }, { id: "off", name: "None" }] as const;
  const freeRow = free && <div className={styles.checks}>
    <div className={`${styles.row} ${styles.stack}`}><span id={`${id}-free-label`}>Free tiers</span><div className={styles.choice} role="group" aria-labelledby={`${id}-free-label`}>{FREE_CHOICES.filter((c) => c.id !== "limited" || free.limited > 0).map((c) => <button key={c.id} type="button" aria-pressed={free.value === c.id} onClick={() => free.onChange(c.id)}>{c.name}</button>)}</div></div>
    <p className={styles.resetNote}>{free.value === "off" ? "Free models use their paid plans, or API price with none."
      : free.value === "limited" ? `${free.generous + free.limited} models cost nothing here, ${free.limited} of them on rate-limited free tiers (OpenRouter, Gemini API).`
      : `${free.generous} models are free in real volume today and cost nothing here.${free.limited ? ` ${free.limited} more are free only rate-limited, too little to count by default.` : ""}`}</p>
  </div>;
  const reading = costBasis?.value === "subscription" ? planReading : undefined, readingDefault = reading && reading.value === reading.options[0].id;
  const readingRow = reading && <PlanReadingSwitch reading={reading} />;
  const planSection = plans && costBasis && <PlanSection id={id} plans={plans} basis={costBasis} reading={reading} extra={[resets?.value && "resets on", free && free.value === "off" && "no free tiers", free && free.value === "limited" && "rate-limited free tiers", reading && !readingDefault && reading.options.find((r) => r.id === reading.value)?.name.toLowerCase()].filter(Boolean).join(", ") || undefined}>{freeRow}{resetsRow}</PlanSection>;
  const formulaSection = formula && view && onView && <details className={styles.sub} open={formulaOpen} onToggle={e => setFormulaOpen(e.currentTarget.open)}>
    <summary className="disclosure">Custom formula<span className={view.formula?.trim() ? styles.formulaOn : undefined}>{view.formula?.trim() || "Off"}</span></summary>
    {formulaOpen && <FormulaEditor id={id} label={label} formula={formula} view={view} onView={onView} />}
  </details>;
  const tierOn = speedTiers && speedTiers.value.some((t) => t !== "standard");
  const tierSection = speedTiers && <details className={styles.sub} open={tierOn || undefined}>
    <summary className="disclosure">Speed tiers<span>{SPEED_TIERS.filter((t) => speedTiers.value.includes(t.id)).map((t) => t.name).join(", ")}</span></summary>
    <div className={styles.effortRow} role="group" aria-label={`${label} speed tiers`}><div>{SPEED_TIERS.filter((t) => t.id === "standard" || speedTiers.rows.some((r) => r.tier === t.id)).map((t) => { const on = speedTiers.value.includes(t.id); return <button key={t.id} type="button" aria-pressed={on} onClick={() => { const next = SPEED_TIERS.map((x) => x.id).filter((x) => x === t.id ? !on : speedTiers.value.includes(x)); speedTiers.onChange(!next.length || (next.length === 1 && next[0] === "standard") ? undefined : next); }}>{t.name}</button>; })}</div></div>
    <dl className={styles.resetRows}>{speedTiers.rows.map((r) => <div key={r.tier}><dt>{r.name}</dt><dd>{r.text}</dd></div>)}</dl>
    <p className={styles.resetNote}>A tier replaces standard where a model has it. Keep Standard on to compare both.</p>
  </details>;
  const USER_STEPS = [25, 100, 500, 1000];
  const usersSection = minUsers && <details className={styles.sub} open={minUsers.value ? true : undefined}>
    <summary className="disclosure">Minimum users<span>{minUsers.value ? `${minUsers.value.toLocaleString("en-US")}+` : `Any (${minUsers.floor}+)`}</span></summary>
    <div className={styles.row}><label htmlFor={`${id}-min-users`}>Users behind each point</label><select aria-label={`${label} minimum users`} id={`${id}-min-users`} value={minUsers.value ?? ""} onChange={e => minUsers.onChange(e.target.value ? +e.target.value : undefined)}><option value="">Any ({minUsers.floor}+)</option>{USER_STEPS.map(n => <option key={n} value={n}>{n.toLocaleString("en-US")}+</option>)}</select></div>
    <p className={styles.resetNote}>T3 Code times come from real sessions. A model or effort few people use rests on a small sample and can be off by a lot.</p>
  </details>;
  const dataPanel = <>
    {(dataSource || onChangeReleased) && <div className={styles.dataControls}>
      {dataSource && <div className={styles.dataField}><label htmlFor={`${id}-source`}>Data source</label><select aria-label={`${label} data source`} id={`${id}-source`} value={dataSource.value} onChange={e => dataSource.onChange(e.target.value as TaskMetricSource)}>{dataSource.options.map(s => <option key={s.id} value={s.id}>{s.name} ({s.modelCount} models)</option>)}</select></div>}
      {onChangeReleased && <div className={styles.dataField}><label htmlFor={`${id}-release`}>Released</label><select aria-label={`${label} release window`} id={`${id}-release`} value={releaseValue} onChange={e => onChangeReleased?.(e.target.value === "all" ? "" : releaseDate(+e.target.value))}><option value="6">Last 6 months</option><option value="12">Last year</option><option value="24">Last 2 years</option><option value="all">All time</option>{releaseValue === "custom" && <option value="custom" disabled>Custom</option>}</select></div>}
    </div>}
    {costBasis && <div className={styles.row}><span id={`${id}-basis-label`}>Pricing</span><div className={styles.choice} role="group" aria-labelledby={`${id}-basis-label`}>{COST_BASES.map(b => <button key={b.id} type="button" aria-pressed={costBasis.value === b.id} onClick={() => costBasis.onChange(b.id)}>{b.name}</button>)}</div></div>}
    {efforts && <div className={styles.effortRow}><span id={`${id}-efforts-label`}>Reasoning effort</span><div role="group" aria-labelledby={`${id}-efforts-label`}>{EFFORT_CHOICES.map(e => { const on = efforts.value.includes(e); return <button key={e} type="button" aria-pressed={on} data-effort={e} title={e === "none" ? "Models run with no reasoning" : undefined} onClick={() => efforts.onChange(EFFORT_CHOICES.filter(x => x === e ? !on : efforts.value.includes(x)))}>{EFFORT_LABELS[e]}</button>; })}</div></div>}
    {(!efforts || efforts.withMode) && <div className={styles.row}><label htmlFor={`${id}-effort`}>{efforts ? "Show" : "Reasoning efforts"}</label><select aria-label={`${label} reasoning efforts`} id={`${id}-effort`} value={mode} onChange={e => onChange(e.target.value as "all" | "best")}><option value="all">All efforts</option><option value="best">Best per model</option></select></div>}
    {scatter && <div className={styles.checks}>{check("Include older models", !!scatter.view.allModels, on => scatter.onView({ ...scatter.view, allModels: on }), "Off: the frontier and each lab's current models only")}{check("Only Pareto-optimal models", !!scatter.view.paretoOnly, on => scatter.onView({ ...scatter.view, paretoOnly: on || undefined }), "Hides every model off the Pareto frontier. The frontier is worked out at the chart's pricing, so switching between API and subscription pricing can change which models stay.")}</div>}
    {!plans && readingRow}
    {!plans && freeRow}
    {!plans && resetsRow}
    {(tierSection || planSection || formulaSection || usersSection) && <div className={styles.sections}>{tierSection}{usersSection}{planSection}{formulaSection}</div>}
  </>;
  const displayPanel = view && onView && <>
    {defaultScale && scatter && <div className={styles.row}><span id={`${id}-scale-label`}>Scale</span><div className={styles.choice} role="group" aria-labelledby={`${id}-scale-label`}>{(["log", "linear"] as const).map(value => <button key={value} type="button" aria-pressed={(scatter.view.scale ?? defaultScale) === value} onClick={() => scatter.onView({ ...scatter.view, scale: value })}>{value === "log" ? "Log" : "Linear"}</button>)}</div></div>}
    <div className={styles.checks}>
      {scatter && check("Pareto frontier", scatter.view.frontier, on => scatter.onView({ ...scatter.view, frontier: on, frontierChosen: true }))}
      {scatter && check("Lines between efforts", scatter.view.links, on => scatter.onView({ ...scatter.view, links: on }))}
      {scatter && !!hl?.items.length && check("Highlight guides", scatter.view.guides !== false, on => scatter.onView({ ...scatter.view, guides: on }))}
      {check("Background grid", gridOn, on => setChartGridPref(on, pal))}
    </div>
    {scatter && <div className={styles.labels}><div><label htmlFor={`${id}-density`}>Model names</label><span>{scatter.view.density === 0 ? "Frontier only" : scatter.view.density === 1 ? "All" : `${Math.round(scatter.view.density * 100)}%`}</span></div><input aria-label={`${label} label density`} id={`${id}-density`} type="range" min={0} max={100} step={5} value={Math.round(scatter.view.density * 100)} onChange={e => scatter.onView({ ...scatter.view, density: +e.target.value / 100 })} /></div>}
    <div className={styles.labels}><div><label htmlFor={`${id}-label-size`}>Name size</label><span>{Math.round(labelScale(view.labelScale) * 100)}%</span></div><input aria-label={`${label} label size`} id={`${id}-label-size`} type="range" min={75} max={fullscreen ? 300 : 200} step={5} value={Math.round(labelScale(view.labelScale) * 100)} onChange={e => {
      const ls = +e.target.value;
      onView({ ...view, labelScale: ls / 100 });
      if (anchor) {
        const url = chartLinkUrl(window.location.href, anchor, { cv: view.kind, cm: mode, cs: view.kind !== "bars" ? view.scale ?? defaultScale : undefined, ls }, hl ?? undefined);
        window.history.replaceState(window.history.state, "", url.toString());
      }
    }} /></div>
    {scatter && ([["dotScale", "Dot size", `${label} dot size`], ["lineScale", "Line width", `${label} line width`]] as const).map(([key, name, aria]) => { const v = Math.round((scatter.view[key] ?? 1) * 100); return <div key={key} className={styles.labels}><div><label htmlFor={`${id}-${key}`}>{name}</label><span>{v}%</span></div><input aria-label={aria} id={`${id}-${key}`} type="range" min={50} max={fullscreen ? 300 : 200} step={10} value={v} onChange={e => scatter.onView({ ...scatter.view, [key]: +e.target.value / 100 })} /></div>; })}
  </>;
  /** The composer's view of this chart: its settings and the data it can change, as plain lines for the agent. */
  const agentContext = () => {
    const lines = [`Chart: ${label}${fullscreen ? " (full screen)" : ""}`];
    if (view) lines.push(`View: ${JSON.stringify({ kind: view.kind ?? "scatter", labelScale: view.labelScale ?? 1, dotScale: view.dotScale ?? 1, lineScale: view.lineScale ?? 1, density: view.density, frontier: view.frontier, links: view.links, scale: view.scale ?? defaultScale, allModels: !!view.allModels, paretoOnly: !!view.paretoOnly })}`);
    lines.push(`Showing: ${mode === "all" ? "all efforts" : "best effort per model"}${efforts ? `; efforts on: ${efforts.value.join(", ")}` : ""}${releasedAfter !== undefined ? `; released after: ${releasedAfter || "all time"}` : ""}`);
    if (costBasis) lines.push(`Pricing: ${costBasis.value}`);
    if (dataSource) lines.push(`Data source: ${dataSource.value} (options: ${dataSource.options.map((o) => o.id).join(", ")})`);
    if (freeTiers) lines.push(`Free tiers: ${freeTiers.value}`);
    if (planResets) lines.push(`Limit resets counted: ${planResets.value}`);
    if (planReading) lines.push(`Plan reading for ${planReading.models.map((m) => m.name).join(", ")}: ${planReading.value} (options: ${planReading.options.map((o) => `${o.id} = ${o.name}`).join(", ")})`);
    if (subscriptionPlans) lines.push("Plans by lab (id: plan · fee · API value per dollar ≈ API value a month; * = picked):", ...subscriptionPlans.labs.map((l) => `- ${l.labId} (${l.name}), now ${subscriptionPlans.value[l.labId] ? `${subscriptionPlans.value[l.labId]}*` : l.median.map((m) => m.plan).join(" / ") || "none"}: ${l.plans.map((p) => { const m = p.multiple; return `${p.plan}${p.feeUsd ? ` · $${p.feeUsd}/mo` : ""}${m ? ` · ${m.toFixed(1)}x ≈ $${Math.round(m * (p.feeUsd ?? 0)).toLocaleString("en-US")}/mo` : ""}`; }).join("; ")}`));
    if (models.length) lines.push(`Models (id | name | lab | shown): ${models.map((m) => `${m.id} | ${m.name} | ${m.lab ?? ""} | ${excluded?.has(m.id) ? "hidden" : "shown"}`).join("; ")}`);
    if (adjustments.length) lines.push(`Data adjustments already on: ${JSON.stringify(adjustments)}`);
    return lines.join("\n");
  };
  const applyAgent = (c: ChartChanges) => {
    if (c.view && view && onView) { const clamp = (v: number | undefined, lo: number, hi: number) => v == null ? undefined : Math.min(hi, Math.max(lo, v)); const next = { ...view, ...c.view }; onView({ ...next, labelScale: clamp(next.labelScale, 0.75, 3), dotScale: clamp(next.dotScale, 0.5, 3), lineScale: clamp(next.lineScale, 0.5, 3), density: clamp(next.density, 0, 1) ?? view.density, ...(c.view.frontier !== undefined ? { frontierChosen: true } : {}), ...(c.view.kind ? { kindChosen: true } : {}) }); }
    const st = c.settings ?? {};
    if (st.costBasis && costBasis) costBasis.onChange(st.costBasis);
    if (st.efforts && efforts) efforts.onChange(EFFORT_CHOICES.filter((e) => st.efforts!.includes(e)));
    if (st.mode) onChange(st.mode);
    if (st.releasedAfter !== undefined && onChangeReleased) onChangeReleased(st.releasedAfter);
    if (st.dataSource && dataSource?.options.some((o) => o.id === st.dataSource)) dataSource.onChange(st.dataSource as TaskMetricSource);
    if (st.freeTiers && freeTiers) freeTiers.onChange(st.freeTiers);
    if (st.planResets !== undefined && planResets) planResets.onChange(st.planResets);
    if (st.planReading && planReading?.options.some((o) => o.id === st.planReading)) planReading.onChange(st.planReading);
    for (const p of c.plans ?? []) subscriptionPlans?.onChange(p.lab, p.plan ?? undefined);
    const known = new Set(models.map((m) => m.id));
    if (c.models?.showOnly?.length && onShowOnly) onShowOnly(c.models.showOnly.filter((m) => known.has(m)));
    for (const m of c.models?.hide ?? []) if (known.has(m) && !excluded?.has(m)) onToggleModel?.(m);
    for (const m of c.models?.show ?? []) if (known.has(m) && excluded?.has(m)) onToggleModel?.(m);
  };
  const tabs = [hasModels && { id: "models" as const, name: "Models" }, { id: "data" as const, name: "Data" }, displayPanel && { id: "display" as const, name: "Display" }].filter((t): t is { id: "models" | "data" | "display"; name: string } => !!t);
  const tabKey = (event: KeyboardEvent, current: number) => {
    const next = event.key === "ArrowRight" ? (current + 1) % tabs.length : event.key === "ArrowLeft" ? (current - 1 + tabs.length) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    setTab(tabs[next].id); document.getElementById(`${id}-${tabs[next].id}-tab`)?.focus();
  };
  return <details ref={root} open={open} className={styles.picker} name="chart-settings">
    <summary ref={trigger} aria-label={`${label} settings`} title={`${label} settings`} onClick={e => { e.preventDefault(); if (!open) { setTab(hasModels ? "models" : "data"); setOpenOrder([...models.filter(m => !excluded?.has(m.id)), ...models.filter(m => excluded?.has(m.id))].map(m => m.id)); } setOpen(!open); }}><IconAdjustmentsHorizontal size={16} stroke={1.5} aria-hidden="true" /></summary>
    {/* Built only while open: every chart has one of these, and a closed menu's model list was most of a page's DOM. */}
    {open && <div className={`${styles.menu} chart-settings-menu`} data-above={placement.above} style={{ "--picker-space": `${placement.height}px` } as CSSProperties}>
      <div className={styles.heading}><span>Chart settings</span><button type="button" aria-label="Close chart settings" onClick={() => dismiss("escape")}><IconX size={16} stroke={1.5} aria-hidden="true" /></button></div>
      {tabs.length > 1 && <div className={styles.tabs} role="tablist" aria-label={`${label} settings sections`}>
        {tabs.map((t, i) => <button key={t.id} id={`${id}-${t.id}-tab`} role="tab" type="button" aria-selected={tab === t.id} aria-controls={`${id}-${t.id}-panel`} tabIndex={tab === t.id ? 0 : -1} onKeyDown={e => tabKey(e, i)} onClick={() => setTab(t.id)}>{t.name}</button>)}
      </div>}
      <div className={styles.body} role={tabs.length > 1 ? "tabpanel" : "region"} id={`${id}-${tab}-panel`} aria-labelledby={tabs.length > 1 ? `${id}-${tab}-tab` : undefined} aria-label={tabs.length > 1 ? undefined : `${label} settings`}>{tab === "models" && hasModels ? modelPanel : tab === "display" && displayPanel ? displayPanel : dataPanel}</div>
      <ChartComposer label={label} context={agentContext} apply={applyAgent} />
    </div>}
  </details>;
}
