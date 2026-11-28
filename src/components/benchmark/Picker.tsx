"use client";
import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKey, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { IconArrowNarrowDown, IconCheck, IconHistory, IconSearch, IconX } from "@tabler/icons-react";
import { LabLogo } from "../LabLogo";
import { matches, type PRow } from "@/lib/benchmark-slices";
import "./slice-picker.css";

/**
 * The benchmark page's one picker: a quiet row names the choice and who leads it, and opens a search palette (the list on
 * the left, a preview of the highlighted row on the right). On a phone it is a full screen sheet with the same list.
 */

/* ---------- environment ---------- */

const PHONE = "(max-width: 639px)";
// Module level, so the store keeps one subscription for as long as the palette is open instead of resubscribing on every render.
const subscribePhone = (cb: () => void) => { const mq = window.matchMedia(PHONE); mq.addEventListener("change", cb); return () => mq.removeEventListener("change", cb); };
const phoneNow = () => window.matchMedia(PHONE).matches;
const phoneServer = () => false;
/** Phones and narrow windows: the width where a palette becomes a sheet. */
const usePhone = () => useSyncExternalStore(subscribePhone, phoneNow, phoneServer);

/** A DOM id for one option: the row id can hold spaces and punctuation, and aria-activedescendant reads an id as one token. */
export const optDomId = (list: string, id: string) => `${list}-${id.replace(/[^A-Za-z0-9_-]/g, (c) => `_${c.charCodeAt(0).toString(16)}_`)}`;

/* ---------- small marks ---------- */

/** Lower is better: one arrow, icon only. */
export const LowerMark = ({ size = 14 }: { size?: number }) => <span className="pk-lower" role="img" aria-label="Lower is better" title="Lower is better"><IconArrowNarrowDown size={size} stroke={1.6} /></span>;
export const OldMark = () => <span className="pk-old" role="img" aria-label="Older version" title="Older version"><IconHistory size={14} stroke={1.6} /></span>;
const CheckMark = () => <IconCheck size={16} stroke={1.8} className="pk-check" aria-hidden="true" />;
const NoMatch = () => <p className="pk-nomatch">No match</p>;

/** Who leads a choice: the lab to draw, the model, the printed score. */
export type Lead = { labId: string; name: string; color?: string; text: string };
/** One choice in a picker: a name, who leads it, and the few marks that say more. */
export type Opt = { id: string; label: string; lead?: Lead; lower?: boolean; old?: boolean; note?: string; /** Rows that go to a page: a real link, so open in a new tab and copy link work. */ href?: string };
export type Block = { key: string; label?: string; rows: Opt[] };

/* ---------- overlays ---------- */

type Placed = { left: number; top?: number; bottom?: number; w: number; maxH: number };
/** Under the trigger when there is room, above it when there is more room there: a popover never leaves the screen. */
function place(el: HTMLElement | null, width: number, want: number): Placed | null {
  const a = el?.getBoundingClientRect();
  if (!a) return null;
  const vw = window.innerWidth, vh = window.innerHeight, w = Math.min(width, vw - 16);
  const left = Math.min(Math.max(8, a.left), vw - w - 8);
  const below = vh - a.bottom - 14, above = a.top - 14;
  if (below < want && above > below) return { left, bottom: vh - a.top + 6, w, maxH: Math.max(200, above - 6) };
  return { left, top: a.bottom + 6, w, maxH: Math.max(200, below - 6) };
}
const same = (a: Placed | null, b: Placed | null) => a === b || (!!a && !!b && a.left === b.left && a.top === b.top && a.bottom === b.bottom && a.w === b.w && a.maxH === b.maxH);

/** A popover hung under its trigger, drawn on the body so a summary or an overflow cannot clip or toggle it. */
function Pop({ anchor, width, onClose, children, label, className = "" }: { anchor: RefObject<HTMLElement | null>; width: number; onClose: () => void; children: ReactNode; label: string; className?: string }) {
  // Placed on the first render, so a field inside it can take focus at once (a hidden element cannot).
  const [pos, setPos] = useState(() => place(anchor.current, width, 380));
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useLayoutEffect(() => {
    let frame = 0;
    const again = () => { frame = 0; const next = place(anchor.current, width, 380); setPos((p) => same(p, next) ? p : next); };
    // One read and one write per frame, and nothing at all while the trigger has not moved.
    const soon = () => { if (!frame) frame = requestAnimationFrame(again); };
    again();
    window.addEventListener("resize", soon); window.addEventListener("scroll", soon, true);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", soon); window.removeEventListener("scroll", soon, true); };
  }, [anchor, width]);
  useEffect(() => {
    const down = (e: PointerEvent) => { const t = e.target as Node; if (!ref.current?.contains(t) && !anchor.current?.contains(t)) close.current(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) { e.preventDefault(); close.current(); } };
    document.addEventListener("pointerdown", down); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
  }, [anchor]);
  return createPortal(<div ref={ref} role="dialog" aria-label={label} className={`pk-pop ${className}`} style={pos ? { left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.w, maxHeight: pos.maxH } : { visibility: "hidden" }}>{children}</div>, document.body);
}

