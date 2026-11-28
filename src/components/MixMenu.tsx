"use client";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import { IconArrowsSort, IconChartPie, IconCheck, IconChevronDown, IconPencil, IconPlus, IconRestore, IconX } from "@tabler/icons-react";
import type { Snapshot } from "@/data/types";
import { computeIndex, PAGE_VIEW, rankingRows, type IndexConfig } from "@/engine";
import { isPristineDefault } from "@/lib/default-index";
import { usePlanResetsOn, withResetsPref } from "@/lib/plan-resets-pref";
import { useSubscriptionPlansPref, withPlansPref } from "@/lib/subscription-plans-pref";
import { LabLogo } from "./LabLogo";
import { openCopyOf, tabPageKey, type PageMixes } from "@/lib/page-mixes";
import { useDismiss, useKeepOnScreen } from "./use-popover";
import "./mix-menu.css";

type Top = { labId: string; name: string };
const NO_MIXES: IndexConfig[] = [];

/** The three leading labs of each mix, worked out after the menu has opened and only when there is more than one mix to compare. */
function useTopThree(snapshot: Snapshot, indices: IndexConfig[]) {
  const resetsOn = usePlanResetsOn(), plansPref = useSubscriptionPlansPref();
  const configs = useDeferredValue(indices.length > 1 ? indices : NO_MIXES, NO_MIXES);
  return useMemo(() => {
    const out: Record<string, Top[]> = {};
    for (const cfg of configs) {
      out[cfg.id] = [];
      if (!Object.values(cfg.weights).some((w) => w > 0)) continue;
      try {
        const r = computeIndex(snapshot, { ...withPlansPref(withResetsPref(cfg, resetsOn), plansPref), variants: "all" }, PAGE_VIEW);
        out[cfg.id] = rankingRows(r.ranked, cfg).slice(0, 3).map((x) => ({ labId: x.model.labId, name: x.model.name }));
      } catch { /* a mix that cannot be scored has no leaders to show */ }
    }
    return out;
  }, [snapshot, configs, resetsOn, plansPref]);
}

type MenuProps = {
  snapshot: Snapshot; indices: IndexConfig[]; active: IndexConfig; mixOpen: boolean; openMix: () => void;
  onSelect: (id: string) => void; onRename: (id: string, name: string) => void; onRemove: (id: string) => void;
  /** Adds a copy of the active mix, named from its benchmarks, selects it and returns it. */
  onAdd: () => { id: string; name: string };
  /** The signed-in visitor's page: its mixes that are not open here are listed below the open ones, and picking one opens it. */
  page?: PageMixes | null; onOpenPage?: (mix: IndexConfig) => void;
};

