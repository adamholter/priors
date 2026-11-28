"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import type { Lab, Snapshot } from "@/data/types";
import type { Mark, Summary } from "@/lib/metric-summary";
import { useHashTarget } from "../chart/ChartLink";
import { Logo, MetricLabs, StrengthsThumb, strengthNames, Thumb } from "./MetricThumb";
import "./metric-sheet.css";

/** One metric of More metrics, built by MetricGallery: `body` is the real chart, so a card opens the same chart the list always did. */
export interface MetricRow { key: string; id: string; title: string; desc: string; anchor: string; defaultOpen: boolean; body: ReactNode }

/** Narrowest a card gets, the gap between cards, and the grid width under which the cards become answer rows. */
const MIN = 300, GAP = 24, PHONE = 560, THUMB_H = 104;

/* ---------- small hooks ---------- */

/** Width of an element, measured before the first paint so a layout that depends on it never flashes. */
function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(Math.round(el.getBoundingClientRect().width));
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** After a chart opens, bring it into view only when it is not already (header below the middle of the screen, or the chart cut off at the bottom). */
function ensureVisible(head: HTMLElement | null | undefined, body?: HTMLElement | null) {
  if (!head) return;
  const vh = window.innerHeight, top = head.getBoundingClientRect().top, b = body?.getBoundingClientRect();
  const cut = !!b && b.bottom > vh - 8 && b.bottom - top <= vh - 80 && top > 80;
  if (top > vh * 0.55 || top < 60 || cut) head.scrollIntoView({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" });
}

/** Opens a row when the page address points at its chart (`#latency`). */
function Hash({ anchor, onHit }: { anchor: string; onHit: () => void }) {
  const ref = useRef(onHit);
  useEffect(() => { ref.current = onHit; });
  useHashTarget(anchor, () => ref.current());
  return null;
}

/** Which charts are open and which description is showing. A row whose key changes (the owner's saved defaults) starts from its default again. */
function useOpenRows(rows: MetricRow[]) {
  const keys = rows.map((r) => r.key).join("|");
  const defaults = () => Object.fromEntries(rows.filter((r) => r.defaultOpen).map((r) => [r.key, true]));
  const [open, setOpen] = useState<Record<string, boolean>>(defaults);
  const [seen, setSeen] = useState(keys);
  if (seen !== keys) { setSeen(keys); setOpen(defaults()); }
  const [desc, setDesc] = useState<string | null>(null);
  const set = useCallback((r: MetricRow, v: boolean) => setOpen((o) => ({ ...o, [r.key]: v })), []);
  const isOpen = useCallback((r: MetricRow) => !!open[r.key], [open]);
  const toggle = useCallback((r: MetricRow) => setOpen((o) => ({ ...o, [r.key]: !o[r.key] })), []);
  const toggleDesc = useCallback((id: string) => setDesc((d) => d === id ? null : id), []);
  const showDesc = useCallback((id: string) => setDesc(id), []);
  return useMemo(() => ({ isOpen, set, toggle, desc, toggleDesc, showDesc }), [isOpen, set, toggle, desc, toggleDesc, showDesc]);
}
type OpenRows = ReturnType<typeof useOpenRows>;

/** Escape closes the open description and puts focus back on its glyph. */
/** After a chart closes from inside itself, focus goes to its card (or row) so a keyboard user keeps their place. */
function focusHit(root: RefObject<HTMLElement | null>, id: string) {
  requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`.cs-hit[data-row="${id}"]`)?.focus());
}