const FOCUSABLE = 'a[href]:not([tabindex="-1"]), button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** A full screen layer for phones. Esc and the close button close it, Tab stays inside it, and the page behind stops scrolling. */
function Sheet({ title, onClose, children, head }: { title: string; onClose: () => void; children: ReactNode; head?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  // Mounted once: a parent that redraws must not pull focus out of the search field.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) { e.preventDefault(); close.current(); } };
    document.addEventListener("keydown", key);
    ref.current?.focus({ preventScroll: true });
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", key); prev?.focus?.({ preventScroll: true }); };
  }, []);
  const trap = (e: ReactKey<HTMLDivElement>) => {
    if (e.key !== "Tab" || !ref.current) return;
    const f = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)], at = document.activeElement;
    if (!f.length) { e.preventDefault(); return; }
    if (e.shiftKey && (at === f[0] || at === ref.current)) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && at === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  };
  return createPortal(
    <div className="pk-sheet-root">
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="pk-sheet" onKeyDown={trap}>
        <div className="pk-sheet-head">
          {head ?? <span className="pk-sheet-title">{title}</span>}
          <button type="button" className="pk-icon hit" aria-label="Close" onClick={onClose}><IconX size={18} stroke={1.6} /></button>
        </div>
        <div className="pk-sheet-body">{children}</div>
      </div>
    </div>, document.body);
}

/* ---------- list pieces ---------- */

function Search({ value, onChange, inputRef, onKeyDown, autoFocus, size = "md", controls, active }: { value: string; onChange: (v: string) => void; inputRef?: RefObject<HTMLInputElement | null>; onKeyDown?: (e: ReactKey<HTMLInputElement>) => void; autoFocus?: boolean; size?: "md" | "lg"; controls?: string; active?: string }) {
  return (
    <div className={`pk-search pk-search-${size}`}>
      <IconSearch size={16} stroke={1.6} aria-hidden="true" />
      <input ref={inputRef} type="text" role="combobox" aria-expanded="true" aria-controls={controls} aria-activedescendant={active} aria-autocomplete="list" aria-label="Search" autoFocus={autoFocus} spellCheck={false} autoComplete="off" value={value} placeholder="Search" onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} />
      {value && <button type="button" className="pk-clear hit" aria-label="Clear search" onMouseDown={(e) => e.preventDefault()} onClick={() => onChange("")}><IconX size={14} stroke={1.6} /></button>}
    </div>
  );
}

