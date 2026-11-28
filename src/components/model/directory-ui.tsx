"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { IconArrowsSort, IconCalendar, IconCheck, IconLockOpen, IconSearch, IconSearchOff, IconStack2, IconX } from "@tabler/icons-react";
import { LabLogo } from "@/components/LabLogo";
import { useLabColor } from "@/components/chart/echarts";
import { useDismiss } from "@/components/use-popover";
import { effortsText, lowerEfforts, MODEL_SORTS, nextOrder, reasonText, reasonWord, SINCE, type Effort, type Facet, type LabInfo, type ModelItem, type Order } from "@/lib/model-list";

/** "/" focuses the search field from anywhere that is not a field. */
export function useSlash(ref: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === "/" && !(e.target as HTMLElement)?.closest("input,textarea,select,[contenteditable]")) { e.preventDefault(); ref.current?.focus(); } };
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  }, [ref]);
}

/* ------------------------------------------------------------------ */
/* Marks and bars                                                      */
/* ------------------------------------------------------------------ */

/** The shared grey the snapshot gives labs it has no colour for. */
const isFallback = (c?: string) => !c || /a3a39b|163, ?163, ?155|var\(--grey\)/i.test(c);

/** Lab colour for DOM marks, with the shared fallback grey turned into ink so a bar still reads in both themes. */
export function useMarkColor() {
  const color = useLabColor();
  return useCallback((l: { labId: string; labColor: string }) => {
    const c = color(l.labId, l.labColor);
    return isFallback(l.labColor) || isFallback(c) ? "var(--ink-2)" : c;
  }, [color]);
}

/** A score on the fixed published 0 to 100 axis, never rescaled, so the leader does not read 100. With `efforts`, a thin gap in the bar marks each lower reasoning effort: one bar reads as a ladder up to the best. */
export function ScoreBar({ score, color, efforts }: { score: number; color?: string; efforts?: Effort[] }) {
  const pct = (v: number) => `${Math.max(0, Math.min(100, v))}%`;
  const tip = efforts && efforts.length > 1 ? effortsText(efforts) : undefined;
  return (
    <span className={tip ? "md-barwrap md-tip" : "md-barwrap"} {...(tip ? { "data-tip": tip, role: "img", "aria-label": `Efforts: ${tip}` } : { "aria-hidden": true })}>
      <span className="md-bar"><i style={{ width: pct(score), ...(color ? { background: color } : {}) }} />{lowerEfforts(efforts, score).map((e) => <b key={e.effort} style={{ left: pct(e.score) }} />)}</span>
    </span>
  );
}

/** Why a model has no rank, in a short plain phrase; the hover label says it in full. */
export function Why({ x }: { x: ModelItem }) {
  const text = reasonText(x);
  return <span className="md-why md-tip" data-tip={text} role="img" aria-label={text}>{reasonWord(x)}</span>;
}

export function OpenIcon() {
  return <span className="md-open md-tip" data-tip="Open weights" role="img" aria-label="Open weights"><IconLockOpen size={13} stroke={1.6} aria-hidden /></span>;
}

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

/** Icon only, no box. The hover label sits below it so it never covers the row above. `pressed` is a toggle, `on` only colours a menu button. */
export function IconBtn({ label, pressed, on, onClick, children, disabled, innerRef, expanded, className = "" }: { label: string; pressed?: boolean; on?: boolean; onClick?: () => void; children: ReactNode; disabled?: boolean; innerRef?: RefObject<HTMLButtonElement | null>; expanded?: boolean; className?: string }) {
  return <button ref={innerRef} type="button" className={`md-ib md-tip ${className}`} data-tip={label} aria-label={label} aria-pressed={pressed} aria-expanded={expanded} disabled={disabled} data-on={pressed || on || undefined} onClick={onClick}>{children}</button>;
}

export function SearchField({ q, setQ, inputRef, onDown }: { q: string; setQ: (v: string) => void; inputRef: RefObject<HTMLInputElement | null>; onDown: () => void }) {
  return (
    <div className="md-search">
      <IconSearch size={18} stroke={1.5} aria-hidden />
      <input ref={inputRef} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search models or labs" aria-label="Search models" autoComplete="off" spellCheck={false}
        onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); onDown(); } else if (e.key === "Escape" && q) { e.preventDefault(); setQ(""); } }} />
      {q ? <button type="button" className="md-clear" aria-label="Clear search" onClick={() => { setQ(""); inputRef.current?.focus(); }}><IconX size={16} stroke={1.5} aria-hidden /></button> : <kbd className="cap md-kbd" aria-hidden="true">/</kbd>}
    </div>
  );
}

