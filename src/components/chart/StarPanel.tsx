"use client";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { IconCalendarPlus, IconStairsUp, IconStar, IconStarFilled, IconTrophy, IconX } from "@tabler/icons-react";
import { LabLogo } from "@/components/LabLogo";
import { modelOf } from "./highlight";
import type { ScatterPoint } from "./scatter-option";
import { allStarred, effortsFor, labGroups, labIdOf, matches, quickPicks, rowsThatFit, stripDots, type StarGroup, type StarRow } from "./star-menu";
import { useCoarse, usePhone, useStarPulse, type Stars } from "./star-state";
import "./star-panel.css";

type Detent = "half" | "full";
type Place = { phone: boolean; space: number; above: boolean; lift: number; dx: number };
type Scope = { pts?: ScatterPoint[]; better?: "lower" | "higher" };

/** Where the panel goes: under the star on a desktop and clear of the name line beneath the title (flipped above when there is no room); on a phone a bottom sheet. */
function usePlacement(trigger: RefObject<HTMLElement | null>, width: number): Place {
  const phone = usePhone();
  const [pl, setPl] = useState({ space: 560, above: false, lift: 0, dx: 0 });
  useLayoutEffect(() => {
    let frame = 0;
    const pos = () => {
      const t = trigger.current, r = t?.getBoundingClientRect(); if (!r) return;
      const line = t?.closest(".chart-toolbar")?.querySelector<HTMLElement>(".star-listwrap"), lr = line?.getBoundingClientRect();
      const lift = !phone && lr && lr.height > 4 ? Math.max(0, Math.round(lr.bottom - r.bottom)) : 0;
      const below = innerHeight - r.bottom - 16 - lift, above = r.top - 16, flip = !phone && below < 300 && above > below;
      const space = Math.round(Math.min(640, Math.max(200, flip ? above : below)));
      const dx = phone ? 0 : Math.max(0, Math.round(8 - (r.right - Math.min(width, innerWidth - 32))));
      const next = { space, above: flip, lift: flip ? 0 : lift, dx };
      setPl((c) => (c.space === next.space && c.above === next.above && c.lift === next.lift && c.dx === next.dx ? c : next));
    };
    const soon = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(pos); };
    const host = trigger.current?.closest(".chart-toolbar"), ro = new ResizeObserver(soon);
    if (host) ro.observe(host);
    pos(); addEventListener("resize", soon);
    if (!phone) addEventListener("scroll", soon, { capture: true, passive: true });
    return () => { cancelAnimationFrame(frame); ro.disconnect(); removeEventListener("resize", soon); removeEventListener("scroll", soon, { capture: true }); };
  }, [phone, trigger, width]);
  return { phone, ...pl };
}

/* ---------- the phone sheet ---------- */
const subViewport = (cb: () => void) => { const v = window.visualViewport; v?.addEventListener("resize", cb); v?.addEventListener("scroll", cb); addEventListener("resize", cb); return () => { v?.removeEventListener("resize", cb); v?.removeEventListener("scroll", cb); removeEventListener("resize", cb); }; };
const viewportNow = () => { const v = window.visualViewport; return `${Math.round(v?.height ?? innerHeight)}|${Math.max(0, Math.round(v ? innerHeight - v.height - v.offsetTop : 0))}`; };

