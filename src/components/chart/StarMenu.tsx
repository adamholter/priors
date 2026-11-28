"use client";
import { createContext, memo, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { IconStar, IconStarFilled, IconX } from "@tabler/icons-react";
import { LabLogo } from "@/components/LabLogo";
import { modelOf, togglePoint, useHighlight } from "./highlight";
import type { ScatterPoint } from "./scatter-option";
import { fitNames, labIdOf, nameWidth, starDelta } from "./star-menu";
import { setHotStar, toggleStar, usePhone, useStarPulse, useStars, type Stars } from "./star-state";
import "./star-menu.css";

/** What a chart's toolbar shares between its star icon and the starred names under its title: whether the picker is open, and the chart's marks (for quick picks and the two-star difference). */
type Scope = { open: boolean; setOpen: (open: boolean) => void; pts?: ScatterPoint[]; drawn?: ScatterPoint[]; better?: "lower" | "higher"; xName?: string };
const ScopeContext = createContext<Scope | null>(null);
/** Wrap a chart's toolbar. `pts` are the chart's marks, `drawn` the ones on screen (the difference reads these), `xName` its x axis name. */
export function StarScope({ pts, drawn, better, xName, children }: Omit<Scope, "open" | "setOpen"> & { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, setOpen, pts, drawn, better, xName }), [open, pts, drawn, better, xName]);
  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}

// The picker is loaded the first time it opens (or is about to: see `warm`), so the page ships only the star and the names line.
const loadPanel = () => import("./StarPanel");
const Panel = dynamic(() => loadPanel().then((m) => m.StarPanel), { ssr: false });

/** The star in a chart's header: filled indigo with a bare count when anything is starred. Opens the picker. */
export const StarMenu = memo(function StarMenu({ label }: { label: string }) {
  const scope = useContext(ScopeContext);
  return scope ? <Menu scope={scope} label={label} /> : <StarScope><StarMenu label={label} /></StarScope>;
});

function Menu({ scope, label }: { scope: Scope; label: string }) {
  const stars = useStars(), pulse = useStarPulse(), id = useId();
  const btn = useRef<HTMLButtonElement>(null), root = useRef<HTMLDivElement>(null);
  const { open, setOpen } = scope, n = stars.items.length;
  const close = useCallback((refocus?: boolean) => { setOpen(false); if (refocus) btn.current?.focus({ preventScroll: true }); }, [setOpen]);
  // Touch has no hover to warm the chunk, so fetch it once the page is idle.
  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (h: number) => void };
    const idle = !!w.requestIdleCallback;
    const h = idle ? w.requestIdleCallback!(() => { loadPanel(); }, { timeout: 4000 }) : window.setTimeout(loadPanel, 2500);
    return () => { if (idle) w.cancelIdleCallback?.(h); else window.clearTimeout(h); };
  }, []);
  if (!stars.h) return null;
  return <div ref={root} className="star-menu">
    <button ref={btn} type="button" className="star-trigger hit" data-on={n > 0} aria-expanded={open} aria-haspopup="dialog" aria-controls={open ? id : undefined} aria-label={n ? `Starred models in ${label}: ${n}` : `Star models in ${label}`} title="Star models"
      onPointerEnter={loadPanel} onFocus={loadPanel} onClick={() => setOpen(!open)}>
      {n ? <IconStarFilled size={16} aria-hidden="true" /> : <IconStar size={16} stroke={1.5} aria-hidden="true" />}
      {n > 0 && <span key={pulse} className="star-n" data-pulse={pulse > 0 ? "" : undefined}>{n}</span>}
    </button>
    {open && <Panel stars={stars} scope={scope} trigger={btn} root={root} id={id} close={close} label={label} />}
  </div>;
}

/** Text width in the line's font, for deciding how many names fit before the +N. */
let canvas: CanvasRenderingContext2D | null = null;
const widths = new Map<string, number>();
const textWidth = (s: string) => {
  if (typeof document === "undefined") return s.length * 6.6;
  let w = widths.get(s);
  if (w === undefined) {
    canvas ??= document.createElement("canvas").getContext("2d");
    if (canvas) canvas.font = `12.5px ${getComputedStyle(document.body).fontFamily}`;
    w = canvas ? canvas.measureText(s).width : s.length * 6.6;
    if (widths.size > 400) widths.clear();
    widths.set(s, w);
  }
  return w;
};

/** The chart toolbar a name line sits in: it takes the room the header controls leave, so it can run past the title without pushing the controls onto a new row. On a phone, where the title already fills its row, it takes the whole row. `room` is that width (null outside a toolbar), `budget` the width names may use. */
function useLineBox() {
  const [w, setW] = useState(0), [room, setRoom] = useState<number | null>(null);
  const ro = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLElement | null) => {
    ro.current?.disconnect(); ro.current = null;
    if (!el) return;
    const host = el.closest(".chart-toolbar"), ctrl = host?.lastElementChild as HTMLElement | null | undefined, ok = !!host && !!ctrl && !ctrl.contains(el);
    const measure = () => {
      const width = Math.round(el.getBoundingClientRect().width);
      let next: number | null = null;
      if (ok && host && ctrl) {
        const st = getComputedStyle(host), inner = host.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight), title = el.previousElementSibling;
        let tw = 0; if (title) { const r = document.createRange(); r.selectNodeContents(title); tw = r.getBoundingClientRect().width; }
        next = Math.max(0, Math.floor(!title || tw + ctrl.offsetWidth + 8 <= inner ? inner - ctrl.offsetWidth - 8 : inner));
      }
      setW(width); setRoom(next);
    };
    measure(); ro.current = new ResizeObserver(measure); ro.current.observe(el); if (ok && host) ro.current.observe(host);
  }, []);
  useEffect(() => () => ro.current?.disconnect(), []);
  return { room, budget: room ?? w, ref };
}