function useEscapeDesc(api: OpenRows, root: RefObject<HTMLElement | null>) {
  const id = api.desc, toggleDesc = api.toggleDesc;
  useEffect(() => {
    if (!id) return;
    const h = (e: globalThis.KeyboardEvent) => {
      // Leave Escape to whatever else is using it: a chart popover, a menu, a field.
      if (e.key !== "Escape" || e.defaultPrevented || (e.target as Element | null)?.closest?.("input, textarea, select, [role=dialog], [role=menu], [role=listbox], [aria-modal=true], [popover]")) return;
      toggleDesc(id);
      const el = root.current;
      (el?.querySelector<HTMLElement>(`.cs-detail [data-info="${id}"]`) ?? el?.querySelector<HTMLElement>(`[data-info="${id}"]`))?.focus();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [id, toggleDesc, root]);
}

/* ---------- reveal: a height that glides, a chart that mounts without a pop ---------- */

type Phase = "closed" | "opening" | "open" | "closing";
function useReveal(open: boolean, ms: number, onOpened?: () => void) {
  const [phase, setPhase] = useState<Phase>(open ? "open" : "closed");
  const [settled, setSettled] = useState(open);
  const [mounted, setMounted] = useState(open);
  if (open && (phase === "closed" || phase === "closing")) { setPhase(phase === "closing" ? "open" : "opening"); setMounted(true); setSettled(false); }
  else if (!open && (phase === "open" || phase === "opening")) { setPhase("closing"); setSettled(false); }
  const cb = useRef(onOpened);
  useEffect(() => { cb.current = onOpened; });
  useEffect(() => {
    let a = 0, b = 0, t = 0;
    if (phase === "opening") a = requestAnimationFrame(() => { b = requestAnimationFrame(() => setPhase("open")); });
    if (phase === "open" && !settled) t = window.setTimeout(() => { setSettled(true); cb.current?.(); }, ms + 30);
    if (phase === "closing") t = window.setTimeout(() => setPhase("closed"), ms + 30);
    return () => { cancelAnimationFrame(a); cancelAnimationFrame(b); clearTimeout(t); };
  }, [phase, settled, ms]);
  return { mounted, shown: phase === "open", settled, gone: phase === "closed" };
}

/** True once a real chart (an svg or canvas of some size) has been drawn inside the element, so a skeleton can hold the height until then. Watches the element instead of polling; gives up after a couple of seconds. `skip` is for a metric with no data, whose chart is an empty note and draws no svg. */
function useDrawn(mounted: boolean, skip?: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!mounted || ready || skip || !el) return;
    let raf = 0;
    const check = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { if ([...el.querySelectorAll("svg, canvas")].some((n) => { const b = n.getBoundingClientRect(); return b.height >= 120 && b.width >= 120; })) setReady(true); });
    };
    const mo = new MutationObserver(check), ro = new ResizeObserver(check);
    mo.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ["width", "height", "style"] });
    ro.observe(el);
    const cap = window.setTimeout(() => setReady(true), 2500);
    check();
    return () => { mo.disconnect(); ro.disconnect(); clearTimeout(cap); cancelAnimationFrame(raf); };
  }, [mounted, ready, skip]);
  return [ref, ready || !!skip] as const;
}

/** Animates the height, mounts its children on first open and keeps them mounted, and holds the chart's height with a skeleton until it has drawn. */
function Reveal({ open, ms = 220, hidden, onOpened, id, innerRef, empty, children }: { open: boolean; /** The metric has no data: its chart is a note, so no skeleton waits for a drawing. */ empty?: boolean; ms?: number; /** Take the box out of the layout when closed (grid gaps). */ hidden?: boolean; onOpened?: () => void; id: string; innerRef?: RefObject<HTMLDivElement | null>; children: ReactNode }) {
  const r = useReveal(open, ms, onOpened);
  const [ref, ready] = useDrawn(r.mounted, empty);
  return (
    <div id={id} ref={innerRef} className="cs-reveal" data-open={r.shown} data-settled={r.settled} data-gone={hidden && r.gone ? "true" : undefined} style={{ ["--cs-ms" as string]: `${ms}ms` }} inert={!r.shown || undefined}>
      <div className="cs-reveal-in">{r.mounted && <div ref={ref} className="cs-body" data-ready={ready}>
        {!ready && <div className="cs-skel load-bar" aria-hidden="true" />}
        <div className="cs-body-in">{children}</div>
      </div>}</div>
    </div>
  );
}

/* ---------- row pieces ---------- */

/** What a card or row says to a screen reader: the metric and its answer with unit and qualifier (the leader, not whatever mark is hovered). */
function answerLabel(title: string, s?: Summary) {
  if (s?.strengths) return `${title}, ${strengthNames(s)}`;
  const a = s?.answer;
  return a ? `${title}, ${a.name} ${[a.text, a.unit, a.qual].filter(Boolean).join(" ")}` : title;
}

/** The shipped one-liner as a sentence. */
const descText = (desc: string) => desc ? `${desc.charAt(0).toUpperCase()}${desc.slice(1)}${/[.!?]$/.test(desc) ? "" : "."}` : "";

/** The info glyph ChartMethod ships, as a button that shows the description in flow under its row (nothing is covered). */
function InfoButton({ title, open, onClick, controls, rowId }: { title: string; open: boolean; onClick: () => void; controls?: string; rowId: string }) {
  return <button type="button" data-info={rowId} className="cs-info hit" aria-label={`How ${title.toLowerCase()} is worked out`} aria-expanded={open} aria-controls={controls} title="Methodology"
    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
    onKeyDown={(e) => { if (e.key === "Escape" && open) { e.stopPropagation(); onClick(); } }}>
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><circle cx="8" cy="8" r="6.4" /><path d="M8 7.2v4" strokeLinecap="round" /><circle cx="8" cy="4.9" r=".55" fill="currentColor" stroke="none" /></svg>
  </button>;
}