/** A bottom sheet on the visual viewport (Escape closes only the sheet, even inside an expanded chart), so it rides above the keyboard. Two detents (52% and 88%), a grabber that drags or taps to cycle, a scrim, and body scroll locked. */
function Sheet({ onClose, label, id, children }: { onClose: () => void; label: string; id: string; children: (setDetent: (d: Detent) => void) => ReactNode }) {
  const [detent, setDetent] = useState<Detent>("half");
  const [h, kb] = useSyncExternalStore(subViewport, viewportNow, () => "800|0").split("|").map(Number);
  const [drag, setDrag] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const half = Math.round(h * 0.52), full = Math.round(h * 0.88);
  useEffect(() => {
    const html = document.documentElement, prev = [html.style.overflow, document.body.style.overflow];
    html.style.overflow = "hidden"; document.body.style.overflow = "hidden";
    root.current?.focus({ preventScroll: true });
    return () => { html.style.overflow = prev[0]; document.body.style.overflow = prev[1]; };
  }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) { e.stopPropagation(); onClose(); } }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [onClose]);
  const trap = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const box = root.current; if (!box) return;
    const tabs = [...box.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
    if (!tabs.length) { e.preventDefault(); box.focus(); return; }
    const a = document.activeElement, first = tabs[0], last = tabs[tabs.length - 1];
    if (e.shiftKey && (a === first || a === box)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
  }, []);
  const grab = useCallback((e: React.PointerEvent) => {
    const y0 = e.clientY, h0 = detent === "full" ? full : half; let moved = 0;
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* a pointer that cannot be captured still drags through the window listeners */ }
    const move = (ev: PointerEvent) => { moved = Math.max(moved, Math.abs(y0 - ev.clientY)); if (moved > 4) setDrag(Math.max(96, Math.min(full, h0 + y0 - ev.clientY))); };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      const now = Math.max(96, Math.min(full, h0 + y0 - ev.clientY)); setDrag(null);
      if (moved <= 4) setDetent(detent === "half" ? "full" : "half");
      else if (now < h * 0.25) onClose();
      else setDetent(Math.abs(now - full) < Math.abs(now - half) ? "full" : "half");
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  }, [detent, full, half, h, onClose]);
  return createPortal(
    <div data-star-layer className="star-sheet-root">
      <div className="star-scrim" onClick={onClose} />
      <div ref={root} id={id} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} onKeyDown={trap} className="star-sheet" data-drag={drag !== null || undefined} style={{ height: drag ?? (detent === "full" ? full : half), bottom: kb }}>
        <div className="star-grab hit" onPointerDown={grab} role="separator" aria-label="Resize"><i /></div>
        {children(setDetent)}
      </div>
    </div>, document.body);
}

/* ---------- little pieces ---------- */
/** A star that pops once when it turns on, not when the row first draws. */
function StarGlyph({ on, size = 16 }: { on: boolean; size?: number }) {
  const prev = useRef(on); const [pop, setPop] = useState(false);
  useEffect(() => { let t = 0; if (prev.current !== on && on) { setPop(true); t = window.setTimeout(() => setPop(false), 180); } prev.current = on; return () => window.clearTimeout(t); }, [on]);
  return on ? <IconStarFilled size={size} className={`star-on${pop ? " star-pop" : ""}`} aria-hidden="true" /> : <IconStar size={size} stroke={1.5} className="star-off" aria-hidden="true" />;
}

/** An icon button with its word: on hover and keyboard focus like the header icons, on touch after a long press, and for a moment after a tap so you can read what it did. */
function IconAction({ label, on, onAct, children }: { label: string; on?: boolean; onAct: () => void; children: ReactNode }) {
  const [tip, setTip] = useState(false);
  const show = useRef(0), hold = useRef(0), held = useRef(false);
  const flash = (ms: number) => { setTip(true); window.clearTimeout(show.current); show.current = window.setTimeout(() => setTip(false), ms); };
  useEffect(() => () => { window.clearTimeout(show.current); window.clearTimeout(hold.current); }, []);
  const stop = () => window.clearTimeout(hold.current);
  return <button type="button" className="star-iconbtn hit" data-tip={label} data-tip-open={tip || undefined} aria-pressed={on} aria-label={label}
    onPointerDown={(e) => { if (e.pointerType !== "touch") return; held.current = false; stop(); hold.current = window.setTimeout(() => { held.current = true; flash(1800); }, 420); }}
    onPointerUp={stop} onPointerCancel={stop} onPointerLeave={stop} onContextMenu={(e) => e.preventDefault()}
    onClick={(e) => { if (held.current) { held.current = false; e.preventDefault(); return; } onAct(); if (window.matchMedia("(pointer: coarse)").matches) flash(1400); }}>{children}</button>;
}

const QUICK_ICON = { top: IconTrophy, frontier: IconStairsUp, newest: IconCalendarPlus };
/** Top 5, Frontier and Newest per lab: icons with a word on hover, focus and long press. */
function QuickPicks({ stars, groups, scope, ranked }: { stars: Stars; groups: StarGroup[]; scope: Scope; ranked: boolean }) {
  const { list: models, items, add, remove } = stars;
  const quick = useMemo(() => quickPicks(models, scope.pts, scope.better, groups).filter((k) => ranked || k.id !== "top"), [models, scope.pts, scope.better, groups, ranked]);
  return <>{quick.map((k) => { const Icon = QUICK_ICON[k.id], active = allStarred(items, k.ids); return <IconAction key={k.id} label={k.label} on={active} onAct={() => (active ? remove(k.ids) : add(k.ids))}><Icon size={18} stroke={1.5} aria-hidden="true" /></IconAction>; })}</>;
}

