"use client";
import { usePathname } from "next/navigation";
import { IconMoon, IconSun } from "@tabler/icons-react";
import { SupportLink } from "./SupportLink";
import { THEME_CHOICES, pickerThemeOf } from "@/lib/page-presets";
import { siteThemeModes } from "@/lib/site-theme";
import { ExploreThemes } from "./ExploreThemes";
import { ThemeSwatch } from "./ThemeSwatch";
import { useTheme, type ThemeMode } from "./Theme";
import { setNoticesOn, useNoticesOn } from "@/lib/version-notices-pref";

const MODES: { id: ThemeMode; label: string }[] = [{ id: "system", label: "System" }, { id: "light", label: "Light" }, { id: "dark", label: "Dark" }];

/**
 * The control in each header: one button that switches the whole site between light and dark. Themes, following the system and the
 * update-notice switch are advanced settings on `/settings` (`SiteSettingsPanel`), linked from a page owner's settings and nowhere else.
 * `pageNote`: on a published page with its owner's theme, what the switch changes and what stays the owner's (the button's hover text).
 */
export function SettingsButton({ className = "icon-btn", support = true, pageNote }: { className?: string; support?: boolean; pageNote?: string }) {
  const path = usePathname();
  const { dark, setMode, siteTheme } = useTheme();
  const chosen = pickerThemeOf(siteTheme) ?? THEME_CHOICES[0], modes = siteThemeModes(chosen.id), single = !modes.light || !modes.dark;
  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  const title = single ? `${chosen.name} only comes in ${modes.dark ? "dark" : "light"}.` : pageNote ? `${label}. ${pageNote}` : label;
  return <span className="inline-flex items-center gap-1">
    {support && path !== "/support" && <SupportLink from="header" />}
    <button type="button" className={className} aria-label={label} title={title} data-theme-toggle disabled={single} onClick={() => setMode(dark ? "light" : "dark")}>
      {/* Both icons are in the page and CSS shows one (`html[data-theme]`), so the server's guess never flashes the wrong one. */}
      <IconSun size={18} stroke={1.5} aria-hidden="true" className="theme-toggle-sun" /><IconMoon size={18} stroke={1.5} aria-hidden="true" className="theme-toggle-moon" />
    </button>
  </span>;
}

/** Advanced site settings for this device: a theme for the builder, Explore and model pages, following the system's mode, and update notices. */
export function SiteSettingsPanel() {
  const { mode, dark, setMode, siteTheme, setSiteTheme } = useTheme();
  const noticesOn = useNoticesOn();
  const chosen = pickerThemeOf(siteTheme) ?? THEME_CHOICES[0], pickTheme = (t: { id: string; dark: boolean }) => { setSiteTheme(t.id); if (t.dark) setMode("dark"); };
  const modes = siteThemeModes(chosen.id), single = !modes.light || !modes.dark;
  const modeControl = <div className="theme-mode-row"><span id="settings-mode-label" className="theme-mode-label">Mode</span>
    <div className="seg" role="group" aria-labelledby="settings-mode-label">{MODES.map((m) => <button key={m.id} type="button" className="!px-3 !py-1.5 text-[12.5px]" aria-pressed={!single && mode === m.id} disabled={single} onClick={() => setMode(m.id)}>{m.label}</button>)}</div>
    {single && <span className="settings-note">{chosen.name} only comes in {modes.dark ? "dark" : "light"}.</span>}</div>;
  return <div className="settings-panel">
    <section className="settings-section" aria-labelledby="settings-mode">
      <h2 id="settings-mode">Mode</h2>
      <div className="seg" role="group" aria-labelledby="settings-mode">{MODES.map((m) => <button key={m.id} type="button" className="!px-3 !py-1.5 text-[12.5px]" aria-pressed={!single && mode === m.id} disabled={single} onClick={() => setMode(m.id)}>{m.label}</button>)}</div>
      {single ? <p className="settings-note">{chosen.name} only comes in {modes.dark ? "dark" : "light"}.</p> : <p className="settings-note">System follows your device. The sun and moon button in each header picks light or dark.</p>}
    </section>
    <section className="settings-section" aria-labelledby="settings-theme">
      <h2 id="settings-theme">Theme</h2>
      <div className="settings-themes">{THEME_CHOICES.map((t) => <ThemeSwatch key={t.id} theme={t} selected={chosen.id === t.id} onClick={() => pickTheme(t)} />)}</div>
      <div className="mt-3"><ExploreThemes selectedId={chosen.library ? chosen.id : undefined} onPick={pickTheme} dark={dark} modeControl={modeControl} /></div>
      <p className="settings-note">For the builder, Explore and model pages on this device. Published pages keep the theme their owner picked.</p>
    </section>
    <section className="settings-section" aria-labelledby="settings-notices">
      <h2 id="settings-notices">Update notices</h2>
      <div className="seg" role="group" aria-labelledby="settings-notices">{[true, false].map((on) => <button key={String(on)} type="button" className="!px-3 !py-1.5 text-[12.5px]" aria-pressed={noticesOn === on} onClick={() => setNoticesOn(on)}>{on ? "On" : "Off"}</button>)}</div>
      <p className="settings-note">A note when a benchmark one of your indexes uses gets a new version, with a one-click upgrade.</p>
    </section>
  </div>;
}
