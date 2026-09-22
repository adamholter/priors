"use client";
import { useId, useRef, useCallback } from "react";

import { useLightDismiss } from "@/hooks/useLightDismiss";

export function ChartSettings({ label, mode, onChange, models, excluded, onToggleModel }: {
  label: string; mode: "all" | "best"; onChange: (mode: "all" | "best") => void;
  /** Model picker: ranked-order list + the index's excluded set. */
  models?: { id: string; name: string; color?: string }[];
  excluded?: Set<string>;
  onToggleModel?: (id: string) => void;
}) {
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
        {models && onToggleModel && <>
          <p className="text-[12px] text-ink-2 mt-3 mb-1.5">Models{excluded?.size ? <span className="text-grey"> · {excluded.size} hidden</span> : ""}</p>
          <div className="max-h-56 overflow-y-auto overscroll-contain -mx-1 px-1">
            {models.map((m) => (
              <label key={m.id} className="flex items-center gap-2 py-[3px] text-[12.5px] cursor-pointer rounded-sm hover:bg-bone">
                <input type="checkbox" className="accent-[#2F4FB0] shrink-0" checked={!excluded?.has(m.id)} onChange={() => onToggleModel(m.id)} />
                {m.color && <i className="w-2 h-2 rounded-full shrink-0" style={{ background: m.color }} aria-hidden="true" />}
                <span className="truncate">{m.name}</span>
              </label>
            ))}
          </div>
        </>}
      </div>
    </details>
  );
}
