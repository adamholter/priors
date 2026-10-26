"use client";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import { storableIndex, type Section } from "../../../convex/validators";
import type { Profile } from "./IndexPage";
import { midCode } from "@/lib/konami";
import { IconArrowDown, IconArrowLeft, IconArrowRight, IconArrowUp, IconEye, IconEyeOff, IconGripVertical, IconPlus, IconStar, IconTrash } from "@tabler/icons-react";

/** Reports whether the signed-in user owns this page. Mounted only when auth is configured. */
export function OwnerProbe({ handle, onOwner }: { handle: string; onOwner: (owner: boolean) => void }) {
  const { isAuthenticated } = useConvexAuth();
  const mine = useQuery(api.profiles.mine, isAuthenticated ? {} : "skip");
  const owner = !!mine && mine.handle === handle;
  useEffect(() => { onOwner(owner); }, [owner, onOwner]);
  return null;
}

export type SaveState = "saved" | "saving" | "error" | "dirty";
const SOCIAL_STUBS = ["https://", "https://x.com/", "https://github.com/", "https://linkedin.com/in/"];

/** Saves page edits a moment after they stop. Mounted only while the owner edits. */
export function Autosave({ profile, onState }: { profile: Profile; onState: (s: SaveState) => void }) {
  const update = useMutation(api.profiles.update);
  const first = useRef(true);
  const { displayName, bio, socials, indices, sections, theme } = profile;
  const key = JSON.stringify({ displayName, bio, socials, indices, sections, theme });
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    onState("dirty");
    const t = setTimeout(() => {
      onState("saving");
      update({ patch: { displayName, bio, socials: socials?.filter((x) => x.url && !SOCIAL_STUBS.includes(x.url.trim())), indices: indices.map(storableIndex), sections, theme } })
        .then(() => onState("saved"))
        .catch((e) => { console.error("Page save failed", e); onState("error"); });
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

/** Edit chrome around one section: a toolbar row (drag, move, hide, remove) above the live section. */
export function SectionFrame({ section, index, count, label, onMove, onPatch, onRemove, onDrop, children }: {
  section: Section; index: number; count: number; label: string;
  onMove: (to: number) => void; onPatch: (p: Partial<Section>) => void; onRemove: () => void; onDrop: (from: number) => void; children: ReactNode;
}) {
  const [over, setOver] = useState(false);
  return <div className={`edit-frame ${section.hidden ? "is-hidden" : ""} ${over ? "is-over" : ""}`}
    onDragOver={(e) => { if (e.dataTransfer.types.includes("text/x-priors-section")) { e.preventDefault(); setOver(true); } }}
    onDragLeave={() => setOver(false)}
    onDrop={(e) => { setOver(false); const from = Number(e.dataTransfer.getData("text/x-priors-section")); if (Number.isFinite(from) && from !== index) onDrop(from); }}>
    <div className="edit-toolbar" role="toolbar" aria-label={`${label} section`}>
      <span className="edit-handle" draggable title="Drag to reorder" aria-hidden="true" onDragStart={(e) => { e.dataTransfer.setData("text/x-priors-section", String(index)); e.dataTransfer.effectAllowed = "move"; }}><IconGripVertical size={16} /></span>
      <span className="edit-kind">{label}</span>
      {section.hidden && <span className="edit-note">Hidden from visitors</span>}
      <span className="edit-tools">
        <button type="button" className="edit-icon" aria-label="Move up" title="Move up" disabled={index === 0} onClick={() => onMove(index - 1)}><IconArrowUp size={16} /></button>
        <button type="button" className="edit-icon" aria-label="Move down" title="Move down" disabled={index === count - 1} onClick={() => onMove(index + 1)}><IconArrowDown size={16} /></button>
        <button type="button" className="edit-btn" onClick={() => onPatch({ hidden: !section.hidden })}>{section.hidden ? <IconEye size={15} /> : <IconEyeOff size={15} />}{section.hidden ? "Show" : "Hide"}</button>
        <button type="button" className="edit-icon is-danger" aria-label={`Remove ${label} section`} title="Remove section" onClick={onRemove}><IconTrash size={16} /></button>
      </span>
    </div>
    <div className="edit-body">{children}</div>
  </div>;
}

/**
 * The page's indices as tabs. Left and right move between them while a tab has focus, except for a
 * press that belongs to the Konami code. While editing, the open tab can be renamed, moved (the first
 * is the page's main index) or removed.
 */
export function PageTabs({ indices, activeId, accent, editing, onSelect, onRename, onMove, onRemove }: {
  indices: { id: string; name: string }[]; activeId: string; accent: string; editing: boolean;
  onSelect: (id: string) => void; onRename: (id: string, name: string) => void; onMove: (id: string, by: number) => void; onRemove: (id: string) => void;
}) {
  const at = indices.findIndex((i) => i.id === activeId);
  const list = useRef<HTMLDivElement>(null);
  const onKey = (e: React.KeyboardEvent) => {
    if (!(e.target as HTMLElement).matches("button[role=tab]") || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || midCode(e.key)) return;
    const to = e.key === "ArrowRight" ? (at + 1) % indices.length : e.key === "ArrowLeft" ? (at - 1 + indices.length) % indices.length : e.key === "Home" ? 0 : e.key === "End" ? indices.length - 1 : -1;
    if (to < 0 || to === at) return;
    e.preventDefault();
    onSelect(indices[to].id);
    // Focus follows the open tab once it has rendered as the selected one.
    requestAnimationFrame(() => list.current?.querySelector<HTMLElement>("[aria-selected=true]")?.focus());
  };
  return <div className={`page-tabs ${editing ? "is-editing" : ""}`}>
    <div ref={list} className="page-tabs-list" role="tablist" aria-label="Indices" onKeyDown={onKey}>
      {indices.map((i) => {
        const on = i.id === activeId;
        return on && editing
          ? <span key={i.id} className="page-tab serif" aria-current="true" style={{ borderColor: accent }}><InlineText editing label="Index name" value={i.name} placeholder="Index name" onChange={(name) => onRename(i.id, name)} /></span>
          : <button key={i.id} type="button" role="tab" aria-selected={on} tabIndex={on || editing ? 0 : -1} className="page-tab serif" style={on ? { borderColor: accent } : undefined} onClick={() => onSelect(i.id)}>{i.name || "Untitled"}</button>;
      })}
    </div>
    {editing && <div className="edit-toolbar page-tabs-tools" role="toolbar" aria-label="This index">
      <span className="edit-kind">{at === 0 ? "Main index" : "Index"}</span>
      <span className="edit-note">{at === 0 ? "Leads the page, its link preview and its Explore card" : "Rename it in the tab above"}</span>
      <span className="edit-tools">
        {at > 0 && <button type="button" className="edit-btn" title="The main index leads the page, its link preview and its Explore card" onClick={() => onMove(activeId, -at)}><IconStar size={15} />Make main</button>}
        <button type="button" className="edit-icon" aria-label="Move index left" title="Move left" disabled={at <= 0} onClick={() => onMove(activeId, -1)}><IconArrowLeft size={16} /></button>
        <button type="button" className="edit-icon" aria-label="Move index right" title="Move right" disabled={at === indices.length - 1} onClick={() => onMove(activeId, 1)}><IconArrowRight size={16} /></button>
        <button type="button" className="edit-btn is-danger" onClick={() => onRemove(activeId)}><IconTrash size={15} />Remove from page</button>
      </span>
    </div>}
  </div>;
}

export const SECTION_KINDS: { kind: Exclude<Section["kind"], "history">; label: string }[] = [
  { kind: "rankings", label: "Leaderboard" }, { kind: "pareto", label: "Score vs cost" }, { kind: "speed", label: "Score vs speed" },
  { kind: "gallery", label: "More metrics" }, { kind: "benchmark", label: "Benchmark table" }, { kind: "text", label: "Text" }, { kind: "links", label: "Links" },
];

/** An insertion point between sections. Only the button takes clicks, so it never covers other controls. */
export function AddSection({ onAdd }: { onAdd: (kind: Exclude<Section["kind"], "history">) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  return <div className={`edit-insert ${open ? "is-open" : ""}`}>
    <div ref={box} className="edit-insert-box">
      <button type="button" className="edit-insert-btn" aria-expanded={open} onClick={() => setOpen(!open)}><IconPlus size={14} />Add section</button>
      {open && <div className="edit-insert-menu" role="menu">{SECTION_KINDS.map((k) => <button key={k.kind} type="button" role="menuitem" onClick={() => { onAdd(k.kind); setOpen(false); }}>{k.label}</button>)}</div>}
    </div>
  </div>;
}

/** Keeps password managers from decorating page text fields (they read as login fields otherwise). */
const NO_AUTOFILL = { autoComplete: "off", "data-1p-ignore": "", "data-lpignore": "true", "data-bwignore": "", "data-form-type": "other" };

/** Text that turns into an input while editing, styled like the text it replaces. */
export function InlineText({ value, placeholder, onChange, multiline, className, editing, label }: { value: string; placeholder?: string; onChange: (v: string) => void; multiline?: boolean; className?: string; editing: boolean; label: string }) {
  if (!editing) return value ? <span className={className}>{value}</span> : null;
  if (multiline) return <textarea {...NO_AUTOFILL} aria-label={label} className={`inline-edit ${className ?? ""}`} value={value} placeholder={placeholder} rows={Math.max(2, value.split("\n").length)} onChange={(e) => onChange(e.target.value)} />;
  return <input {...NO_AUTOFILL} aria-label={label} className={`inline-edit ${className ?? ""}`} value={value} placeholder={placeholder} size={Math.max(8, (value || placeholder || "").length + 1)} onChange={(e) => onChange(e.target.value)} />;
}
