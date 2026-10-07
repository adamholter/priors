"use client";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import { storableIndex, type Section } from "../../../convex/validators";
import type { Profile } from "./IndexPage";

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

/** Edit chrome around one section: drag handle, move, hide and remove. The section itself stays live. */
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
      <span className="edit-handle" draggable title="Drag to reorder" aria-hidden="true" onDragStart={(e) => { e.dataTransfer.setData("text/x-priors-section", String(index)); e.dataTransfer.effectAllowed = "move"; }}>
        <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">{[2, 7, 12].flatMap((y) => [2.5, 7.5].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" />))}</svg>
      </span>
      <span className="edit-kind">{label}</span>
      <button type="button" className="edit-icon" aria-label="Move up" disabled={index === 0} onClick={() => onMove(index - 1)}>↑</button>
      <button type="button" className="edit-icon" aria-label="Move down" disabled={index === count - 1} onClick={() => onMove(index + 1)}>↓</button>
      <button type="button" className="edit-chip" aria-pressed={!section.hidden} onClick={() => onPatch({ hidden: !section.hidden })}>{section.hidden ? "Hidden" : "Shown"}</button>
      <button type="button" className="edit-icon" aria-label="Remove section" onClick={onRemove}>×</button>
    </div>
    <div className="edit-body">{children}</div>
  </div>;
}

export const SECTION_KINDS: { kind: Exclude<Section["kind"], "history">; label: string }[] = [
  { kind: "rankings", label: "Leaderboard" }, { kind: "pareto", label: "Score vs cost" }, { kind: "speed", label: "Score vs speed" },
  { kind: "gallery", label: "More metrics" }, { kind: "benchmark", label: "Benchmark table" }, { kind: "text", label: "Text" }, { kind: "links", label: "Links" },
];

/** A thin "+" between sections that opens the section menu. */
export function AddSection({ onAdd }: { onAdd: (kind: Exclude<Section["kind"], "history">) => void }) {
  const [open, setOpen] = useState(false);
  return <div className="edit-insert">
    <button type="button" className="edit-insert-btn" aria-expanded={open} onClick={() => setOpen(!open)}><span aria-hidden="true">+</span> Add section</button>
    {open && <div className="edit-insert-menu" role="menu">{SECTION_KINDS.map((k) => <button key={k.kind} type="button" role="menuitem" onClick={() => { onAdd(k.kind); setOpen(false); }}>{k.label}</button>)}</div>}
  </div>;
}

/** Text that turns into an input while editing, styled like the text it replaces. */
export function InlineText({ value, placeholder, onChange, multiline, className, editing, label }: { value: string; placeholder?: string; onChange: (v: string) => void; multiline?: boolean; className?: string; editing: boolean; label: string }) {
  if (!editing) return value ? <span className={className}>{value}</span> : null;
  if (multiline) return <textarea aria-label={label} className={`inline-edit ${className ?? ""}`} value={value} placeholder={placeholder} rows={Math.max(2, value.split("\n").length)} onChange={(e) => onChange(e.target.value)} />;
  return <input aria-label={label} className={`inline-edit ${className ?? ""}`} value={value} placeholder={placeholder} size={Math.max(8, (value || placeholder || "").length + 1)} onChange={(e) => onChange(e.target.value)} />;
}
