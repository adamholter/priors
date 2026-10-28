"use client";
import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { IconX } from "@tabler/icons-react";
import { LIBRARY_CHOICES, themeById, type PagePreset } from "@/lib/page-presets";
import { EXAMPLE_THEME, parseThemeText, signaturePreset, themeId, themePrompt } from "@/lib/custom-theme";
import { track } from "@/lib/analytics";
import { ThemeSwatch } from "./ThemeSwatch";
import { addMyTheme, removeMyTheme, useMyThemes } from "./my-themes";

type Notice = { kind: "error"; lines: string[] } | { kind: "ok"; name: string; lines: string[] };

/**
 * "Explore themes": the broader theme library, in a dialog under the picker, with the light/dark control inside (so
 * you never leave to change it) and "Bring your own theme": upload or paste a Priors theme file, or copy the prompt
 * that makes an agent write one. Picking applies like any picker card.
 */
export function ExploreThemes({ selectedId, onPick, modeControl, dark }: {
  /** Id of the library or custom theme in use (either mode), if any. */ selectedId?: string; onPick: (t: PagePreset) => void;
  /** The caller's light/dark control, shown in the dialog. */ modeControl?: ReactNode;
  /** Current scheme: cards show each theme's version for it (when it has one). */ dark?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null), file = useRef<HTMLInputElement>(null);
  const mine = useMyThemes();
  const [pasting, setPasting] = useState(false), [text, setText] = useState(""), [notice, setNotice] = useState<Notice | null>(null), [copied, setCopied] = useState("");
  const show = (t: PagePreset) => { if (dark === undefined) return t; const other = themeById(t.pair); return other && other.dark === dark ? other : t; };

  function add(source: string) {
    const r = parseThemeText(source);
    if (!r.ok) { setNotice({ kind: "error", lines: r.errors }); return; }
    addMyTheme(themeId(r.theme));
    onPick(show(signaturePreset(r.theme)));
    track("custom_theme_added", { name: r.theme.name, modes: Number(!!r.theme.light) + Number(!!r.theme.dark) });
    setNotice({ kind: "ok", name: r.theme.name, lines: r.warnings }); setText(""); setPasting(false);
  }
  async function upload(f: File | undefined) {
    if (!f) return;
    if (f.size > 100_000) { setNotice({ kind: "error", lines: ["That file is too large to be a theme (limit 100 KB)."] }); return; }
    add(await f.text());
  }
  async function copy(label: string, value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(label); setTimeout(() => setCopied((c) => (c === label ? "" : c)), 1800); } catch { setNotice({ kind: "error", lines: ["Copying failed. Select the text and copy it by hand."] }); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(EXAMPLE_THEME, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "my-priors-theme.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <>
    <button type="button" className="btn-quiet w-fit" aria-haspopup="dialog" data-explore-themes onClick={() => dialog.current?.showModal()}>Explore themes</button>
    <dialog ref={dialog} className="settings-dialog theme-library" role="dialog" aria-modal="true" aria-label="Explore themes" onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) dialog.current?.close(); }}>
      <div className="settings-head"><h2>Explore themes</h2><button type="button" className="icon-btn" aria-label="Close themes" onClick={() => dialog.current?.close()}><IconX size={18} stroke={1.5} aria-hidden="true" /></button></div>
      {modeControl && <div className="theme-library-mode" data-theme-library-mode>{modeControl}</div>}
      {mine.length > 0 && <>
        <h3 className="theme-library-title">Your themes</h3>
        <div className="settings-themes theme-library-grid" data-my-themes>{mine.map((t) => <div key={t.id} className="theme-mine">
          <ThemeSwatch theme={show(t)} selected={selectedId === t.id || selectedId === t.pair} onClick={() => onPick(show(t))} />
          <button type="button" className="theme-mine-remove" aria-label={`Remove ${t.name}`} title="Remove" onClick={() => removeMyTheme(t.id)}><IconX size={12} stroke={2} aria-hidden="true" /></button>
        </div>)}</div>
      </>}
      <h3 className="theme-library-title">Library</h3>
      <div className="settings-themes theme-library-grid">{LIBRARY_CHOICES.map((t) => <ThemeSwatch key={t.id} theme={show(t)} selected={selectedId === t.id || selectedId === t.pair} onClick={() => onPick(show(t))} />)}</div>
      <p className="settings-note">Looks borrowed from benchmark sites and products. Themes with a light and a dark version follow your mode.</p>

      <section className="theme-byo" aria-labelledby="theme-byo-title" data-byo-theme>
        <h3 id="theme-byo-title" className="theme-library-title">Bring your own theme</h3>
        <p className="settings-note">Upload a Priors theme file, or have your agent make one: copy the prompt, tell it the look you want, and upload what it returns. With the <Link href="/skill" className="underline">Priors skill</Link> installed it already knows the format.</p>
        <div className="theme-byo-actions">
          <button type="button" className="btn-quiet" onClick={() => file.current?.click()}>Upload theme file</button>
          <button type="button" className="btn-quiet" aria-expanded={pasting} onClick={() => setPasting((p) => !p)}>Paste theme</button>
          <button type="button" className="btn-quiet" onClick={() => copy("prompt", themePrompt())}>{copied === "prompt" ? "Prompt copied" : "Copy agent prompt"}</button>
          <button type="button" className="btn-quiet" onClick={download}>Download template</button>
          <input ref={file} type="file" accept=".json,application/json" hidden data-theme-file onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
        {pasting && <div className="theme-byo-paste">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} spellCheck={false} aria-label="Theme JSON" placeholder='{ "priorsTheme": 1, "name": "My theme", "light": { … } }' />
          <button type="button" className="btn-primary w-fit" disabled={!text.trim()} onClick={() => add(text)}>Add theme</button>
        </div>}
        {notice?.kind === "error" && <div className="theme-byo-notice is-error" role="alert">
          <strong>That theme can&apos;t be used yet:</strong>
          <ul>{notice.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
          <button type="button" className="btn-quiet" onClick={() => copy("errors", `The Priors theme file you gave me has problems. Fix them and send the whole corrected JSON:\n${notice.lines.map((l) => `- ${l}`).join("\n")}`)}>{copied === "errors" ? "Copied" : "Copy these for your agent"}</button>
        </div>}
        {notice?.kind === "ok" && <div className="theme-byo-notice" role="status">
          <strong>Added “{notice.name}”.</strong>{notice.lines.length > 0 && <> It works, but:<ul>{notice.lines.map((l, i) => <li key={i}>{l}</li>)}</ul></>}
        </div>}
        <p className="settings-note">Custom themes stay in this browser. They travel inside shared chart links and a page&apos;s theme, so others see them as you do.</p>
      </section>
    </dialog>
  </>;
}
