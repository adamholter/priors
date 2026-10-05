"use client";
import { useEffect, useRef, useState } from "react";
import { ChartExpandIcon } from "./ChartIcons";

/**
 * Expands a chart in place to fill most of the viewport (fixed overlay, Escape or backdrop closes).
 * The chart stays mounted, so ECharts just resizes via its ResizeObserver.
 */
export function useChartExpand(name: string) {
  const [expanded, setExpanded] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector('details[name="chart-settings"][open], .chart-context-menu')) close(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [expanded]);
  function close() { setExpanded(false); requestAnimationFrame(() => trigger.current?.focus()); }
  const button = (
    <button ref={trigger} type="button" className="p-1.5 text-grey hover:text-ink rounded-sm focus-visible:outline-indigo" aria-label={expanded ? `Close expanded ${name}` : `Expand ${name}`} title={expanded ? "Close (Esc)" : "Expand"} aria-expanded={expanded} onClick={() => (expanded ? close() : setExpanded(true))}>
      {expanded
        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        : <ChartExpandIcon />}
    </button>
  );
  const backdrop = expanded ? <div className="chart-expand-backdrop" aria-hidden="true" onClick={close} /> : null;
  return { expanded, button, backdrop, close };
}
