"use client";
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

/** While `open`: a press outside every `inside` element, or Esc, calls `close`; Esc then calls `onEscape` (to hand focus back). */
export function useDismiss(open: boolean, inside: RefObject<HTMLElement | null>[], close: () => void, onEscape?: () => void) {
  const latest = useRef({ inside, close, onEscape });
  useEffect(() => { latest.current = { inside, close, onEscape }; });
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!latest.current.inside.some((r) => r.current?.contains(e.target as Node))) latest.current.close(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { latest.current.close(); latest.current.onEscape?.(); } };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", key); };
  }, [open]);
}

/** Keeps an absolutely placed popover on screen: sets `--shift` (apply it to `left`, so the page never gains a sideways scroll) as far as it would run past the right edge. */
export function useKeepOnScreen(open: boolean, ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!open || !el) return;
    el.style.setProperty("--shift", "0px");
    const r = el.getBoundingClientRect(), over = r.right - (document.documentElement.clientWidth - 16);
    if (over > 0) el.style.setProperty("--shift", `${-Math.min(over, Math.max(0, r.left - 16))}px`);
  }, [open, ref]);
}
