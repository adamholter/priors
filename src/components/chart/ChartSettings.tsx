"use client";
import { useId, useRef, useCallback } from "react";

import { useLightDismiss } from "@/hooks/useLightDismiss";

export function ChartSettings({ label, mode, onChange }: { label: string; mode: "all" | "best"; onChange: (mode: "all" | "best") => void }) {
  const id = useId();
  const root = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const dismiss = useCallback((reason: "outside" | "escape") => {
    if (!root.current?.open) return;
    root.current.open = false;
    if (reason === "escape") trigger.current?.focus();
  }, []);
  useLightDismiss(root, dismiss);
  return (
    <details ref={root} className="relative shrink-0" name="chart-settings">
      <summary ref={trigger} aria-label={`${label} settings`} title={`${label} settings`} className="list-none [&::-webkit-details-marker]:hidden cursor-pointer p-1.5 text-grey hover:text-ink rounded-sm focus-visible:outline-indigo">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 6h4m4 0h8M4 12h10m4 0h2M4 18h2m4 0h10" /><circle cx="10" cy="6" r="2" /><circle cx="16" cy="12" r="2" /><circle cx="8" cy="18" r="2" /></svg>
      </summary>
      <div className="absolute right-0 top-full mt-1 w-60 max-w-[85vw] border hairline rounded-sm bg-white p-3 z-20 shadow-sm">
        <label htmlFor={id} className="block text-[12px] text-ink-2 mb-2">Reasoning efforts</label>
        <select id={id} aria-label={`${label} reasoning efforts`} value={mode} onChange={(e) => { onChange(e.target.value as "all" | "best"); dismiss("escape"); }} className="inp">
          <option value="best">Best effort per model</option>
          <option value="all">All reasoning efforts</option>
        </select>
      </div>
    </details>
  );
}
