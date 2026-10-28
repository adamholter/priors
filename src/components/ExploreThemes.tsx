"use client";
import { useRef } from "react";
import { IconX } from "@tabler/icons-react";
import { LIBRARY_CHOICES, type PagePreset } from "@/lib/page-presets";
import { ThemeSwatch } from "./ThemeSwatch";

/** "Explore themes": the broader theme library, in a dialog under the picker. Picking applies like any picker card. */
export function ExploreThemes({ selectedId, onPick }: { /** Id of the library theme in use (either mode), if any. */ selectedId?: string; onPick: (t: PagePreset) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button type="button" className="btn-quiet w-fit" aria-haspopup="dialog" data-explore-themes onClick={() => dialog.current?.showModal()}>Explore themes</button>
    <dialog ref={dialog} className="settings-dialog theme-library" role="dialog" aria-modal="true" aria-label="Explore themes" onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) dialog.current?.close(); }}>
      <div className="settings-head"><h2>Explore themes</h2><button type="button" className="icon-btn" aria-label="Close themes" onClick={() => dialog.current?.close()}><IconX size={18} stroke={1.5} aria-hidden="true" /></button></div>
      <div className="settings-themes theme-library-grid">{LIBRARY_CHOICES.map((t) => <ThemeSwatch key={t.id} theme={t} selected={selectedId === t.id || selectedId === t.pair} onClick={() => onPick(t)} />)}</div>
      <p className="settings-note">Looks borrowed from benchmark sites and products. Themes with a light and a dark version follow your mode.</p>
    </dialog>
  </>;
}