/** Keyboard model for a list whose focus stays in a search field (aria-activedescendant): arrows, Home and End, PageUp and PageDown by section, Enter. */
function useListKeys(blocks: Block[], active: string | null, setActive: (id: string) => void, onPick: (id: string) => void, onEscape: () => boolean) {
  return useCallback((e: ReactKey<HTMLElement>) => {
    const ids = blocks.flatMap((b) => b.rows.map((r) => r.id));
    if (!ids.length) { if (e.key === "Escape" && onEscape()) e.preventDefault(); return; }
    const at = active ? ids.indexOf(active) : -1;
    const go = (i: number) => { e.preventDefault(); setActive(ids[Math.max(0, Math.min(ids.length - 1, i))]); };
    if (e.key === "ArrowDown") go(at + 1);
    else if (e.key === "ArrowUp") go(at <= 0 ? 0 : at - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(ids.length - 1);
    else if (e.key === "PageDown" || e.key === "PageUp") {
      const starts = blocks.filter((b) => b.rows.length).map((b) => ids.indexOf(b.rows[0].id));
      go(e.key === "PageDown" ? starts.find((s) => s > at) ?? ids.length - 1 : [...starts].reverse().find((s) => s < at) ?? 0);
    } else if (e.key === "Enter" && active) { e.preventDefault(); onPick(active); }
    else if (e.key === "Escape" && onEscape()) e.preventDefault();
  }, [blocks, active, setActive, onPick, onEscape]);
}

/** One option. Memoized with stable callbacks, so moving the highlight redraws two rows, not all 87. */
const Option = memo(function Option({ id, r, current, active, sheet, onActive, onPick }: { id: string; r: Opt; current: boolean; active: boolean; sheet: boolean; onActive: (id: string) => void; onPick: (id: string) => void }) {
  return (
    <Row r={r} id={optDomId(id, r.id)} current={current} active={active} onActive={onActive} onPick={onPick}>
      {sheet ? <>
        <span className="pk-palrow">
          <span className="pk-palrow-name">{r.old && <OldMark />}{r.label}{r.lower && <LowerMark size={12} />}</span>
          <span className="pk-palrow-meta">{r.lead && <><LabLogo lab={r.lead.labId} name={r.lead.name} color={r.lead.color} size={14} /><span>{r.lead.name}</span><span className="num">{r.lead.text}</span></>}{r.note && <span className="num">{r.note}</span>}</span>
        </span>
        {current && <CheckMark />}
      </> : <>
        <span className="pk-opt-label">{r.old && <OldMark />}{r.label}</span>
        {r.lower && <LowerMark size={12} />}
        {r.note && <span className="pk-opt-n num">{r.note}</span>}
        <span className="pk-opt-logo">{r.lead && <LabLogo lab={r.lead.labId} name={r.lead.name} color={r.lead.color} size={16} />}</span>
        <span className="pk-opt-check">{current && <CheckMark />}</span>
      </>}
    </Row>
  );
});

/** The option's box: an anchor when the row has a page, so only a plain click is taken over (modified clicks go to the browser). */
function Row({ r, id, current, active, onActive, onPick, children }: { r: Opt; id: string; current: boolean; active: boolean; onActive: (id: string) => void; onPick: (id: string) => void; children: ReactNode }) {
  const common = { id, role: "option", "data-opt": r.id, "aria-selected": current, "data-current": current || undefined, "data-active": active || undefined, className: "pk-opt", onPointerMove: () => { if (!active) onActive(r.id); } } as const;
  if (!r.href) return <div {...common} onClick={() => onPick(r.id)}>{children}</div>;
  return <a {...common} href={r.href} tabIndex={-1} draggable={false} onClick={(e) => { if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); onPick(r.id); }}>{children}</a>;
}

