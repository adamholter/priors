"use client";
import { useEffect, useRef, useState } from "react";
import type { IndexConfig } from "@/engine";

/** "Index: General frontier  +" — the name is double-click editable, one line, no cards. */
export function IndexTabs({ indices, activeId, onSelect, onRename, onAdd, onRemove }: {
  indices: IndexConfig[]; activeId: string; onSelect: (id: string) => void; onRename: (id: string, name: string) => void; onAdd: () => void; onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => { if (editing && ref.current) { ref.current.focus(); document.getSelection()?.selectAllChildren(ref.current); } }, [editing]);
  const commit = (id: string) => { const v = ref.current?.textContent?.trim(); if (v) onRename(id, v); setEditing(null); };
  return (
    <div className="flex items-center gap-1 min-w-0">
      <span className="text-grey text-[13px] mr-1">Index:</span>
      {indices.map((i) => {
        const on = i.id === activeId;
        return (
          <span key={i.id} className={`group flex items-center gap-1 px-2 py-0.5 rounded-sm ${on ? "text-ink" : "text-grey hover:text-ink-2"}`}>
            <span ref={editing === i.id ? ref : undefined} role="button" tabIndex={0}
              contentEditable={editing === i.id} suppressContentEditableWarning spellCheck={false}
              onClick={() => onSelect(i.id)} onDoubleClick={() => { onSelect(i.id); setEditing(i.id); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(i.id); } if (e.key === "Escape") setEditing(null); }}
              onBlur={() => editing === i.id && commit(i.id)}
              className="serif text-[17px] whitespace-nowrap px-0.5 border-b-[1.5px] border-transparent" title="Double-click to rename">{i.name}</span>
            {indices.length > 1 && on && <button type="button" onClick={() => onRemove(i.id)} className="cap opacity-0 group-hover:opacity-100 hover:text-ink" aria-label="Remove index">×</button>}
          </span>
        );
      })}
      <button type="button" onClick={onAdd} className="w-6 h-6 rounded-full border hairline grid place-items-center text-grey hover:text-ink hover:border-ink text-[15px] leading-none" title="Add an index" aria-label="Add an index">+</button>
    </div>
  );
}
