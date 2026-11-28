"use client";
import "./results-table.css";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import { IconArrowsSort, IconChartBar, IconChevronDown, IconCoin, IconReceipt, IconRocket, IconRoute, IconSearch, IconSortAscending, IconSortDescending, IconStar, IconStarFilled, IconStopwatch, IconTerminal2, IconTextSize, IconX } from "@tabler/icons-react";
import type { Benchmark, Lab, Observation } from "@/data/types";
import type { RankedVariant } from "@/engine";
import type { CostBasis } from "@/data/subscription";
import type { BenchMetric } from "@/lib/benchmark-metrics";
import { axisPct, bestOf, buildResults, cycleSort, groupModels, isRank, matchesName, notches, scoreAxis, searchGroups, sortGroups, tickText, RANK, type Axis, type Group, type Measure, type MeasureKey, type ResultsModel, type Row, type Sort, type SortKey } from "@/lib/benchmark-results";
import { LabLogo } from "../LabLogo";
import { useLabColor } from "../chart/echarts";
import { isHighlighted, toggleModel, useHighlight } from "../chart/highlight";
import { GlideList } from "./GlideList";

/** Models shown before "Show all". */
const FIRST = 25;
/** Below this section width a row is two lines and the opened detail is stacked. */
const COMPACT_BELOW = 760;
/** The width of one extra measure's column inside an opened model. */
const SUB_COL = 66;

const ICONS: Record<MeasureKey, typeof IconCoin> = { cost: IconCoin, api: IconReceipt, steps: IconRoute, durationSec: IconStopwatch, outputTokens: IconTextSize };

type Props = { table: RankedVariant[]; b: Benchmark; hasCost: boolean; basis: CostBasis; apiObs: Map<string, Observation>; ci: boolean; harness: boolean; standard: BenchMetric[]; labs: Lab[] };