export function Empty({ text, action, onAction }: { text: string; action: string; onAction: () => void }) {
  return (
    <div className="md-empty">
      <IconSearchOff size={28} stroke={1.5} aria-hidden />
      <p>{text}</p>
      <button type="button" className="btn-quiet" onClick={onAction}>{action}</button>
    </div>
  );
}

/** Released since: one menu of four windows. Indigo while a window is set. */
export function DateButton({ since, onChange }: { since: number; onChange: (days: number) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const cur = SINCE.find((s) => s.days === since);
  return (
    <>
      <IconBtn innerRef={ref} label={since ? `Released in the last ${cur?.label ?? `${since} days`}` : "Released since"} on={since > 0} expanded={open} onClick={() => setOpen((o) => !o)}><IconCalendar size={18} stroke={1.5} aria-hidden /></IconBtn>
      <Popover open={open} onClose={close} anchor={ref} width={190} label="Released since">
        <div className="md-menu" role="menu">
          {SINCE.map((s) => <button key={s.days} type="button" role="menuitemradio" aria-checked={since === s.days} onClick={() => { onChange(s.days); setOpen(false); ref.current?.focus(); }}>{s.label}<IconCheck size={14} stroke={2} aria-hidden /></button>)}
        </div>
      </Popover>
    </>
  );
}

/** The sort menu for a phone, which has no column heads: the five sorts, and a second tap on the current one flips it. */
export function SortButton({ order, onChange }: { order: Order; onChange: (o: Order) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const s = MODEL_SORTS.find((x) => x.id === order.sort)!;
  return (
    <>
      <IconBtn innerRef={ref} className="md-sortbtn" label={`Sort: ${s.name}`} on={order.sort !== "rank" || order.dir !== "asc"} expanded={open} onClick={() => setOpen((o) => !o)}><IconArrowsSort size={18} stroke={1.5} aria-hidden /></IconBtn>
      <Sheet open={open} onClose={close} title="Sort by" opener={ref}>
        <div className="md-menu" role="menu">
          {MODEL_SORTS.map((o) => {
            const on = order.sort === o.id;
            return <button key={o.id} type="button" role="menuitemradio" aria-checked={on} onClick={() => { onChange(nextOrder(order, o.id)); if (!on) setOpen(false); }}>{o.name}{on && <span className="cap md-dirnote">{o.names[order.dir === o.natural ? 0 : 1]}</span>}<IconCheck size={14} stroke={2} aria-hidden /></button>;
          })}
        </div>
      </Sheet>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Popover and sheet                                                   */
/* ------------------------------------------------------------------ */

export function Popover({ open, ...rest }: { open: boolean; onClose: () => void; anchor: RefObject<HTMLElement | null>; width?: number; children: ReactNode; label: string }) {
  return open ? <PopoverBody {...rest} /> : null;
}
function PopoverBody({ onClose, anchor, width = 280, children, label }: { onClose: () => void; anchor: RefObject<HTMLElement | null>; width?: number; children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useDismiss(true, [ref, anchor], onClose, () => anchor.current?.focus());
  useLayoutEffect(() => {
    const place = () => {
      const r = anchor.current?.getBoundingClientRect(); if (!r) return;
      const left = Math.max(8, Math.min(innerWidth - Math.min(width, innerWidth - 16) - 8, r.left)), top = r.bottom + 6;
      setPos((p) => (p && p.left === left && p.top === top ? p : { left, top }));
    };
    place();
    addEventListener("resize", place); addEventListener("scroll", place, true);
    return () => { removeEventListener("resize", place); removeEventListener("scroll", place, true); };
  }, [anchor, width]);
  if (!pos) return null;
  return <div ref={ref} className="md-pop" role="dialog" aria-label={label} style={{ left: pos.left, top: pos.top, width: Math.min(width, innerWidth - 16) }}>{children}</div>;
}

/** A bottom sheet for a phone. Takes focus when it opens and hands it back to `opener` when it closes. */
export function Sheet({ open, onClose, title, opener, children }: { open: boolean; onClose: () => void; title: string; opener: RefObject<HTMLElement | null>; children: ReactNode }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const from = opener.current, prev = document.body.style.overflow;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    close.current?.focus({ preventScroll: true });
    return () => { removeEventListener("keydown", key); document.body.style.overflow = prev; from?.focus({ preventScroll: true }); };
  }, [open, onClose, opener]);
  if (!open) return null;
  return (
    <div className="md-sheet-back" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="md-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="md-sheet-head"><span>{title}</span><button ref={close} type="button" className="md-ib" aria-label="Close" onClick={onClose}><IconX size={18} stroke={1.5} aria-hidden /></button></div>
        <div className="md-sheet-body">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Labs                                                                */
/* ------------------------------------------------------------------ */

export function LabMark({ l, size = 20 }: { l: Pick<LabInfo, "id" | "name" | "color">; size?: number }) {
  return <LabLogo lab={l.id} name={l.name} color={l.color} size={size} />;
}

export const Count = ({ c }: { c: Facet }) => <span className="md-count"><b>{c.ranked}</b>/{c.total}</span>;

/** A type-ahead list of labs with ranked over total counts. A lab with nothing left under the filters dims in place, never vanishes. */
export function LabList({ labs, counts, total, value, onPick }: { labs: LabInfo[]; counts: Map<string, Facet>; total: Facet; value: string; onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [cur, setCur] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  const none = useMemo<Facet>(() => ({ ranked: 0, total: 0 }), []);
  const rows = useMemo(() => {
    const w = q.trim().toLowerCase();
    const hit = labs.filter((l) => !w || l.name.toLowerCase().includes(w) || l.id.includes(w));
    return { all: !w || "all labs".includes(w), withRank: hit.filter((l) => l.ranked > 0), rest: hit.filter((l) => l.ranked === 0) };
  }, [labs, q]);
  const flat = useMemo(() => [...(rows.all ? ["all"] : []), ...rows.withRank.map((l) => l.id), ...rows.rest.map((l) => l.id)], [rows]);
  useEffect(() => { list.current?.querySelector<HTMLElement>(`[data-i="${cur}"]`)?.scrollIntoView({ block: "nearest" }); }, [cur]);
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCur((c) => Math.min(flat.length - 1, c + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCur((c) => Math.max(0, c - 1)); }
    else if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") { e.preventDefault(); const id = flat[cur]; if (id) onPick(id === value ? "all" : id); }
  };
  let i = -1;
  const item = (id: string, name: string, mark: ReactNode, c: Facet) => {
    i++;
    return (
      <li key={id}>
        <button type="button" data-i={i} className="md-lab-opt" aria-pressed={value === id} data-cur={cur === i || undefined} data-dim={c.total === 0 || undefined} onMouseEnter={() => setCur(i)} onClick={() => onPick(value === id ? "all" : id)}>
          {mark}<span className="md-trunc">{name}</span><Count c={c} />
          {value === id && <IconCheck size={14} stroke={2} aria-hidden className="md-check" />}
        </button>
      </li>
    );
  };
  return (
    <div className="md-labs" onKeyDown={key}>
      <div className="md-labs-find"><IconSearch size={16} stroke={1.5} aria-hidden /><input value={q} onChange={(e) => { setQ(e.target.value); setCur(0); }} placeholder="Find a lab" aria-label="Find a lab" spellCheck={false} autoComplete="off" /></div>
      <ul ref={list} className="md-labs-list">
        {rows.all && item("all", "All labs", <IconStack2 size={18} stroke={1.5} aria-hidden />, total)}
        {rows.withRank.map((l) => item(l.id, l.name, <LabMark l={l} size={18} />, counts.get(l.id) ?? none))}
        {rows.rest.length > 0 && rows.withRank.length > 0 && <li className="md-labs-rule" aria-hidden="true" />}
        {rows.rest.map((l) => item(l.id, l.name, <LabMark l={l} size={18} />, counts.get(l.id) ?? none))}
        {flat.length === 0 && <li className="md-labs-none">No lab matches</li>}
      </ul>
    </div>
  );
}