/** One model row: flat (with its logo, in search results) or nested under its lab (with its rank). */
const ModelLine = memo(function ModelLine({ r, i, flat, noRank, on, eff, dim, onToggle }: { r: StarRow; i: number; flat?: boolean; noRank?: boolean; on: boolean; eff: string; dim: boolean; onToggle: (id: string) => void }) {
  return <button type="button" data-row className="star-row star-mrow" data-on={on} data-dim={dim || undefined} aria-pressed={on} style={{ "--i": i } as React.CSSProperties} onClick={() => onToggle(r.m.id)}>
    {flat ? <LabLogo lab={labIdOf(r.m)} name={r.m.lab ?? r.m.name} color={r.m.color} size={18} /> : <span className="star-rank">{r.rank}</span>}
    <span className="star-row-name">{r.m.name}</span>
    {flat && !noRank && <span className="star-rank">{r.rank}</span>}
    {eff && <span className="star-eff">{eff}</span>}
    <StarGlyph on={on} />
  </button>;
});

/** Width of the strip, measured on the first lab row: every strip is the same width. */
function useStripWidth() {
  const [w, setW] = useState(190), ro = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLElement | null) => {
    ro.current?.disconnect(); ro.current = null;
    if (!el) return;
    const measure = () => setW(Math.round(el.getBoundingClientRect().width) || 190);
    measure(); ro.current = new ResizeObserver(measure); ro.current.observe(el);
  }, []);
  useEffect(() => () => ro.current?.disconnect(), []);
  return [w, ref] as const;
}

const NONE: string[] = [];
type LabRowProps = { g: StarGroup; total: number; sw: number; mine: string; isOpen: boolean; items: string[]; full: boolean; onOpen: (key: string | null) => void; onToggle: (id: string) => void; stripRef?: (el: HTMLElement | null) => void };
/** A lab row: logo, name, a hairline with a dot at each model's rank, the star count, one chevron. A lab with a single model toggles on its row. Rows redraw only when their own stars, width or open state change. */
const LabRow = memo(function LabRow({ g, total, sw, mine, isOpen, items, full, onOpen, onToggle, stripRef }: LabRowProps) {
  const starred = useMemo(() => new Set(mine ? mine.split(",") : NONE), [mine]), count = starred.size;
  const solo = g.rows.length === 1, dots = useMemo(() => stripDots(g.rows, total, sw), [g.rows, total, sw]);
  return <div className="star-lab" data-open={isOpen}>
    <button type="button" data-row data-lab={g.key} className="star-lrow disclosure" data-solo={solo || undefined} aria-expanded={solo ? undefined : isOpen} aria-pressed={solo ? count > 0 : undefined}
      onClick={() => (solo ? onToggle(g.rows[0].m.id) : onOpen(isOpen ? null : g.key))}
      onKeyDown={(e) => { if (solo) return; if (e.key === "ArrowRight") { e.preventDefault(); onOpen(g.key); } else if (e.key === "ArrowLeft") { e.preventDefault(); onOpen(null); } }}>
      <LabLogo lab={g.labId} name={g.name} color={g.color} size={22} />
      <span className="star-lname">{g.name}</span>
      <span ref={stripRef} className="star-strip" aria-hidden="true">{dots.map(({ m, rank, x, y }) => <i key={m.id} className="star-sd" data-on={starred.has(m.id) || undefined} title={`${m.name}, rank ${rank}`} style={{ left: x, marginTop: y, background: m.color }} />)}</span>
      <span className="star-lcount">{solo ? <StarGlyph on={count > 0} size={14} /> : count > 0 ? <><IconStarFilled size={12} aria-hidden="true" /><span className="star-n">{count}</span></> : null}</span>
    </button>
    {!solo && <div className="star-collapse" data-open={isOpen}><div className="star-clip">{isOpen && g.rows.map((r, i) => { const on = starred.has(r.m.id); return <ModelLine key={r.m.id} r={r} i={i} on={on} eff={effortsFor(items, r.m.id).join(" ")} dim={full && !on} onToggle={onToggle} />; })}</div></div>}
  </div>;
});