function Desc({ open, id, children }: { open: boolean; id: string; children: ReactNode }) {
  return <div id={id} className="cs-desc" data-open={open} inert={!open || undefined}><div><p>{children}</p></div></div>;
}

/* ---------- the sheet ---------- */

/**
 * More metrics: every metric as a small real chart with the best of the index's top ten named under it. A click opens the full chart in a row beneath its grid row while the grid stays put; Time per task is the one big chart on top. On a phone the cards become answer rows with a sparkline.
 * `summaries` come from the same points the charts draw (MetricGallery builds them once per data change).
 */
export function MetricSheet({ rows, summaries, snapshot, labs }: { rows: MetricRow[]; summaries: Map<string, Summary>; snapshot: Snapshot; labs: Lab[] }) {
  const api = useOpenRows(rows);
  const [root, gw] = useWidth<HTMLDivElement>();
  const phone = gw > 0 && gw < PHONE;
  const cols = gw ? Math.max(1, Math.floor((gw + GAP) / (MIN + GAP))) : 4;
  useEscapeDesc(api, root);
  const hero = rows.find((r) => r.id === "tpt");
  const heroOpen = !!hero && api.isOpen(hero);
  const empty = (r: MetricRow) => { const s = summaries.get(r.id); return !!s && !s.strengths && s.n === 0; };
  const cards = rows.filter((r) => !(heroOpen && r === hero));
  // A last grid row with holes gives its extra columns to the last card, so the grid reads as finished.
  const rem = cards.length % cols, lastSpan = rem === 0 ? 1 : cols - rem + 1;
  const items: ReactNode[] = [];
  cards.forEach((r, i) => {
    items.push(<Card key={r.key} row={r} s={summaries.get(r.id)} api={api} index={i} cols={cols} root={root} snapshot={snapshot} span={i === cards.length - 1 ? lastSpan : 1} />);
    if (i % cols === cols - 1 || i === cards.length - 1) for (const c of cards.slice(i - (i % cols), i + 1)) items.push(<Detail key={`d-${c.key}`} row={c} api={api} root={root} empty={empty(c)} rule />);
  });
  return (
    <MetricLabs value={labs}>
      <div ref={root} className={`cs-sheet border-t hairline ${phone ? "" : "cs-wide"}`}>
        {rows.map((r) => <Hash key={r.key} anchor={r.anchor} onHit={() => api.set(r, true)} />)}
        {phone ? rows.map((r) => <AnswerRow key={r.key} row={r} s={summaries.get(r.id)} api={api} root={root} empty={empty(r)} snapshot={snapshot} />) : <>
          {hero && <Detail row={hero} api={api} root={root} empty={empty(hero)} hero />}
          <div className="cs-grid" data-hero={heroOpen} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>{items}</div>
        </>}
      </div>
    </MetricLabs>
  );
}

function Card({ row, s, api, index, cols, root, snapshot, span }: { row: MetricRow; s?: Summary; api: OpenRows; index: number; cols: number; root: RefObject<HTMLDivElement | null>; snapshot: Snapshot; span: number }) {
  const [hover, setHover] = useState<Mark | null>(null);
  const [tref, tw] = useWidth<HTMLDivElement>();
  const open = api.isOpen(row), radar = !!s?.strengths;
  const shown = hover ?? s?.answer ?? null;
  const key = (e: KeyboardEvent) => {
    const move: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols };
    if (!(e.key in move) && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const all = [...(root.current?.querySelectorAll<HTMLElement>(".cs-card > .cs-hit") ?? [])];
    const to = e.key === "Home" ? 0 : e.key === "End" ? all.length - 1 : index + move[e.key];
    all[Math.max(0, Math.min(all.length - 1, to))]?.focus();
  };
  const label = answerLabel(row.title, s);
  return (
    <div className="cs-card" data-open={open} data-radar={radar} style={span > 1 ? { gridColumn: `span ${span}` } : undefined}>
      <button type="button" className="cs-hit" data-row={row.id} aria-expanded={open} aria-controls={`cs-b-${row.id}`} aria-label={label} onClick={() => api.toggle(row)} onKeyDown={key} />
      <div className="cs-ch">
        <span className="gallery-title cs-ct">{row.title}</span>
        {row.desc && <InfoButton title={row.title} rowId={row.id} open={api.desc === row.id} controls={`cs-d-${row.id}`} onClick={() => { api.set(row, true); api.showDesc(row.id); }} />}
        {shown?.text && <span className="cs-cv" aria-hidden="true"><span className="num">{shown.text}{shown.unit ? ` ${shown.unit}` : ""}</span>{shown.qual && <span className="cap">{shown.qual}</span>}</span>}
      </div>
      <div ref={tref} className="cs-thumb" onClick={() => api.toggle(row)}>
        {!s || tw <= 0 ? <div className="load-bar" style={{ height: radar ? THUMB_H + 28 : THUMB_H }} />
          : s.strengths ? <StrengthsThumb s={s} h={THUMB_H + 28} />
          : <Thumb s={s} w={tw} h={THUMB_H} active={hover} onActive={setHover} snapshot={snapshot} />}
      </div>
      {!radar && <div className="cs-cf" aria-hidden="true">
        {shown && <><Logo labId={shown.labId} name={shown.name} size={14} /><span className="cs-cn" title={shown.name}>{shown.name}</span></>}
      </div>}
    </div>
  );
}

