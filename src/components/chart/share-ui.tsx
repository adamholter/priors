"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent, type FocusEvent as RFocusEvent, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { IconAlertTriangle } from "@tabler/icons-react";

/** Keeps a popover mounted through its exit so it can fade out: `shown` is the visual state, `mounted` the DOM one. */
export function usePresence(open: boolean, exitMs = 90) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    if (open) { const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true))); return () => cancelAnimationFrame(r); }
    const off = requestAnimationFrame(() => setShown(false));
    const t = setTimeout(() => setMounted(false), exitMs);
    return () => { cancelAnimationFrame(off); clearTimeout(t); };
  }, [open, exitMs]);
  return { mounted: mounted || open, shown: shown && open };
}

export function usePop() {
  const [open, setOpen] = useState(false);
  const [kb, setKb] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  // `detail` is 0 for a click made with the keyboard: then focus moves into the menu.
  const toggle = useCallback((e: { detail: number }) => { setKb(e.detail === 0); setOpen((o) => !o); }, []);
  const show = useCallback((byKey = false) => { setKb(byKey); setOpen(true); }, []);
  return { open, close, toggle, show, kb };
}
export type Pop = ReturnType<typeof usePop>;

const ITEMS = '[role="menuitem"]:not(:disabled):not([aria-disabled="true"])';
/** Arrow, Home and End move through the items of a menu. Returns true when it handled the key. */
export function menuKeys(e: RKeyboardEvent<HTMLElement>, root: HTMLElement | null) {
  if (!root || !["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return false;
  const items = [...root.querySelectorAll<HTMLElement>(ITEMS)].filter((n) => n.offsetParent !== null && !n.closest("[inert]"));
  if (!items.length) return false;
  e.preventDefault();
  const at = items.indexOf(document.activeElement as HTMLElement);
  const to = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
  items[to].focus();
  return true;
}

/** A menu anchored under its trigger (the one `[aria-haspopup]` in the same `.chart-share`): fades in over 140ms, out over 90ms, stays inside the gutters, flips up near the bottom, closes on Escape, Tab and a press outside. */
export function Pop({ pop, label, className = "", children }: { pop: Pop; label: string; className?: string; children: ReactNode }) {
  const { open, close, kb } = pop;
  const { mounted, shown } = usePresence(open, 90);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useCallback(() => root.current?.closest(".chart-share")?.querySelector<HTMLElement>("[aria-haspopup]") ?? null, []);
  // Measure at rest, one read then one write: the entry transform shrinks the box a little and would leave it short of the gutter.
  useLayoutEffect(() => {
    const el = root.current;
    if (!mounted || !el) return;
    el.removeAttribute("data-up"); el.style.setProperty("--share-shift", "0px"); el.style.transform = "none";
    const r = el.getBoundingClientRect(), vw = document.documentElement.clientWidth, m = 12, t = trigger()?.getBoundingClientRect();
    el.style.removeProperty("transform");
    el.style.setProperty("--share-shift", `${Math.round(r.left < m ? m - r.left : r.right > vw - m ? vw - m - r.right : 0)}px`);
    if (t && t.top >= 0 && t.bottom <= innerHeight && r.bottom > innerHeight - 8 && t.top - r.height - 12 > 8) el.setAttribute("data-up", "");
  }, [mounted, trigger]);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { const t = e.target as Node; if (!root.current?.contains(t) && !trigger()?.contains(t)) close(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); close(); trigger()?.focus(); } };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("pointerdown", down, true); document.removeEventListener("keydown", key, true); };
  }, [open, close, trigger]);
  useEffect(() => { if (shown && kb) root.current?.querySelector<HTMLElement>(ITEMS)?.focus({ preventScroll: true }); }, [shown, kb]);
  if (!mounted) return null;
  return <div ref={root} className={`chart-share-pop ${className}`} data-shown={shown || undefined} role="menu" aria-label={label} inert={!open}
    onKeyDown={(e) => { if (e.key === "Tab") { trigger()?.focus(); close(); } else menuKeys(e, root.current); }}>{children}</div>;
}

/** Text that keeps its last value while it fades out. */
function useKept(v: string) {
  const [last, setLast] = useState(v);
  if (v && v !== last) setLast(v);
  return v || last;
}

export type Say = { id: number; kind: string; text: string; tone: "ok" | "err" };

/** The confirmation (and the hover name) under a control. It never moves layout: it hangs off the cluster. */
export function Label({ say, name }: { say: Say | null; name?: string | null }) {
  const text = say?.text ?? name ?? "";
  const kept = useKept(text);
  return <>
    <span className="chart-share-label" data-on={text ? "" : undefined} data-tone={say ? say.tone : "hint"} aria-hidden="true">{kept}</span>
    <span role="status" className="sr-only">{say?.text ?? ""}</span>
  </>;
}

/** Hover and keyboard names for icon-only controls, shown after 500ms in the cluster's label. Touch shows none. */
export function useNames() {
  const [name, setName] = useState<string | null>(null);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const clear = useCallback(() => { clearTimeout(timer.current); setName(null); }, []);
  const bind = useCallback((label: string) => ({
    onPointerEnter: (e: RPointerEvent) => { if (e.pointerType !== "mouse") return; clearTimeout(timer.current); timer.current = window.setTimeout(() => setName(label), 500); },
    onPointerLeave: clear,
    onPointerDown: clear,
    onFocus: (e: RFocusEvent<HTMLElement>) => { if (e.currentTarget.matches(":focus-visible")) setName(label); },
    onBlur: () => setName(null),
  }), [clear]);
  return { name, clear, bind };
}

/** The drawn check for a success, a warning triangle for a failure: a red check would read as done. */
export function Check({ size = 16, tone }: { size?: number; tone?: "danger" }) {
  if (tone === "danger") return <IconAlertTriangle className="chart-share-alert" size={size} stroke={1.8} aria-hidden="true" />;
  return <svg className="chart-share-check" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path pathLength="1" d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
}
export const Ring = ({ size = 14 }: { size?: number }) => <span className="chart-share-ring" style={{ width: size, height: size }} aria-hidden="true" />;
export const Chev = () => <span className="chart-share-chev" aria-hidden="true" />;

/** Crossfades between two glyphs. `b` mounts on demand so its drawn check restarts every time. */
export function Swap({ on, a, b, exit = 160 }: { on: boolean; a: ReactNode; b: ReactNode; exit?: number }) {
  const { mounted } = usePresence(on, exit);
  return <span className="chart-share-swap" data-on={on || undefined}><span className="chart-share-swap-a">{a}</span><span className="chart-share-swap-b">{mounted && b}</span></span>;
}