function LabList({ stars, groups, total }: { stars: Stars; groups: StarGroup[]; total: number }) {
  const { items, toggle, full } = stars;
  const [open, setOpen] = useState<string | null>(null);
  const [sw, swRef] = useStripWidth();
  return <div className="star-labs">{groups.map((g, gi) => {
    const mine = g.rows.filter((r) => items.some((it) => modelOf(it) === r.m.id)).map((r) => r.m.id).join(","), isOpen = open === g.key && g.rows.length > 1;
    return <LabRow key={g.key} g={g} total={total} sw={sw} mine={mine} isOpen={isOpen} items={isOpen ? items : NONE} full={full} onOpen={setOpen} onToggle={toggle} stripRef={gi === 0 ? swRef : undefined} />;
  })}</div>;
}

/** Search results, or the whole list when the models carry no lab: one flat run of rows. */
function FlatList({ stars, rows, ranks = true }: { stars: Stars; rows: StarRow[]; ranks?: boolean }) {
  const { items, toggle, full, on } = stars;
  return <>{rows.map((r, i) => { const isOn = on(r.m.id); return <ModelLine key={r.m.id} r={r} i={i} flat noRank={!ranks} on={isOn} eff={effortsFor(items, r.m.id).join(" ")} dim={full && !isOn} onToggle={toggle} />; })}</>;
}

/** Phone sheet: what is starred, as removable rows with logos, right under the field. */
function StarredBlock({ stars }: { stars: Stars }) {
  return <div className="star-starred-block" role="group" aria-label="Starred models">{stars.items.map((it) => { const m = stars.byId.get(modelOf(it)), label = stars.label(it); return (
    <div key={it} className="star-row star-starred">
      {m ? <LabLogo lab={labIdOf(m)} name={m.lab ?? m.name} color={m.color} size={18} /> : <i className="star-dot" />}
      <span className="star-row-name">{label}</span>
      <button type="button" className="star-x star-x-big hit" aria-label={`Unstar ${label}`} onClick={() => stars.removeItem(it)}><IconX size={16} stroke={1.75} aria-hidden="true" /></button>
    </div>); })}</div>;
}

/** The count row: a filled star, the count, and one Clear. On a phone the count opens the starred list. */
function CountRow({ n, onClear, toggle }: { n: number; onClear: () => void; toggle?: { open: boolean; onToggle: () => void } }) {
  const p = useStarPulse();
  const count = <><IconStarFilled size={12} aria-hidden="true" /><span key={p} className="star-n" data-pulse={p > 0 ? "" : undefined}>{n}</span></>;
  return <div className="star-count">
    {toggle
      ? <button type="button" className="star-count-n star-count-btn disclosure hit" aria-expanded={toggle.open} aria-label={`Starred models: ${n}`} onClick={toggle.onToggle}>{count}</button>
      : <span className="star-count-n">{count}</span>}
    <button type="button" className="cap star-clear hit" onClick={onClear}>Clear</button>
  </div>;
}

/** Step focus through the rows of a list with the arrow keys; anything typed goes to the search box. */
function rowKeys(e: React.KeyboardEvent, scope: HTMLElement | null, search: HTMLInputElement | null) {
  const t = e.target as HTMLElement;
  if (t === search && e.key !== "ArrowDown") return;
  const rows = scope ? [...scope.querySelectorAll<HTMLElement>("[data-row]")] : [];
  const i = rows.indexOf(t);
  if (e.key === "ArrowDown") { e.preventDefault(); (i < 0 ? rows[0] : rows[Math.min(rows.length - 1, i + 1)])?.focus(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); if (i <= 0) search?.focus(); else rows[i - 1]?.focus(); }
  else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey && e.key !== " " && search && t !== search) search.focus();
}

