"use client";
import { useEffect, useRef, useState } from "react";

export function IndexTabs({ indices, activeId, onSelect, onRename, onAdd, onRemove, labels, reference }: {
  indices: { id: string; name: string }[]; activeId: string;
  onSelect: (id: string) => void; onRename: (id: string, name: string) => void;
  /** Adds a copy of the active index and returns it, so its name opens for renaming. */
  onAdd: () => { id: string; name: string }; onRemove: (id: string) => void;
  /** What each tab shows when that differs from its stored name (the untouched default reads "Default mix"). */
  labels?: Record<string, string>;
  /** A one-click way to add something to compare against, shown beside the + while there is a single index. */
  reference?: { label: string; onAdd: () => void };
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const finished = useRef(false);
  useEffect(() => { triggers.current.get(activeId)?.scrollIntoView({ block: "nearest", inline: "nearest" }); }, [activeId, indices.length]);
  useEffect(() => { if (editing) { input.current?.focus(); input.current?.select(); } }, [editing]);
  const start = (id: string, name: string) => { finished.current = false; onSelect(id); setDraft(name); setEditing(id); };
  const finish = (id: string, save: boolean, restoreFocus: boolean) => {
    if (finished.current) return;
    finished.current = true;
    if (save && draft.trim()) onRename(id, draft.trim());
    setEditing(null);
    if (restoreFocus) requestAnimationFrame(() => triggers.current.get(id)?.focus());
  };
  return (
    <div className="flex items-center gap-1 min-w-0 max-w-full" aria-label="Your indices">
      <span className="text-grey text-[13px] mr-1 shrink-0">Index:</span>
      {/* Tabs scroll sideways when there are many; the + and the reference link stay put so adding is always reachable. */}
      <div className="index-tabs-scroll flex items-center gap-1 min-w-0 overflow-x-auto">
      {indices.map((i) => {
        const on = i.id === activeId;
        return (
          <span key={i.id} className={`group flex items-center gap-1 px-2 py-0.5 rounded-sm ${on ? "text-ink" : "text-grey hover:text-ink-2"}`}>
            {editing === i.id ? <input ref={input} aria-label="Index name" value={draft} size={Math.max(3, Math.min(draft.length, 28))}
              onChange={(e) => setDraft(e.target.value)} onBlur={() => finish(i.id, true, false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); finish(i.id, true, true); }
                if (e.key === "Escape") { e.preventDefault(); finish(i.id, false, true); }
              }}
              className="serif text-[17px] bg-transparent min-w-0 max-w-[220px] px-0.5 border-b border-indigo" /> :
              <button ref={(el) => { if (el) triggers.current.set(i.id, el); else triggers.current.delete(i.id); }} type="button" aria-pressed={on}
                onClick={() => onSelect(i.id)} onDoubleClick={() => start(i.id, i.name)}
                onKeyDown={(e) => { if (e.key === "F2") { e.preventDefault(); start(i.id, i.name); } }}
                className="serif text-[17px] whitespace-nowrap px-0.5 border-b-[1.5px] border-transparent" title="Double-click or press F2 to rename">{labels?.[i.id] ?? i.name}</button>}
            {indices.length > 1 && on && <button type="button" onClick={() => { const next = indices.find((x) => x.id !== i.id); onRemove(i.id); if (next) requestAnimationFrame(() => triggers.current.get(next.id)?.focus()); }} className="cap opacity-70 sm:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:text-ink p-1" aria-label="Remove index">×</button>}
          </span>
        );
      })}
      </div>
      <button type="button" onClick={() => { const added = onAdd(); start(added.id, added.name); }} className="shrink-0 w-6 h-6 rounded-full border hairline grid place-items-center text-grey hover:text-ink hover:border-ink text-[15px] leading-none" title="Copy this index as a new one" aria-label="Copy this index as a new index">+</button>
      {reference && <button type="button" onClick={reference.onAdd} className="cap ml-2 shrink-0 underline-offset-2 hover:underline hover:text-ink whitespace-nowrap">{reference.label}</button>}
    </div>
  );
}
