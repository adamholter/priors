"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { IconInfoCircle, IconLoader2 } from "@tabler/icons-react";
import { useDismiss } from "../use-popover";
import "./model-header.css";

/** A media query as state: false on the server and until the browser answers. */
function useMedia(query: string): boolean {
  return useSyncExternalStore((cb) => { const m = window.matchMedia(query); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); }, () => window.matchMedia(query).matches, () => false);
}
const useReducedMotion = () => useMedia("(prefers-reduced-motion: reduce)");

/** A number that eases to its new value (400ms), so a change of ranking reads as one thing moving. Instant under reduced motion. */
function useTween(target: number, ms = 400): number {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    let raf = 0;
    if (reduced || start === target) { from.current = target; raf = requestAnimationFrame(() => setShown(target)); return () => cancelAnimationFrame(raf); }
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms), v = start + (target - start) * (1 - Math.pow(1 - k, 3));
      from.current = k < 1 ? v : target; setShown(from.current);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, reduced]);
  return shown;
}

/** The score, in mono indigo; it eases to a new value when the ranking changes. `dim` is the loading and error look. */
export function Score({ value, dim = false }: { value: number; dim?: boolean }) {
  const shown = useTween(value);
  return <span className={`num text-[52px] max-sm:text-[44px] leading-none model-head-fade ${dim ? "model-head-dim" : ""}`} style={{ color: "var(--indigo)" }}>{shown.toFixed(1)}</span>;
}

export function Spinner({ size = 16 }: { size?: number }) {
  return <IconLoader2 size={size} stroke={1.75} aria-hidden="true" className="model-head-spin shrink-0 text-grey" />;
}

/** What shows while a model's place is being worked out: the shape of the score and its line, so nothing jumps when it lands. */
export function Computing() {
  return <div className="model-head-in grid gap-2.5 justify-items-end max-sm:justify-items-start" role="status"><span className="sr-only">Working out its place</span><span className="load-bar block h-[44px] w-[132px]" aria-hidden="true" /><span className="load-bar block h-[12px] w-[96px]" aria-hidden="true" /></div>;
}

/**
 * An info icon: opens on hover, focus and tap; closes on Escape or a press elsewhere. The panel sits under the icon and never past
 * the screen's edge: it slides back inside the viewport when the icon is near one.
 */
export function InfoPop({ label, children, align = "right", wide = false }: { label: string; children: ReactNode; align?: "left" | "right"; wide?: boolean }) {
  const [pinned, setPinned] = useState(false), [hover, setHover] = useState(false);
  const box = useRef<HTMLSpanElement>(null), pop = useRef<HTMLSpanElement>(null);
  const close = useCallback(() => { setPinned(false); setHover(false); }, []);
  const open = pinned || hover;
  useDismiss(open, [box], close);
  useLayoutEffect(() => {
    const el = pop.current;
    if (!open || !el) return;
    el.style.marginLeft = el.style.marginRight = "0px";
    const r = el.getBoundingClientRect(), vw = document.documentElement.clientWidth, m = 12;
    const dx = r.left < m ? m - r.left : r.right > vw - m ? vw - m - r.right : 0;
    if (dx) { if (align === "left") el.style.marginLeft = `${dx}px`; else el.style.marginRight = `${-dx}px`; }
  }, [open, align]);
  return (
    <span ref={box} className="relative inline-flex" onMouseEnter={() => { if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) setHover(true); }} onMouseLeave={() => setHover(false)}>
      <button type="button" aria-label={label} aria-expanded={open} onClick={() => setPinned((p) => !p)} onFocus={(e) => { if (e.currentTarget.matches(":focus-visible")) setHover(true); }} onBlur={() => setHover(false)} className="hit inline-grid place-items-center w-[18px] h-[18px] rounded-full text-grey hover:text-ink aria-expanded:text-indigo"><IconInfoCircle size={14} stroke={1.75} aria-hidden="true" /></button>
      {open && <span ref={pop} role="note" className={`model-head-pop absolute top-full pt-1.5 z-40 text-left font-sans normal-case ${wide ? "w-[min(320px,calc(100vw-24px))]" : "w-[min(260px,calc(100vw-24px))]"} ${align === "right" ? "right-0" : "left-0"}`}><span className="block px-3 py-2.5 rounded-md border hairline bg-white text-[12.5px] leading-[1.45] text-ink-2 shadow-[0_8px_28px_var(--shadow)]">{children}</span></span>}
    </span>
  );
}
