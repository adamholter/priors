"use client";
import { useState, type KeyboardEvent as RKeyboardEvent, type ReactNode } from "react";
import { IconArrowBackUp, IconArrowsDiagonal, IconBraces, IconBrush, IconCode, IconCopy, IconDownload, IconLink, IconShare2, IconTable, IconVectorBezier2, IconX } from "@tabler/icons-react";
import { rowsHint, type ChartExportFormat } from "./chart-share";
import { Chev } from "./share-ui";

const ic = { size: 16, stroke: 1.6, "aria-hidden": true as const };

/** The data formats, in menu order: one icon size and stroke for every row, and a hint of what each one is. */
export const FORMAT_ROWS: { id: Exclude<ChartExportFormat, "png">; label: string; hint: (a: { rows: number }) => string; icon: ReactNode }[] = [
  { id: "svg", label: "SVG", hint: () => "vector", icon: <IconVectorBezier2 {...ic} /> },
  { id: "html", label: "HTML page", hint: () => "interactive", icon: <IconCode {...ic} /> },
  { id: "csv", label: "CSV", hint: (a) => rowsHint(a.rows), icon: <IconTable {...ic} /> },
  { id: "json", label: "JSON", hint: (a) => rowsHint(a.rows), icon: <IconBraces {...ic} /> },
];

/** What the right-click menu runs: the same actions as the toolbar. */
export type Acts = {
  native: boolean; empty: boolean; rows: number; formats: ChartExportFormat[];
  copyImage: () => void; copyLink?: () => void; download: (f: ChartExportFormat) => void; edit?: () => void;
  expand?: () => void; expanded?: boolean;
  undo?: { run: () => void; label: string };
  /** Closes the menu after an action. */
  done: () => void;
};

/** Runs the row that carries this letter. Returns true when it did. */
export function letterKeys(e: RKeyboardEvent<HTMLElement>, root: HTMLElement | null) {
  if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return false;
  const row = root?.querySelector<HTMLButtonElement>(`[data-key="${e.key.toLowerCase()}"]:not(:disabled)`);
  if (!row) return false;
  e.preventDefault(); row.click();
  return true;
}

/** Right Arrow on a row moves to the chevron at its right end; Left Arrow comes back, or folds the formats. */
export function splitKeys(e: RKeyboardEvent<HTMLElement>) {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return false;
  const active = document.activeElement as HTMLElement | null;
  if (!active) return false;
  const side = ".chart-context-chev";
  if (e.key === "ArrowRight" && active.classList.contains("chart-context-row") && active.nextElementSibling?.matches(side)) { e.preventDefault(); (active.nextElementSibling as HTMLElement).focus(); return true; }
  if (e.key === "ArrowRight" && active.matches(side) && active.getAttribute("aria-expanded") === "false") { e.preventDefault(); active.click(); return true; }
  if (e.key === "ArrowLeft" && active.matches(side)) {
    e.preventDefault();
    if (active.getAttribute("aria-expanded") === "true") active.click(); else (active.previousElementSibling as HTMLElement | null)?.focus();
    return true;
  }
  return false;
}

const Kbd = ({ k, always }: { k: string; always?: boolean }) => <kbd className="chart-context-kbd" data-always={always || undefined} aria-hidden="true">{k}</kbd>;

/** The chart section of the right-click menu: Copy image, Copy link, Download PNG with the other formats folded under it, Edit screenshot, Expand. Each row carries its letter. */
export function ChartRows({ a }: { a: Acts }) {
  const [more, setMore] = useState(false);
  const formats = FORMAT_ROWS.filter((f) => a.formats.includes(f.id));
  return <>
    <button role="menuitem" type="button" className="chart-context-row" disabled={a.empty} data-key="c" onClick={() => { a.done(); a.copyImage(); }}>
      {a.native ? <IconShare2 {...ic} /> : <IconCopy {...ic} />}<span className="chart-context-label">{a.native ? "Share image" : "Copy image"}</span><Kbd k="C" />
    </button>
    {a.copyLink && <button role="menuitem" type="button" className="chart-context-row" data-key="l" onClick={() => { a.done(); a.copyLink?.(); }}>
      <IconLink {...ic} /><span className="chart-context-label">Copy link</span><Kbd k="L" />
    </button>}
    <div className="chart-context-split">
      <button role="menuitem" type="button" className="chart-context-row" disabled={a.empty} data-key="s" onClick={() => { a.done(); a.download("png"); }}>
        <IconDownload {...ic} /><span className="chart-context-label">Download PNG</span><Kbd k="S" />
      </button>
      <button role="menuitem" type="button" className="chart-context-chev hit" aria-label="More formats" aria-expanded={more} onClick={() => setMore((m) => !m)}><Chev /></button>
    </div>
    <div className="chart-context-fold" data-open={more || undefined}><div inert={!more}>
      {formats.map((f) => <button key={f.id} role="menuitem" type="button" className="chart-context-row chart-context-sub" disabled={a.empty} onClick={() => { a.done(); a.download(f.id); }}>
        {f.icon}<span className="chart-context-label">{f.label}</span><span className="chart-share-hint">{f.hint(a)}</span>
      </button>)}
    </div></div>
    {a.edit && <button role="menuitem" type="button" className="chart-context-row" data-key="e" onClick={() => { a.done(); a.edit?.(); }}>
      <IconBrush {...ic} /><span className="chart-context-label">Edit screenshot</span><Kbd k="E" />
    </button>}
    {a.expand && <button role="menuitem" type="button" className="chart-context-row" data-key="x" onClick={() => { a.done(); a.expand?.(); }}>
      {a.expanded ? <IconX {...ic} /> : <IconArrowsDiagonal {...ic} />}<span className="chart-context-label">{a.expanded ? "Close expanded chart" : "Expand chart"}</span><Kbd k="X" />
    </button>}
  </>;
}

export function UndoRow({ a }: { a: Acts }) {
  if (!a.undo) return null;
  return <button role="menuitem" type="button" className="chart-context-row" data-key="z" aria-keyshortcuts="Control+Z Meta+Z" onClick={() => { a.done(); a.undo?.run(); }}>
    <IconArrowBackUp {...ic} /><span className="chart-context-label">{a.undo.label}</span><Kbd k="Ctrl/⌘ Z" always />
  </button>;
}
