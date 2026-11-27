"use client";
import { useEffect, useRef, useState } from "react";
import { IconCheck, IconChevronDown, IconPencil, IconPlus, IconX } from "@tabler/icons-react";

/**
 * The ranking's title is the mix's name; clicking it opens the mixes you have open (switch by clicking one), a new mix (a copy of this
 * one, as the tabs' + makes), renaming this one in place, and closing it. From Faye Quepeerzade's header mockups (November 2026).
 */
export function MixMenu({ indices, activeId, onSelect, onAdd, onRename, onRemove }: {
  indices: { id: string; name: string }[]; activeId: string;
  onSelect: (id: string) => void; onAdd: () => { id: string; name: string }; onRename: (id: string, name: string) => void; onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false), [renaming, setRenaming] = useState(false), [draft, setDraft] = useState("");
  const box = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const active = indices.find((i) => i.id === activeId) ?? indices[0];
  const close = () => { setOpen(false); setRenaming(false); };
  const cut = active.name.lastIndexOf(" ") + 1, head = active.name.slice(0, cut), tail = active.name.slice(cut);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) close(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { close(); trigger.current?.focus(); } };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", key); };
  }, [open]);
  useEffect(() => { if (renaming) input.current?.select(); }, [renaming]);
  const startRename = (name: string) => { setDraft(name); setRenaming(true); };
  const commit = () => { const name = draft.trim(); if (name && name !== active.name) onRename(active.id, name); close(); };
  const item = "flex w-full items-center gap-2.5 px-3 py-2 rounded text-left text-[13.5px] text-ink-2 hover:bg-hair-2 hover:text-ink";
  return <div ref={box} className="relative inline-block max-w-full">
    <button ref={trigger} type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}
      className="mix-menu-trigger -mx-2 px-2 py-0.5 rounded-md hover:bg-hair-2 text-left" title="Switch, rename or add a mix">
      {/* The chevron stays on the line with the name's last word, however the title wraps. */}
      {head}<span className="whitespace-nowrap">{tail}<IconChevronDown size={18} stroke={1.75} aria-hidden="true" className="ml-1.5 text-grey" style={{ display: "inline-block", verticalAlign: "middle" }} /></span>
    </button>
    {open && <div role="menu" aria-label="Mixes" className="absolute left-0 top-full mt-2 z-50 w-[min(340px,calc(100vw-32px))] grid gap-0.5 p-1.5 bg-white border hairline rounded-lg shadow-[0_18px_40px_-18px_var(--shadow)] font-sans">
      <p className="cap px-3 pt-1.5 pb-1">Open mixes</p>
      {indices.map((i) => i.id === active.id && renaming
        ? <form key={i.id} className="px-1.5 py-1" onSubmit={(e) => { e.preventDefault(); commit(); }}>
          <input ref={input} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} aria-label="Mix name" maxLength={80}
            className="w-full h-9 px-2.5 rounded-md border border-ink bg-white text-[14px] text-ink outline-none" />
        </form>
        : <button key={i.id} type="button" role="menuitemradio" aria-checked={i.id === active.id} onClick={() => { onSelect(i.id); close(); }} className={`${item} ${i.id === active.id ? "text-ink" : ""}`}>
          <span className="min-w-0 flex-1 truncate font-serif text-[15px]">{i.name}</span>{i.id === active.id && <IconCheck size={16} stroke={2} aria-hidden="true" className="text-indigo" />}
        </button>)}
      <div className="h-px bg-hair my-1" role="separator" />
      <button type="button" role="menuitem" className={item} onClick={() => { const n = onAdd(); setDraft(n.name); setRenaming(true); }}><IconPlus size={16} stroke={1.75} aria-hidden="true" />New mix</button>
      <button type="button" role="menuitem" className={item} onClick={() => startRename(active.name)}><IconPencil size={16} stroke={1.75} aria-hidden="true" />Rename this mix</button>
      {indices.length > 1 && <button type="button" role="menuitem" className={item} onClick={() => { onRemove(active.id); close(); }}><IconX size={16} stroke={1.75} aria-hidden="true" />Close this mix</button>}
    </div>}
  </div>;
}
