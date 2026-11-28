"use client";
/** Small parts of a benchmark's header: a window-drawn tip, the score ring, the one chevron, and the motion helpers they share. */
import { Children, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type HTMLAttributes, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A media query as state, false until the browser answers. */
function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => { const m = window.matchMedia(query); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
export const usePhone = () => useMedia("(max-width: 639px)");

const morphing = new WeakMap<HTMLElement, number>();
/**
 * Runs a state change and eases the element's height from what it was to what it became, so a block that opens or closes grows and
 * shrinks instead of popping. Instant under reduced motion. Reads both heights, then writes, so it forces layout twice at most.
 */
export function morph(el: HTMLElement | null, mutate: () => void) {
  if (!el || reduced()) { mutate(); return; }
  window.clearTimeout(morphing.get(el));
  const from = el.getBoundingClientRect().height;
  el.style.height = ""; el.style.overflow = ""; el.style.transition = "";
  flushSync(mutate);
  const to = el.getBoundingClientRect().height;
  if (Math.abs(from - to) < 1) return;
  el.style.height = `${from}px`; el.style.overflow = "hidden";
  void el.offsetHeight;
  el.style.transition = "height .2s ease-out";
  el.style.height = `${to}px`;
  morphing.set(el, window.setTimeout(() => { el.style.height = ""; el.style.overflow = ""; el.style.transition = ""; }, 240));
}

/** To the quality panel, outlining its first card for a moment so the eye lands on the number the ring stood for. */
export function jumpToQuality(e: ReactMouseEvent) {
  const el = document.getElementById("quality");
  if (!el) return;
  e.preventDefault();
  window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 72), behavior: reduced() ? "auto" : "smooth" });
  const card = el.querySelector(".quality-card.is-total");
  if (card) { card.classList.remove("bench-top-pulse"); void (card as HTMLElement).offsetWidth; card.classList.add("bench-top-pulse"); window.setTimeout(() => card.classList.remove("bench-top-pulse"), 1100); }
  window.history.replaceState(window.history.state, "", "#quality");
}

/**
 * A word for a value, after a short hover or on keyboard focus, or for 2.5 seconds after a tap. Drawn in the window so it never
 * leaves the screen and never makes the page scroll sideways. The same sentence is the item's accessible name when the item is not a link.
 * Its listeners exist only while it is open.
 */
export function Tip({ text, children, focusable = true, className = "", ...rest }: { text: string; children: ReactNode; focusable?: boolean; className?: string } & Omit<HTMLAttributes<HTMLSpanElement>, "children">) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const root = useRef<HTMLSpanElement>(null), bubble = useRef<HTMLSpanElement>(null), timer = useRef<number | undefined>(undefined);
  const close = useCallback(() => { window.clearTimeout(timer.current); setOpen(false); setPos(null); }, []);
  const show = (delay: number) => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setOpen(true), delay); };
  useLayoutEffect(() => {
    if (!open || !root.current || !bubble.current) return;
    const r = root.current.getBoundingClientRect(), w = bubble.current.offsetWidth, h = bubble.current.offsetHeight;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    const below = r.bottom + 6, fitsBelow = below + h <= window.innerHeight - 8, fitsAbove = r.top - h - 6 >= 8;
    setPos({ left, top: fitsBelow || !fitsAbove ? below : Math.max(8, r.top - h - 6) });
  }, [open, text]);
  useEffect(() => {
    if (!open) return;
    const off = (e: Event) => { if (e.type === "keydown" && (e as KeyboardEvent).key !== "Escape") return; close(); };
    window.addEventListener("scroll", off, true); window.addEventListener("keydown", off);
    return () => { window.removeEventListener("scroll", off, true); window.removeEventListener("keydown", off); };
  }, [open, close]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return <span ref={root} className={className} {...(focusable ? { tabIndex: 0, role: "group", "aria-label": text } : {})}
    onPointerEnter={(e) => { if (e.pointerType === "mouse") show(120); }} onPointerLeave={(e) => { if (e.pointerType === "mouse") close(); }}
    onFocus={(e) => { if (e.target.matches(":focus-visible")) show(0); }} onBlur={close}
    onPointerDown={(e) => { if (e.pointerType === "touch") { window.clearTimeout(timer.current); if (open) close(); else { setOpen(true); timer.current = window.setTimeout(close, 2500); } } }}
    {...rest}>
    {children}
    {open && <span ref={bubble} role="tooltip" className="bench-top-tip" style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? "visible" : "hidden" }}>{text}</span>}
  </span>;
}

/** A score out of 100 as a ring, drawn the way the quality panel draws it, and drawn in once on arrival. */
export function Ring({ score, size = 32, stroke = 3 }: { score: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, on = Math.max(0, Math.min(100, score)) / 100;
  const [drawn, setDrawn] = useState(false);
  useEffect(() => { const f = requestAnimationFrame(() => setDrawn(true)); return () => cancelAnimationFrame(f); }, []);
  return <span className="bench-top-ring" style={{ width: size, height: size }} aria-hidden="true">
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} className="bench-top-ring-track" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} className="bench-top-ring-arc" strokeWidth={stroke} strokeDasharray={`${drawn ? c * on : 0} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
    <b className="num" style={{ fontSize: Math.round(size * 0.35) }}>{score}</b>
  </span>;
}

/** The drawn chevron (the same mask the disclosures use), trailing the last word of the text it opens. */
export function Chevron({ open, onClick, label, controls }: { open: boolean; onClick: () => void; label: string; controls?: string }) {
  return <button type="button" className={`bench-top-chev hit ${open ? "is-open" : ""}`} aria-expanded={open} aria-controls={controls} aria-label={label} title={label} onClick={onClick}><i aria-hidden="true" /></button>;
}

/**
 * Text with a control after it that never lands alone on a line: the text's last word (or last element) and the control are one unit
 * that wraps together.
 */
export function Glued({ children, after }: { children: ReactNode; after: ReactNode }) {
  const kids = Children.toArray(children);
  let tail: ReactNode[] = [];
  const last = kids.pop();
  if (typeof last === "string") {
    const i = last.trimEnd().lastIndexOf(" ");
    if (i >= 0) { kids.push(last.slice(0, i + 1)); tail = [last.slice(i + 1)]; }
    else { const prev = kids.pop(); tail = prev == null ? [last] : [prev, last]; }
  } else if (last != null) tail = [last];
  return <>{kids}<span className="bench-top-glue">{tail}{after}</span></>;
}