/** The benchmark page's "All results": one row per model with its other efforts as notches on the score bar, and a chevron that opens every effort with every column. */
export const ResultsTable = memo(function ResultsTable({ table, b, hasCost, basis, apiObs, ci, harness, standard, labs }: Props) {
  const m = useMemo(() => buildResults({ table, b, hasCost, basis, apiObs, ci, harness, standard }), [table, b, hasCost, basis, apiObs, ci, harness, standard]);
  const groups = useMemo(() => groupModels(m.rows), [m.rows]);
  const sectionRef = useRef<HTMLElement>(null), searchRef = useRef<HTMLInputElement>(null);
  const compact = useCompact(sectionRef);
  useSlash(sectionRef, searchRef);

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>(RANK);
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const [active, setActive] = useState<string>();

  const found = useMemo(() => searchGroups(groups, q), [groups, q]);
  const sorted = useMemo(() => sortGroups(found, sort), [found, sort]);
  const searching = q.trim().length > 0, cut = !searching && !all && sorted.length > FIRST;
  const shown = useMemo(() => cut ? sorted.slice(0, FIRST) : sorted, [sorted, cut]);
  const view = useResultsView(m, groups, labs, b);

  const expandable = useCallback((g: Group) => g.rows.length > 1 || m.measures.length > 0 || m.harnessVaries, [m]);
  const openable = useMemo(() => shown.filter(expandable).map((g) => g.id), [shown, expandable]);
  const allOpen = openable.length > 0 && openable.every((id) => open.has(id));
  const few = m.rows.length <= 8, multi = groups.some((g) => g.rows.length > 1);
  // On a phone one model is open at a time, so the list never turns into a wall of numbers.
  const toggle = useCallback((id: string) => setOpen((o) => { const next = compact ? new Set<string>() : new Set(o); if (o.has(id)) next.delete(id); else next.add(id); return next; }), [compact]);
  // A search that matched on an effort ("xhigh") opens those models so the match is visible.
  const search = (s: string) => {
    setQ(s);
    if (!s.trim()) return;
    const ids = groups.filter((g) => searchGroups([g], s).length && !matchesName(g, s)).map((g) => g.id);
    if (ids.length) setOpen(new Set(ids));
  };

  const hl = useHighlight();
  const hlRef = useRef(hl);
  useEffect(() => { hlRef.current = hl; });
  const star = useCallback((id: string) => { const h = hlRef.current; if (h) h.set(toggleModel(h.items, id)); }, []);
  const canStar = !!hl && !compact;
  const items = hl?.items;

  const ids = useMemo(() => shown.map((g) => g.id), [shown]);
  const current = active && ids.includes(active) ? active : ids[0];
  const onListKey = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const rows = [...e.currentTarget.querySelectorAll<HTMLElement>("[data-nav]")].filter((el) => !el.closest("[data-gone]"));
    const i = rows.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    const next = e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : rows.length - 1;
    rows[Math.max(0, Math.min(rows.length - 1, next))]?.focus();
  }, []);

  const costM = m.measures.find((x) => x.key === "cost");
  const expandAll = !few && multi ? <button type="button" className="results-ic hit" aria-label={allOpen ? "Collapse all" : "Expand all"} title={allOpen ? "Collapse all" : "Expand all"} onClick={() => setOpen(allOpen ? new Set() : new Set(openable))}><Chevron open={allOpen} /></button> : null;
  const sortMenu = !few && m.measures.length > 0 ? <SortMenu sort={sort} setSort={setSort} options={sortOptions(m.measures)} /> : null;
  const searchBox = few ? null : <SearchBox q={q} setQ={search} inputRef={searchRef} />;
  const count = <Count harness={m.harnessConst} text={found.length === groups.length ? `${groups.length} models` : `${found.length} of ${groups.length}`} />;
  const headSort = (key: "score" | "cost", label: string) => few
    ? <span className="cap results-hd-plain">{label}</span>
    : <button type="button" className="results-hb" data-on={(key === "score" ? sort.key === "score" : sort.key === key) ? "" : undefined} data-rev={sort.key === key && sort.rev ? "" : undefined} title={`Sort by ${label}`} onClick={() => setSort(cycleSort(sort, key))}>{label}<IconChevronDown size={12} stroke={2} aria-hidden="true" /></button>;

  return <section ref={sectionRef} className="grid gap-3 results" data-compact={compact ? "" : undefined}>
    <div className="results-head">
      <h2 className="text-[22px] sm:text-[26px]">All results</h2>
      <div className="results-tools">{!compact && <>{sortMenu}{searchBox}</>}{count}</div>
    </div>
    {compact && !few && <div className="results-ctl">{searchBox}{sortMenu}{expandAll}</div>}
    {!shown.length ? <p className="cap results-empty" role="status">No results</p> : <div onKeyDown={onListKey} style={{ ["--cols" as string]: view.cols }}>
      {!compact && <div className="results-hd">
        <span className="cap results-hd-rank">#</span><span className="cap">Model</span>
        {view.brk ? <div className="results-axis" aria-hidden="true">{view.axis.ticks.map((t) => { const x = Math.max(0, Math.min(1, view.axis.pos(t))) * 100; return <span key={t} className="results-tick" style={{ left: `${x}%`, translate: `-${x}% -50%` }}>{tickText(b, t)}</span>; })}</div> : <span />}
        {headSort("score", "Score")}{costM && headSort("cost", costM.label)}
        <span className="results-hd-end">{expandAll}</span>
      </div>}
      <GlideList items={shown} est={compact ? 62 : 36} label="Models"
        render={(g) => {
          const ex = expandable(g), isOpen = ex && open.has(g.id);
          return compact
            ? <PhoneRow g={g} view={view} open={isOpen} expandable={ex} tabbable={g.id === current} onActive={setActive} onToggle={toggle} />
            : <DesktopRow g={g} view={view} open={isOpen} expandable={ex} tabbable={g.id === current} starred={canStar && !!items && isHighlighted(items, g.id)} canStar={canStar} onActive={setActive} onToggle={toggle} onStar={star} />;
        }} />
    </div>}
    {!searching && sorted.length > FIRST && <button type="button" className="btn-quiet justify-self-start" onClick={() => setAll((v) => !v)}>{all ? "Show fewer" : `Show all ${groups.length}`}</button>}
  </section>;
});

/* ---------- what every row of the list shares ---------- */

type View = {
  m: ResultsModel; axis: Axis; brk: boolean; cols: string; subCols: string;
  hasCost: boolean; costM?: Measure; extra: Measure[];
  /** A model's chart color (lab color under the page's palette) and the lab's own color for its logo. */
  barColor: (labId: string) => string | undefined; labColor: (labId: string) => string | undefined;
  b: Benchmark;
};

