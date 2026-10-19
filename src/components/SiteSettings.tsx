"use client";
import { useRef } from "react";
import { usePathname } from "next/navigation";
import { IconSettings, IconX } from "@tabler/icons-react";
import { SupportLink } from "./SupportLink";
import { THEME_CHOICES } from "@/lib/page-presets";
import { siteThemeModes } from "@/lib/site-theme";
import { ThemeSwatch } from "./ThemeSwatch";
import { useTheme, type ThemeMode } from "./Theme";

const MODES: { id: ThemeMode; label: string }[] = [{ id: "system", label: "System" }, { id: "light", label: "Light" }, { id: "dark", label: "Dark" }];

/** The gear in each header: the visitor's own theme and light/dark mode for the whole site. */
export function SettingsButton({ className = "icon-btn", support = true }: { className?: string; support?: boolean }) {
  const path = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const { mode, setMode, siteTheme, setSiteTheme } = useTheme();
  const chosen = THEME_CHOICES.find((t) => t.id === siteTheme || t.pair === siteTheme) ?? THEME_CHOICES[0];
  const modes = siteThemeModes(chosen.id), single = !modes.light || !modes.dark;
  return <span className="inline-flex items-center gap-1">
    {support && path !== "/support" && <SupportLink from="header" />}
    <button ref={trigger} type="button" className={className} aria-label="Settings" title="Settings" aria-haspopup="dialog" onClick={() => { dialog.current?.showModal(); requestAnimationFrame(() => dialog.current?.querySelector<HTMLButtonElement>("[data-settings-close]")?.focus()); }}><IconSettings size={18} stroke={1.5} aria-hidden="true" /></button>
    <dialog ref={dialog} className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClose={() => trigger.current?.focus()} onClick={(e) => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
      <div className="settings-head"><h2 id="settings-title">Settings</h2><button data-settings-close type="button" className="icon-btn" aria-label="Close settings" onClick={() => dialog.current?.close()}><IconX size={18} stroke={1.5} aria-hidden="true" /></button></div>
      <section className="settings-section" aria-labelledby="settings-theme">
        <h3 id="settings-theme">Theme</h3>
        <div className="settings-themes">{THEME_CHOICES.map((t) => <ThemeSwatch key={t.id} theme={t} selected={chosen.id === t.id} onClick={() => { setSiteTheme(t.id); if (t.dark) setMode("dark"); }} />)}</div>
        <p className="settings-note">For the builder, Explore and model pages on this device. Published pages keep the theme their owner picked.</p>
      </section>
      <section className="settings-section" aria-labelledby="settings-mode">
        <h3 id="settings-mode">Mode</h3>
        <div className="seg" role="group" aria-labelledby="settings-mode">{MODES.map((m) => <button key={m.id} type="button" className="!px-3 !py-1.5 text-[12.5px]" aria-pressed={!single && mode === m.id} disabled={single} onClick={() => setMode(m.id)}>{m.label}</button>)}</div>
        {single && <p className="settings-note">{chosen.name} only comes in {modes.dark ? "dark" : "light"}.</p>}
      </section>
    </dialog>
  </span>;
}
