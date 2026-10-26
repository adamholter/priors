"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Family } from "@/lib/benchmark-family";

const GearIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>;

/**
 * A benchmark that comes in more than one cut (a category, a prompt, a subset) gets this gear. In the mix it swaps
 * the cut and keeps the weight; in the list it adds the cut you pick.
 */
export function FamilyGear({ family, name, selected, mode, onPick }: { family: Family; name: string; /** Ids from this family already in the mix. */ selected: string[]; mode: "swap" | "add"; onPick: (id: string) => void }) {
  const [at, setAt] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const root = useRef<HTMLSpanElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  // The menu is drawn on the page itself: the browser sheet animates with a transform, which would pin "fixed" to the sheet.
  useEffect(() => {
    if (!at) return;
    const away = (e: PointerEvent) => { const t = e.target as Node; if (!root.current?.contains(t) && !menu.current?.contains(t)) setAt(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setAt(null); root.current?.querySelector("button")?.focus(); } };
    document.addEventListener("pointerdown", away); document.addEventListener("keydown", esc, true);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc, true); };
  }, [at]);
  const toggle = () => {
    if (at) return setAt(null);
    const r = root.current!.getBoundingClientRect(), room = window.innerHeight - r.bottom, need = Math.min(360, family.options.length * 34 + 40);
    setAt({ top: room < need && r.top > room ? r.top - 4 : r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - 240)), up: room < need && r.top > room });
  };
  return <span ref={root} className="family-gear">
    <button type="button" className="bench-icon" aria-haspopup="listbox" aria-expanded={!!at} aria-label={`${name}: choose a category or subset`} title="Categories and subsets" onClick={toggle}><GearIcon /></button>
    {at && createPortal(<div ref={menu} className="family-menu" role="listbox" aria-label={`${name} subsets`} style={{ left: at.left, ...(at.up ? { bottom: window.innerHeight - at.top } : { top: at.top }) }}>
      <p className="cap family-menu-head">{mode === "swap" ? "Rank on" : "Add"}</p>
      <div className="family-menu-list">
        {family.options.map((o) => {
          const on = selected.includes(o.id);
          return <button key={o.id} type="button" role="option" aria-selected={on} className="family-opt" onClick={() => { onPick(o.id); if (mode === "swap") setAt(null); }}>
            <span className={mode === "swap" ? "family-radio" : "family-check"} data-on={on || undefined} aria-hidden="true" /><span>{o.label}</span>
          </button>;
        })}
      </div>
    </div>, document.body)}
  </span>;
}