function MixPanel({ snapshot, indices, active, mixOpen, openMix, onSelect, onAdd, onRename, onRemove, page, onOpenPage, onClose, anchor }: MenuProps & { onClose: (restoreFocus: boolean) => void; anchor: RefObject<HTMLElement | null> }) {
  const [renaming, setRenaming] = useState(false), [draft, setDraft] = useState("");
  const panel = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null);
  const tops = useTopThree(snapshot, indices);
  // Leaders say something only where the mixes disagree about them: the same three logos on every row would be noise.
  const leaders = (id: string) => (tops[id] ?? []).map((t) => t.labId).join();
  const varied = indices.length > 1 && new Set(indices.map((i) => leaders(i.id))).size > 1;
  useDismiss(true, [panel, anchor], () => onClose(false), () => onClose(true));
  useKeepOnScreen(true, panel);
  useEffect(() => {
    const first = panel.current?.querySelector<HTMLElement>('[aria-checked="true"]') ?? panel.current?.querySelector<HTMLElement>('[role^="menuitem"]');
    first?.focus({ preventScroll: true });
  }, []);
  useEffect(() => { if (renaming) input.current?.select(); }, [renaming]);
  const close = (restore = false) => { setRenaming(false); onClose(restore); };
  const commit = (restore = false) => { const name = draft.trim(); if (name && name !== active.name) onRename(active.id, name); close(restore); };
  const lone = indices.length === 1;
  const [key] = useState(tabPageKey);
  const onPage = page && onOpenPage ? page.indices.filter((m) => !openCopyOf(indices, page, m, key)) : [];
  // Arrow keys, Home and End move through the rows; a letter jumps to the next row that starts with it; Tab leaves the menu.
  const keys = (e: ReactKeyboardEvent) => {
    const items = [...(panel.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
    if (!items.length || (e.target as HTMLElement).tagName === "INPUT") return;
    const at = items.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => { e.preventDefault(); items[(i + items.length) % items.length].focus(); };
    if (e.key === "ArrowDown") go(at + 1);
    else if (e.key === "ArrowUp") go(at < 0 ? items.length - 1 : at - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(items.length - 1);
    else if (e.key === "Tab") onClose(false);
    else if (e.key.length === 1 && /\S/.test(e.key) && !e.metaKey && !e.ctrlKey) {
      const k = e.key.toLowerCase();
      for (let o = 1; o <= items.length; o++) { const el = items[(at + o) % items.length]; if (el.textContent?.trim().toLowerCase().startsWith(k)) { el.focus(); break; } }
    }
  };
  const icon = { size: 16, stroke: 1.75, "aria-hidden": true } as const;
  return <div ref={panel} role="menu" aria-label="Mixes" className="mix-menu-panel" onKeyDown={keys}>
    <div className="mix-menu-list">
      {indices.map((i) => i.id === active.id && renaming
        ? <form key={i.id} className="mix-menu-rename" onSubmit={(e) => { e.preventDefault(); commit(true); }}>
          <input ref={input} autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => commit()} aria-label="Mix name" maxLength={80} />
        </form>
        : <button key={i.id} type="button" role="menuitemradio" aria-checked={i.id === active.id} tabIndex={-1} title={i.name} onClick={() => { onSelect(i.id); close(true); }} className="mix-menu-item">
          <span className="mix-menu-name">{i.name}</span>
          {varied && <span className="mix-menu-tops" role="img" aria-label={tops[i.id]?.length ? `Top 3: ${tops[i.id].map((t) => t.name).join(", ")}` : "No ranking"}>
            {(tops[i.id] ?? []).map((t, k) => { const lab = snapshot.labs.find((l) => l.id === t.labId); return <LabLogo key={k} lab={t.labId} name={lab?.name ?? t.labId} color={lab?.color} size={14} />; })}
          </span>}
          <span className="mix-menu-check">{i.id === active.id && <IconCheck size={16} stroke={2} aria-hidden="true" />}</span>
        </button>)}
      {onPage.length > 0 && <>
        <div className="mix-menu-sep" role="separator" />
        <div className="mix-menu-label" role="presentation">On @{page!.handle}</div>
        {onPage.map((m) => <button key={m.id} type="button" role="menuitem" tabIndex={-1} title={`Open ${m.name}`} onClick={() => { onOpenPage!(m); close(true); }} className="mix-menu-item">
          <span className="mix-menu-name">{m.name}</span>
        </button>)}
      </>}
    </div>
    <div className="mix-menu-sep" role="separator" />
    <button type="button" role="menuitem" tabIndex={-1} className="mix-menu-item" onClick={() => { const n = onAdd(); setDraft(n.name); setRenaming(true); }}><IconPlus {...icon} />New mix</button>
    <button type="button" role="menuitem" tabIndex={-1} className="mix-menu-item" onClick={() => { setDraft(active.name); setRenaming(true); }}><IconPencil {...icon} />Rename this mix</button>
    {!lone && <button type="button" role="menuitem" tabIndex={-1} className="mix-menu-item" onClick={() => { onRemove(active.id); close(true); }}><IconX {...icon} />Close this mix</button>}
    {lone && !isPristineDefault(active) && <button type="button" role="menuitem" tabIndex={-1} className="mix-menu-item" onClick={() => { onRemove(active.id); close(true); }}><IconRestore {...icon} />Reset to the default mix</button>}
    <div className="mix-menu-sep" role="separator" />
    <Link href="/rank" role="menuitem" tabIndex={-1} className="mix-menu-item" transitionTypes={["nav-forward"]}><IconArrowsSort {...icon} />Rank models</Link>
    {!mixOpen && <button type="button" role="menuitem" tabIndex={-1} className="mix-menu-item" onClick={() => { openMix(); close(false); }}><IconChartPie {...icon} />Change the mix</button>}
  </div>;
}

/**
 * The ranking's title is the mix's name; clicking it opens the mixes you have open (switch by clicking one), a new mix (a copy of this one),
 * the mixes saved on your page that are not open yet, renaming this one in place, closing it (or resetting the only one), and the two ways to make your own: Rank models and Change the mix.
 * From Faye Quepeerzade's header mockups (November 2026).
 */
export function MixMenu(props: MenuProps) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const name = props.active.name, cut = name.lastIndexOf(" ") + 1, head = name.slice(0, cut), tail = name.slice(cut);
  return <div ref={box} className="relative inline-block max-w-full">
    <button ref={trigger} type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}
      className="mix-menu-trigger -mx-2 px-2 py-0.5 rounded-md hover:bg-hair-2 text-left" title="Switch, rename or add a mix">
      {/* The chevron stays on the line with the name's last word, however the title wraps. */}
      {head}<span className="whitespace-nowrap">{tail}<IconChevronDown size={18} stroke={1.75} aria-hidden="true" className="ml-1.5 text-grey" style={{ display: "inline-block", verticalAlign: "middle" }} /></span>
    </button>
    {open && <MixPanel {...props} anchor={box} onClose={(restore) => { setOpen(false); if (restore) trigger.current?.focus(); }} />}
  </div>;
}
