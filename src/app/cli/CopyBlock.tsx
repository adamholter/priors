"use client";
import { useState } from "react";

/** A command or config snippet with a copy button. */
export function CopyBlock({ text, label }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1600); } catch { /* the text is selectable */ } };
  return (
    <div className="relative bg-white border hairline rounded-md">
      {label && <div className="px-4 pt-2.5 text-[12px] text-grey">{label}</div>}
      <pre className="px-4 py-3 pr-20 text-[12.5px] leading-relaxed overflow-x-auto mono whitespace-pre">{text}</pre>
      <button type="button" className="btn-quiet absolute right-2 top-2 !py-1 !px-2.5 text-[12px]" onClick={copy} aria-label={`Copy ${label ?? "snippet"}`}>{done ? "Copied" : "Copy"}</button>
      <span role="status" className="sr-only">{done ? "Copied" : ""}</span>
    </div>
  );
}
