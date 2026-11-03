"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { ChartPaletteContext } from "./chart/palette-context";
import { DARK_PALETTE, LIGHT_PALETTE, paletteFor } from "./chart/palette";
import { DEFAULT_SITE_THEME, resolveSiteTheme, savedSiteTheme, SITE_THEME_KEY, siteThemeVars, type SavedSiteTheme } from "@/lib/site-theme";

export type ThemeMode = "system" | "light" | "dark";
export const THEME_KEY = "priors:theme";
export const THEME_COOKIE = "priors_theme";

function savedMode(): ThemeMode {
  try { const saved = localStorage.getItem(THEME_KEY); if (saved === "light" || saved === "dark") return saved; } catch { /* use the preference cookie */ }
  try { const saved = document.cookie.match(/(?:^|;\s*)priors_theme=(light|dark)(?:;|$)/)?.[1]; if (saved === "light" || saved === "dark") return saved; } catch { /* use the system preference */ }
  return "system";
}

function saveCookie(mode: ThemeMode) {
  try { document.cookie = `${THEME_COOKIE}=${mode === "system" ? "" : mode}; Path=/; Max-Age=${mode === "system" ? 0 : 31536000}; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`; } catch { /* browser storage can still remember the choice */ }
}

/** Runs in <head> before first paint so the page never flashes the wrong scheme or theme. */
export const THEME_SCRIPT = `(function(){var m;try{m=localStorage.getItem("${THEME_KEY}")}catch(e){}if(m!=="light"&&m!=="dark"){try{var c=document.cookie.match(/(?:^|;\\s*)${THEME_COOKIE}=(light|dark)(?:;|$)/);m=c&&c[1]}catch(e){}}var d=m==="dark"||(m!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement,t=null;try{t=JSON.parse(localStorage.getItem("${SITE_THEME_KEY}")||"null")}catch(e){}if(t&&(t.light||t.dark)){if(d&&!t.dark)d=false;if(!d&&!t.light)d=true;var v=d?t.dark:t.light;for(var k in v)r.style.setProperty(k,v[k]);r.dataset.siteTheme=t.id}r.dataset.theme=d?"dark":"light";r.style.colorScheme=d?"dark":"light"})()`;

const ThemeContext = createContext<{ mode: ThemeMode; dark: boolean; setMode: (m: ThemeMode) => void; siteTheme: string; setSiteTheme: (id: string) => void }>({ mode: "system", dark: false, setMode: () => {}, siteTheme: DEFAULT_SITE_THEME, setSiteTheme: () => {} });
export const useTheme = () => useContext(ThemeContext);

function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
const readDark = () => document.documentElement.dataset.theme === "dark";

function savedThemeId(): string {
  try { return (JSON.parse(localStorage.getItem(SITE_THEME_KEY) ?? "null") as SavedSiteTheme | null)?.id ?? DEFAULT_SITE_THEME; } catch { return DEFAULT_SITE_THEME; }
}

const wantsDark = (mode: ThemeMode) => mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);

/** Paint the scheme and the site theme's tokens on <html>, crossfading when something visibly changes. */
function apply(mode: ThemeMode, themeId: string, animate = true) {
  const r = document.documentElement, { preset, dark } = resolveSiteTheme(themeId, wantsDark(mode));
  const vars = preset ? siteThemeVars(preset) : {};
  const same = r.dataset.theme === (dark ? "dark" : "light") && (r.dataset.siteTheme ?? DEFAULT_SITE_THEME) === (preset ? themeId : DEFAULT_SITE_THEME);
  const set = () => {
    for (const name of [...r.style].filter((n) => n.startsWith("--"))) r.style.removeProperty(name);
    for (const [k, v] of Object.entries(vars)) r.style.setProperty(k, v);
    if (preset) r.dataset.siteTheme = themeId; else delete r.dataset.siteTheme;
    r.dataset.theme = dark ? "dark" : "light"; r.style.colorScheme = dark ? "dark" : "light";
  };
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (animate && !same && doc.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    r.classList.add("theme-switching");
    const t = doc.startViewTransition(set) as { finished?: Promise<void>; skipTransition?: () => void };
    t.finished?.finally(() => r.classList.remove("theme-switching"));
    // A transition started while the tab is hidden can stall and leave the old snapshot over the page.
    setTimeout(() => t.skipTransition?.(), 1000);
  } else set();
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const dark = useSyncExternalStore(subscribe, readDark, () => false);
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [siteTheme, setSiteThemeState] = useState(DEFAULT_SITE_THEME);
  useEffect(() => {
    const m = savedMode(), id = savedThemeId();
    if (m !== "system") saveCookie(m);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is client-only
    setModeState(m);
    setSiteThemeState(id);
    // A hydration error makes React re-render <html> and drop what the head script set; restore it.
    // Repainting also refreshes the saved tokens if the theme's definition changed since they were saved.
    apply(m, id, false);
    const saved = savedSiteTheme(id);
    try { if (saved) localStorage.setItem(SITE_THEME_KEY, JSON.stringify(saved)); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (mode !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = () => apply("system", siteTheme, false);
    const show = () => { if (!document.hidden) on(); };
    mq.addEventListener("change", on);
    document.addEventListener("visibilitychange", show);
    return () => { mq.removeEventListener("change", on); document.removeEventListener("visibilitychange", show); };
  }, [mode, siteTheme]);
  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    try { if (m === "system") localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, m); } catch { /* ignore */ }
    saveCookie(m);
    apply(m, savedThemeId());
  }, []);
  const setSiteTheme = useCallback((id: string) => {
    setSiteThemeState(id);
    const saved = savedSiteTheme(id);
    try { if (saved) localStorage.setItem(SITE_THEME_KEY, JSON.stringify(saved)); else localStorage.removeItem(SITE_THEME_KEY); } catch { /* ignore */ }
    apply(savedMode(), id);
  }, []);
  const preset = resolveSiteTheme(siteTheme, dark).preset;
  const palette = useMemo(() => preset ? paletteFor(preset) : dark ? DARK_PALETTE : LIGHT_PALETTE, [preset, dark]);
  const value = useMemo(() => ({ mode, dark, setMode, siteTheme, setSiteTheme }), [mode, dark, setMode, siteTheme, setSiteTheme]);
  return <ThemeContext.Provider value={value}><ChartPaletteContext.Provider value={palette}>{children}</ChartPaletteContext.Provider></ThemeContext.Provider>;
}