/** The opened chart: its own header (title, info, close), the description in flow, then the real chart. */
function Detail({ row, api, root, empty, hero, rule }: { row: MetricRow; api: OpenRows; root: RefObject<HTMLElement | null>; empty?: boolean; hero?: boolean; rule?: boolean }) {
  const head = useRef<HTMLDivElement>(null), body = useRef<HTMLDivElement>(null);
  const open = api.isOpen(row), descOpen = api.desc === row.id;
  return (
    <div className="cs-detail" data-hero={hero} data-rule={rule}>
      <Reveal id={`cs-b-${row.id}`} open={open} hidden empty={empty} onOpened={() => ensureVisible(head.current, body.current)} innerRef={body} ms={240}>
        <div ref={head} className="cs-dh">
          <span className="gallery-title cs-t">{row.title}</span>
          {row.desc && <InfoButton title={row.title} rowId={row.id} open={descOpen} controls={`cs-d-${row.id}`} onClick={() => api.toggleDesc(row.id)} />}
          <button type="button" className="cs-close hit" aria-label={`Close ${row.title}`} aria-expanded onClick={() => { api.set(row, false); focusHit(root, row.id); }}><IconChevronUp size={16} stroke={2} aria-hidden="true" /></button>
        </div>
        <Desc id={`cs-d-${row.id}`} open={descOpen}>{descText(row.desc)}</Desc>
        {row.body}
      </Reveal>
    </div>
  );
}

/** Phone: a row per metric with the leader, a sparkline and the value; the chart opens inside the row. */
function AnswerRow({ row, s, api, root, empty, snapshot }: { row: MetricRow; s?: Summary; api: OpenRows; root: RefObject<HTMLDivElement | null>; empty?: boolean; snapshot: Snapshot }) {
  const head = useRef<HTMLDivElement>(null), body = useRef<HTMLDivElement>(null);
  const [sref, sw] = useWidth<HTMLSpanElement>();
  const open = api.isOpen(row), descOpen = api.desc === row.id, a = s?.answer;
  const arrows = (e: KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const items = [...(root.current?.querySelectorAll<HTMLElement>(".cs-hit") ?? [])], i = items.indexOf(e.currentTarget as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    items[e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : Math.max(0, Math.min(items.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))]?.focus();
  };
  return (
    <div className="cs-row border-b hairline" data-open={open}>
      <div ref={head} className="cs-sum">
        <button type="button" className="cs-hit" data-row={row.id} aria-expanded={open} aria-controls={`cs-b-${row.id}`} aria-label={answerLabel(row.title, s)} onClick={() => api.toggle(row)} onKeyDown={arrows} />
        <span className="cs-title">
          <span className="gallery-title cs-t">{row.title}</span>
          {row.desc && <InfoButton title={row.title} rowId={row.id} open={descOpen} controls={`cs-d-${row.id}`} onClick={() => api.toggleDesc(row.id)} />}
        </span>
        <span className="cs-ans" aria-hidden="true">
          <span className="cs-lead">{s?.strengths ? <span className="cs-aname" title={strengthNames(s)}>{strengthNames(s)}</span> : a ? <>
            <Logo labId={a.labId} name={a.name} size={16} />
            <span className="cs-aname" title={a.name}>{a.name}</span>
          </> : !s ? <span className="cs-ld load-bar" /> : null}</span>
          <span ref={sref} className="cs-spark">{s && sw > 0 && <Thumb s={s} w={sw} h={28} mini snapshot={snapshot} />}</span>
          <span className="cs-val">{a?.text && <><span className="cs-aval num">{a.text}</span>{(a.unit || a.qual) && <span className="cap">{[a.unit, a.qual].filter(Boolean).join(" ")}</span>}</>}</span>
        </span>
        <i className="cs-chev" aria-hidden="true">{open ? <IconChevronUp size={16} stroke={2} /> : <IconChevronDown size={16} stroke={2} />}</i>
      </div>
      <Desc id={`cs-d-${row.id}`} open={descOpen}>{descText(row.desc)}</Desc>
      <Reveal id={`cs-b-${row.id}`} open={open} empty={empty} innerRef={body} onOpened={() => ensureVisible(head.current, body.current)}>{row.body}</Reveal>
    </div>
  );
}