/** The leader's score and cost against the other star, as numbers only. */
function Delta({ stars, short }: { stars: Stars; short?: boolean }) {
  const { drawn, xName } = useContext(ScopeContext) ?? {};
  const d = useMemo(() => starDelta(stars.items, drawn, xName, stars.label), [stars.items, drawn, xName, stars.label]);
  if (!d) return null;
  const color = stars.byId.get(modelOf(d.lead))?.color;
  return <span className="star-delta cap" title={d.text} aria-label={d.text} role="note">
    <i style={{ background: color }} aria-hidden="true" />
    <span className="num">+{d.d.toFixed(1)}</span>{!short && <span>score</span>}
    {d.x !== null && <><span className="num">{d.times}x</span><span>{d.word}</span></>}
  </span>;
}
const DELTA_W = 158, DELTA_S = 112;

/** The starred names under a chart title (memoized: a chart redraws on every hover, this does not). One line that never grows, the first few with an x, then +N that opens the picker. Pointing at a name draws that model's guides and card on the chart. */
export const StarList = memo(function StarList() {
  const stars = useStars(), phone = usePhone(), scope = useContext(ScopeContext);
  const { room, budget: raw, ref } = useLineBox(), budget = raw ? raw - 8 : 0;
  const [anim, setAnim] = useState(false);
  const { items } = stars, n = items.length;
  // Keep the names while the line closes, so it folds shut with them instead of emptying first.
  const [kept, setKept] = useState(items);
  if (n && kept !== items) setKept(items);
  useEffect(() => {
    let inner = 0; const outer = requestAnimationFrame(() => { inner = requestAnimationFrame(() => setAnim(true)); });
    return () => { cancelAnimationFrame(outer); cancelAnimationFrame(inner); };
  }, []);
  useEffect(() => () => setHotStar(null), []);
  const shown = n ? items : kept, cap = phone ? 2 : 3;
  // One width per name that can show, plus a placeholder when more follow (they fold into +N).
  const { fit, used } = fitNames(shown.slice(0, cap).map((it) => nameWidth(textWidth(stars.label(it)))).concat(shown.length > cap ? [0] : []), cap, budget);
  if (!stars.h) return null;
  const vis = shown.slice(0, fit), more = shown.length - vis.length;
  const open = n > 0 && fit > 0;
  const two = open && more === 0 && n === 2 && !!scope?.drawn, delta = two && (!budget || used + DELTA_S <= budget), short = !!budget && used + DELTA_W > budget;
  return <div ref={ref} className="star-listwrap" data-open={open} data-anim={anim} data-solo={room !== null || undefined} style={room !== null ? { maxWidth: room } : undefined} aria-hidden={!open || undefined}>
    <div className="star-listclip"><p className="star-names">
      {vis.map((it) => { const m = stars.byId.get(modelOf(it)), label = stars.label(it); return (
        <span key={it} className="star-name" onPointerEnter={(e) => { if (e.pointerType === "mouse") setHotStar(it); }} onPointerLeave={() => setHotStar(null)} onFocus={() => setHotStar(it)} onBlur={() => setHotStar(null)}>
          {m ? <LabLogo lab={labIdOf(m)} name={m.lab ?? m.name} color={m.color} size={14} /> : <i aria-hidden="true" />}
          <span className="star-name-t" title={label}>{label}</span>
          <button type="button" className="star-x hit" tabIndex={open ? 0 : -1} aria-label={`Unstar ${label}`} onClick={() => { setHotStar(null); stars.removeItem(it); }}><IconX size={12} stroke={2} aria-hidden="true" /></button>
        </span>); })}
      {more > 0 && <button type="button" className="star-more hit" tabIndex={open ? 0 : -1} aria-label={`${more} more starred, open the star list`} onClick={() => scope?.setOpen(true)}>+{more}</button>}
      {delta && <Delta stars={stars} short={short} />}
    </p></div>
  </div>;
});

/** A star in the pinned point card: one tap stars or unstars the mark you are reading. */
export function StarCardButton({ point, grey }: { point: ScatterPoint; grey?: string }) {
  const h = useHighlight();
  if (!h) return null;
  const on = togglePoint(h.items, [point], point).length < h.items.length, name = point.r.model.name;
  return <button type="button" aria-pressed={on} aria-label={`${on ? "Unstar" : "Star"} ${name}`} title={on ? "Unstar" : "Star"} className="hit pointer-events-auto ml-auto mr-1 -mt-0.5 p-0.5" style={{ color: on ? "var(--indigo)" : grey }}
    onClick={(e) => { e.stopPropagation(); toggleStar(h, [point], point); }}>
    {on ? <IconStarFilled size={14} aria-hidden="true" /> : <IconStar size={14} stroke={1.5} aria-hidden="true" />}
  </button>;
}