/** Derived once per data change, so opening a row or hovering a notch re-renders nothing but that row. */
function useResultsView(m: ResultsModel, groups: Group[], labs: Lab[], b: Benchmark): View {
  const colorOf = useLabColor();
  return useMemo(() => {
    const axis = scoreAxis(groups.slice(0, 30).map((g) => g.best), b, m.flip);
    const costM = m.measures.find((x) => x.key === "cost");
    const extra = m.measures.filter((x) => x.key !== "cost");
    const raw = new Map(labs.map((l) => [l.id, l.color]));
    const cols = ["44px", "minmax(170px, 240px)", "minmax(200px, 1fr)", m.hasInterval ? "92px" : "72px", ...(costM ? ["64px"] : []), "24px"].join(" ");
    return {
      m, axis, brk: axis.lo !== 0, cols, subCols: `minmax(0, 1fr) ${extra.map(() => `${SUB_COL}px`).join(" ")}`,
      hasCost: !!costM, costM, extra, b,
      barColor: (id) => colorOf(id, raw.get(id)), labColor: (id) => raw.get(id),
    };
  }, [m, groups, labs, b, colorOf]);
}

/** True while the section is narrower than a two-column table needs. Only crossing the line re-renders. */
function useCompact(ref: RefObject<HTMLElement | null>) {
  const [compact, setCompact] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const set = (w: number) => setCompact(w < COMPACT_BELOW);
    set(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([e]) => set(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return compact;
}

/** "/" jumps to the search box while the section is on screen. */
function useSlash(section: RefObject<HTMLElement | null>, input: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
      const el = section.current, inp = input.current; if (!el || !inp) return;
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      e.preventDefault(); inp.focus();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [section, input]);
}

/* ---------- head: search, sort, count ---------- */

function Count({ harness, text }: { harness?: string; text: string }) {
  return <span className="cap results-count">{harness && <><IconTerminal2 size={12} stroke={1.6} aria-hidden="true" style={{ flex: "none" }} /><span className="results-trunc" title={harness}>{harness}</span><span aria-hidden="true">·</span></>}<span>{text}</span></span>;
}

function SearchBox({ q, setQ, inputRef }: { q: string; setQ: (v: string) => void; inputRef: RefObject<HTMLInputElement | null> }) {
  return <label className="results-search">
    <IconSearch size={15} stroke={1.6} aria-hidden="true" />
    <input ref={inputRef} type="text" inputMode="search" autoComplete="off" spellCheck={false} className="inp" aria-label="Search results" placeholder="Search" value={q}
      onChange={(e) => setQ(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Escape") { setQ(""); e.currentTarget.blur(); } }} />
    {q && <button type="button" aria-label="Clear search" onClick={() => { setQ(""); inputRef.current?.focus(); }}><IconX size={14} stroke={1.6} /></button>}
  </label>;
}

type SortOption = { key: SortKey; label: string; icon: typeof IconCoin };
const sortOptions = (measures: Measure[]): SortOption[] => [{ key: "score", label: "Score", icon: IconChartBar }, ...measures.map((x) => ({ key: x.key as SortKey, label: x.label, icon: ICONS[x.key] }))];

/** One sort icon that opens a short list of what to order by; choosing the current one again reverses it. */
function SortMenu({ sort, setSort, options }: { sort: Sort; setSort: (s: Sort) => void; options: SortOption[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", down); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
  }, [open]);
  return <div ref={ref} className="results-menuwrap">
    <button ref={trigger} type="button" className="results-ic hit" aria-haspopup="menu" aria-expanded={open} data-active={!isRank(sort) ? "" : undefined} aria-label="Sort" title="Sort" onClick={() => setOpen((o) => !o)}><IconArrowsSort size={18} stroke={1.6} /></button>
    {open && <div className="results-menu" role="menu" aria-label="Sort by">{options.map((o) => {
      const on = sort.key === o.key, Icon = o.icon;
      return <button key={o.key} type="button" role="menuitemradio" aria-checked={on} onClick={() => { setSort(on ? { key: o.key, rev: !sort.rev } : { key: o.key, rev: false }); setOpen(false); trigger.current?.focus(); }}>
        <Icon size={16} stroke={1.6} aria-hidden="true" /><span>{o.label}</span>
        <span className="results-mdir" aria-hidden="true">{on && (sort.rev ? <IconSortAscending size={15} stroke={1.6} /> : <IconSortDescending size={15} stroke={1.6} />)}</span>
      </button>;
    })}</div>}
  </div>;
}

/* ---------- parts of a row ---------- */

function Chevron({ open }: { open?: boolean }) {
  return <span className="results-chev" data-open={open ? "" : undefined} aria-hidden="true"><IconChevronDown size={16} stroke={2} /></span>;
}

/** The expand button at the end of a row. The row's own click and Enter do the same, so it stays out of the tab order. */
function Expander({ g, open, onToggle }: { g: Group; open: boolean; onToggle: (id: string) => void }) {
  return <button type="button" tabIndex={-1} className="results-xp hit" aria-expanded={open} aria-label={`Every result of ${g.best.name}`} onClick={() => onToggle(g.id)}><Chevron open={open} /></button>;
}

function Who({ g, view, tabbable }: { g: Group; view: View; tabbable: boolean }) {
  const r = g.best;
  return <span className="results-who">
    <LabLogo lab={r.labId} name={r.name} size={16} color={view.labColor(r.labId)} />
    <Link href={`/models/${r.modelId}` as "/"} tabIndex={tabbable ? 0 : -1} className="results-name" title={r.name} onClick={(e) => e.stopPropagation()}>{r.name}</Link>
    {r.launch && <Launch />}
  </span>;
}
const Launch = () => <span className="results-launch" title="Launch claim: the lab's own figure, until this benchmark scores the model" data-launch-claim><IconRocket size={12} stroke={1.6} aria-label="Launch claim" /></span>;

/** A model's bar: its best effort filled, its other efforts as notches. Hovering a notch names it (state is this bar's own). */
function ModelBar({ g, view }: { g: Group; view: View }) {
  const [hover, setHover] = useState<{ x: number; text: string } | null>(null);
  const { axis, brk } = view;
  return <span className="results-bw" aria-hidden="true">
    <span className="results-bar" data-break={brk ? "" : undefined}>
      <i style={{ width: `${axisPct(axis, g.best.score)}%`, background: view.barColor(g.best.labId) }} />
      {notches(g, axis).map(({ row, x }) => <u key={row.id} style={{ left: `${x}%` }} onPointerEnter={() => setHover({ x, text: `${row.effortLabel} ${row.text}` })} onPointerLeave={() => setHover(null)} />)}
    </span>
    {hover && <span className="cap results-nc" style={{ left: `clamp(34px, ${hover.x}%, calc(100% - 34px))` }}>{hover.text}</span>}
  </span>;
}

const Score = ({ r }: { r: Row }) => <>{r.text}{r.half != null && <span className="results-half"> ±{r.half}</span>}</>;

type RowProps = { g: Group; view: View; open: boolean; expandable: boolean; tabbable: boolean; onActive: (id: string) => void; onToggle: (id: string) => void };

/** Roving focus: the row is the tab stop, Enter opens it, Space highlights the model in the charts. */
function rowProps(p: RowProps, onSpace?: () => void) {
  const { g, tabbable, expandable, onActive, onToggle } = p;
  return {
    role: "group" as const, "aria-label": g.best.name, "data-nav": g.id, tabIndex: tabbable ? 0 : -1, "data-open": p.open ? "" : undefined,
    onFocus: (e: React.FocusEvent) => { if (e.target === e.currentTarget) onActive(g.id); },
    onClick: (e: React.MouseEvent) => { if (expandable && !(e.target as HTMLElement).closest("button,a")) onToggle(g.id); },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" && expandable) { e.preventDefault(); onToggle(g.id); }
      else if (e.key === " " && onSpace) { e.preventDefault(); onSpace(); }
    },
  };
}

const DesktopRow = memo(function DesktopRow(p: RowProps & { starred: boolean; canStar: boolean; onStar: (id: string) => void }) {
  const { g, view, open, expandable, starred, canStar, onStar, onToggle } = p, r = g.best;
  return <>
    <div className="results-row" data-expandable={expandable ? "" : undefined} {...rowProps(p, canStar ? () => onStar(g.id) : undefined)}>
      <span className="results-rank">
        {canStar && <button type="button" tabIndex={-1} className="results-star" aria-pressed={starred} aria-label={`Highlight ${r.name} in the charts`} title="Highlight in the charts" onClick={() => onStar(g.id)}>{starred ? <IconStarFilled size={14} /> : <IconStar size={14} stroke={1.6} />}</button>}
        <span className="results-rn num">{g.rank}</span>
      </span>
      <Who g={g} view={view} tabbable={p.tabbable} />
      <ModelBar g={g} view={view} />
      <span className="results-n results-score" title={r.intervalTitle ?? r.note}><Score r={r} /></span>
      {view.costM && <span className="results-n" title={r.planTitle}>{r.v.cost != null ? view.costM.fmt(r.v.cost) : ""}</span>}
      <span className="results-end">{expandable && <Expander g={g} open={open} onToggle={onToggle} />}</span>
    </div>
    {expandable && <Fold open={open}><DesktopPanel g={g} view={view} /></Fold>}
  </>;
});

const PhoneRow = memo(function PhoneRow(p: RowProps) {
  const { g, view, open, expandable, onToggle } = p, r = g.best;
  return <>
    <div className="results-prow" data-expandable={expandable ? "" : undefined} {...rowProps(p)}>
      <span className="results-pn">{g.rank}</span>
      <Who g={g} view={view} tabbable={p.tabbable} />
      <span className="num results-score" title={r.intervalTitle ?? r.note}><Score r={r} /></span>
      <span className="results-end">{expandable && <Expander g={g} open={open} onToggle={onToggle} />}</span>
      <div className="results-pline"><ModelBar g={g} view={view} />{view.costM && <span className="num results-pcost" title={r.planTitle}>{r.v.cost != null ? view.costM.fmt(r.v.cost) : ""}</span>}</div>
    </div>
    {expandable && <Fold open={open}><PhonePanel g={g} view={view} /></Fold>}
  </>;
});

/** Opens and closes by animating the row height. Its contents exist only while open (and while closing), so a long list carries no hidden detail. */
function Fold({ open, children }: { open: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    if (open) return;
    const t = window.setTimeout(() => setMounted(false), 260);
    return () => window.clearTimeout(t);
  }, [open]);
  if (!mounted) return null;
  return <div className="results-fold" data-open={open ? "" : undefined}><div>{children}</div></div>;
}

/** Every effort of a model on the table's own columns: its bar, then each extra measure, score and cost. */
function DesktopPanel({ g, view }: { g: Group; view: View }) {
  const { m, extra, costM, axis, brk } = view;
  const harnesses = m.harnessVaries ? [...new Set(g.rows.map((r) => r.harness).filter(Boolean))] : [];
  return <div className="results-subpad">
    {extra.length > 0 && <div className="results-subrow results-subhd cap" aria-hidden="true"><span /><span />
      <span className="results-subcell" style={{ gridTemplateColumns: view.subCols }}><span />{extra.map((x) => <span key={x.key} className="results-right">{x.label}</span>)}</span></div>}
    {g.rows.map((r) => <div key={r.id} className="results-subrow">
      <span />
      <span className="cap results-subeff">{r.effortLabel}{r.launch && <Launch />}</span>
      <span className="results-subcell" style={{ gridTemplateColumns: view.subCols }}>
        <span className="results-bar results-bar-thin" data-break={brk ? "" : undefined}><i style={{ width: `${axisPct(axis, r.score)}%`, background: view.barColor(r.labId) }} /></span>
        {extra.map((x) => <span key={x.key} className="results-n" data-grey={x.key === "api" ? "" : undefined} data-best={r.v[x.key] != null && bestOf(g, x.key, m.flip) === r.v[x.key] ? "" : undefined}>{r.v[x.key] != null ? x.fmt(r.v[x.key]!) : ""}</span>)}
      </span>
      <span className="results-n" data-best={bestOf(g, "score", m.flip) === r.score ? "" : undefined} title={r.intervalTitle ?? r.note}><Score r={r} /></span>
      {costM && <span className="results-n" data-best={r.v.cost != null && bestOf(g, "cost", m.flip) === r.v.cost ? "" : undefined} title={r.planTitle}>{r.v.cost != null ? costM.fmt(r.v.cost) : ""}</span>}
      <span />
    </div>)}
    {harnesses.length > 0 && <div className="results-subrow"><span /><span className="cap results-subeff">{harnesses.join(", ")}</span></div>}
  </div>;
}

/** On a phone each effort is a line of score then every measure as icon and value. */
function PhonePanel({ g, view }: { g: Group; view: View }) {
  const { m } = view;
  return <div className="results-psub">{g.rows.map((r) => <div key={r.id}>
    <div className="results-l1"><span className="cap results-peff">{r.effortLabel}</span><span className="num results-pscore" title={r.intervalTitle ?? r.note}>{r.text}</span>{r.half != null && <span className="cap">±{r.half}</span>}{r.launch && <Launch />}</div>
    <div className="results-meas">{m.measures.map((x) => <Measured key={x.key} meas={x} row={r} />)}{m.harnessVaries && r.harness && <span className="results-mi">{r.harness}</span>}</div>
  </div>)}</div>;
}

function Measured({ meas, row }: { meas: Measure; row: Row }) {
  const v = row.v[meas.key];
  if (v == null) return null;
  const Icon = ICONS[meas.key];
  return <span className="results-mi" title={meas.name}><Icon size={13} stroke={1.6} aria-hidden="true" /><span>{meas.fmt(v)}</span></span>;
}