/** A sectioned option list. `active` is the highlighted row; focus stays wherever the caller keeps it (the search field, or the list itself when `keys` is given). */
function Listbox({ id, blocks, value, active, onActive, onPick, sheet = false, label, keys, innerRef }: { id: string; blocks: Block[]; value: string; active?: string | null; onActive: (id: string) => void; onPick: (id: string) => void; sheet?: boolean; label: string; /** Makes the list itself the focus holder (no search field): it takes the keys. */ keys?: (e: ReactKey<HTMLElement>) => void; innerRef?: RefObject<HTMLDivElement | null> }) {
  const own = useRef<HTMLDivElement>(null);
  const root = innerRef ?? own;
  useEffect(() => {
    if (!active) return;
    root.current?.querySelector<HTMLElement>(`[data-opt="${CSS.escape(active)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, root]);
  const shown = blocks.filter((b) => b.rows.length);
  return (
    <div ref={root} id={id} role="listbox" aria-label={label} className="pk-listbox" tabIndex={keys ? 0 : undefined} aria-activedescendant={keys && active ? optDomId(id, active) : undefined} onKeyDown={keys}>
      {shown.length === 0 && <NoMatch />}
      {shown.map((b) => (
        <div key={b.key} role="group" aria-label={b.label} className="pk-block">
          {b.label && <div className="pk-blockhead"><span>{b.label}</span><span className="num">{b.rows.length}</span></div>}
          {b.rows.map((r) => <Option key={r.id} id={id} r={r} current={r.id === value} active={r.id === active} sheet={sheet} onActive={onActive} onPick={onPick} />)}
        </div>
      ))}
    </div>
  );
}

/** Search the way a person types: every word of the query, in the name, the section or the leader's name. */
function filterBlocks(blocks: Block[], q: string): Block[] {
  if (!q.trim()) return blocks;
  const row = (b: Block, r: Opt): PRow => ({ id: r.id, label: `${r.label} ${r.lead?.name ?? ""}`, name: r.label, section: b.label ?? "" });
  return blocks.map((b) => ({ ...b, rows: b.rows.filter((r) => matches(row(b, r), q)) }));
}

/* ---------- the trigger ---------- */

/** The closed picker: what is chosen and who leads it, then the page's own chevron. */
export function PickTrigger({ label, name, lead, lower, old, open, onClick, onKeyDown, innerRef, bare }: { label?: string; name: string; lead?: Lead; lower?: boolean; old?: boolean; open: boolean; onClick: () => void; onKeyDown?: (e: ReactKey<HTMLButtonElement>) => void; innerRef?: RefObject<HTMLButtonElement | null>; bare?: boolean }) {
  return (
    <button ref={innerRef} type="button" className={`pk-trig disclosure disclosure-inline ${bare ? "is-bare" : ""}`} aria-haspopup="dialog" aria-expanded={open} onClick={onClick} onKeyDown={onKeyDown}>
      {label && <span className="cap">{label}</span>}
      {old && <OldMark />}
      <span className="pk-trig-name">{name}</span>
      {lower && <LowerMark size={14} />}
      {lead && <span className="pk-trig-lead"><LabLogo lab={lead.labId} name={lead.name} color={lead.color} size={16} /><span className="pk-leader-name">{lead.name}</span><span className="pk-leader-val num">{lead.text}</span></span>}
    </button>
  );
}

/* ---------- the palette ---------- */

/** One palette for every choice. `small` is a short list: no search, the list takes the keys. */
export function Palette({ blocks, value, onPick, onClose, anchor, label, preview, small }: { blocks: Block[]; value: string; onPick: (id: string) => void; onClose: () => void; anchor: RefObject<HTMLElement | null>; label: string; preview: (id: string) => ReactNode; small?: boolean }) {
  const phone = usePhone();
  // Focus goes back to the trigger when the palette closes, however it closed.
  const back = () => { onClose(); anchor.current?.focus({ preventScroll: true }); };
  return phone
    ? <PickerSheet title={label} blocks={blocks} value={value} onPick={onPick} onClose={back} />
    : <DesktopPalette blocks={blocks} value={value} onPick={onPick} onClose={back} anchor={anchor} label={label} preview={preview} small={small} />;
}

function DesktopPalette({ blocks, value, onPick, onClose, anchor, label, preview, small }: { blocks: Block[]; value: string; onPick: (id: string) => void; onClose: () => void; anchor: RefObject<HTMLElement | null>; label: string; preview: (id: string) => ReactNode; small?: boolean }) {
  const uid = useId();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(value);
  const shown = useMemo(() => filterBlocks(blocks, q), [blocks, q]);
  const cur = useMemo(() => { const ids = shown.flatMap((b) => b.rows.map((r) => r.id)); return ids.includes(active) ? active : ids[0]; }, [shown, active]);
  const pick = useCallback((id: string) => { onPick(id); onClose(); }, [onPick, onClose]);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (small) listRef.current?.focus({ preventScroll: true }); }, [small]);
  const escape = useCallback(() => { if (!q) return false; setQ(""); return true; }, [q]);
  const keys = useListKeys(shown, cur ?? null, setActive, pick, escape);
  return (
    <Pop anchor={anchor} width={small ? 600 : 680} label={label} onClose={onClose} className={`pk-pop-pal ${small ? "is-small" : ""}`}>
      {!small && <Search value={q} onChange={setQ} autoFocus onKeyDown={keys} controls={`${uid}-l`} active={cur ? optDomId(`${uid}-l`, cur) : undefined} />}
      <div className="pk-pal-body">
        <div className="pk-pal-list">
          <Listbox id={`${uid}-l`} label={label} blocks={shown} value={value} active={cur} onActive={setActive} onPick={pick} keys={small ? keys : undefined} innerRef={listRef} />
        </div>
        <div className="pk-pal-right"><div className="pk-pal-prev" key={cur}>{cur ? preview(cur) : null}</div></div>
      </div>
    </Pop>
  );
}

/** The phone picker: a full screen list with search, and under every name who leads it. */
function PickerSheet({ title, blocks, value, onPick, onClose }: { title: string; blocks: Block[]; value: string; onPick: (id: string) => void; onClose: () => void }) {
  const uid = useId();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(value);
  const shown = useMemo(() => filterBlocks(blocks, q), [blocks, q]);
  const cur = useMemo(() => { const ids = shown.flatMap((b) => b.rows.map((r) => r.id)); return ids.includes(active) ? active : ids[0]; }, [shown, active]);
  const total = useMemo(() => blocks.reduce((n, b) => n + b.rows.length, 0), [blocks]);
  const pick = useCallback((id: string) => { onPick(id); onClose(); }, [onPick, onClose]);
  const escape = useCallback(() => { if (!q) return false; setQ(""); return true; }, [q]);
  const keys = useListKeys(shown, cur ?? null, setActive, pick, escape);
  return (
    <Sheet title={title} onClose={onClose} head={total >= 6 ? <Search value={q} onChange={setQ} onKeyDown={keys} controls={`${uid}-l`} active={cur ? optDomId(`${uid}-l`, cur) : undefined} size="lg" /> : undefined}>
      <Listbox id={`${uid}-l`} label={title} blocks={shown} value={value} active={cur} onActive={setActive} onPick={pick} sheet />
    </Sheet>
  );
}