function Body({ stars, scope, phone, setDetent }: { stars: Stars; scope: Scope; phone: boolean; setDetent: (d: Detent) => void }) {
  const { items, list: models, toggle, clear } = stars;
  const coarse = useCoarse();
  const [q, setQ] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const search = useRef<HTMLInputElement>(null), list = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!coarse && !phone) search.current?.focus({ preventScroll: true }); }, [coarse, phone]);
  const groups = useMemo(() => labGroups(models), [models]);
  const grouped = useMemo(() => models.some((m) => m.lab), [models]);
  const query = q.trim(), n = items.length;
  const hits = useMemo(() => (query ? models.map((m, i) => ({ m, rank: i + 1 })).filter(({ m }) => matches(m, query)) : []), [models, query]);
  const first = hits.find((h) => !stars.on(h.m.id)) ?? hits[0];
  let body: ReactNode;
  if (!models.length) body = <p className="cap star-empty">No models</p>;
  else if (query) body = hits.length ? <FlatList stars={stars} rows={hits.slice(0, 8)} /> : <p className="cap star-empty">No models</p>;
  else body = grouped ? <LabList stars={stars} groups={groups} total={models.length} /> : <FlatList stars={stars} rows={models.map((m, i) => ({ m, rank: i + 1 }))} ranks={false} />;
  return <div className="star-ladder star-body" onKeyDown={(e) => { if (e.key === "/" && e.target !== search.current) { e.preventDefault(); search.current?.focus(); } else rowKeys(e, list.current, search.current); }}>
    <div className="star-searchrow">
      <input ref={search} type="search" className="inp star-search" placeholder="Search models" aria-label="Search models" value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setDetent("full")}
        onKeyDown={(e) => { if (e.key === "Enter" && first) { e.preventDefault(); toggle(first.m.id); } }} />
      <QuickPicks stars={stars} groups={groups} scope={scope} ranked={grouped} />
    </div>
    {n > 0 && <CountRow n={n} onClear={() => { clear(); if (!phone) search.current?.focus({ preventScroll: true }); }} toggle={phone ? { open: listOpen, onToggle: () => setListOpen(!listOpen) } : undefined} />}
    {phone && n > 0 && <div className="star-collapse" data-open={listOpen}><div className="star-clip">{listOpen && <StarredBlock stars={stars} />}</div></div>}
    {!query && grouped && models.length > 0 && <div className="star-lh cap" aria-hidden="true"><i /><i /><span><span>Rank</span><span>{models.length}</span></span><i /></div>}
    <div ref={list} className="star-list star-ladder-list" role="group" aria-label={grouped ? "Labs" : "Models"}>{body}</div>
  </div>;
}

/** The picker: a popover under the star on a desktop, a bottom sheet on a phone. Loaded the first time the star opens. */
export function StarPanel({ stars, scope, trigger, root, id, close, label }: { stars: Stars; scope: Scope; trigger: RefObject<HTMLButtonElement | null>; root: RefObject<HTMLDivElement | null>; id: string; close: (refocus?: boolean) => void; label: string }) {
  const pl = usePlacement(trigger, 440), coarse = useCoarse(), phone = pl.phone;
  const onClose = useCallback(() => close(true), [close]);
  useEffect(() => {
    if (phone) return;
    const inside = (t: EventTarget | null) => t instanceof Node && !!root.current?.contains(t);
    const out = (e: Event) => { if (!inside(e.target)) close(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented && (inside(document.activeElement) || !document.activeElement || document.activeElement === document.body)) { e.stopPropagation(); close(true); } };
    document.addEventListener("pointerdown", out); document.addEventListener("focusin", out); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", out); document.removeEventListener("focusin", out); document.removeEventListener("keydown", esc); };
  }, [phone, close, root]);
  const name = `Star models in ${label}`;
  if (phone) return <Sheet label={name} id={id} onClose={onClose}>{(setDetent) => <Body stars={stars} scope={scope} phone setDetent={setDetent} />}</Sheet>;
  const rows = rowsThatFit(pl.space, 24 + 36 + 4 + (stars.items.length ? 28 : 0) + 20, coarse ? 44 : 40);
  return <div id={id} className="star-panel" role="dialog" aria-label={name} data-above={pl.above} style={{ "--star-space": `${pl.space}px`, "--star-lift": `${pl.lift}px`, "--star-dx": `${pl.dx}px`, "--star-rows": rows } as React.CSSProperties}>
    <Body stars={stars} scope={scope} phone={false} setDetent={() => {}} />
  </div>;
}

