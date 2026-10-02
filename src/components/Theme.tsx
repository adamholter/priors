"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { ChartPaletteContext, DARK_PALETTE, LIGHT_PALETTE } from "./chart/echarts";

export type ThemeMode = "system" | "light" | "dark";
export const THEME_KEY = "priors:theme";

/** Runs in <head> before first paint so the page never flashes the wrong scheme. */
export const THEME_SCRIPT = `(function(){try{var m=localStorage.getItem("${THEME_KEY}");var d=m==="dark"||(m!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.dataset.theme=d?"dark":"light";r.style.colorScheme=d?"dark":"light"}catch(e){}})()`;

const ThemeContext = createContext<{ mode: ThemeMode; dark: boolean; setMode: (m: ThemeMode) => void }>({ mode: "system", dark: false, setMode: () => {} });
export const useTheme = () => useContext(ThemeContext);

function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
const readDark = () => document.documentElement.dataset.theme === "dark";

function apply(dark: boolean) {
  const r = document.documentElement;
  const set = () => { r.dataset.theme = dark ? "dark" : "light"; r.style.colorScheme = dark ? "dark" : "light"; };
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (doc.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches && r.dataset.theme !== (dark ? "dark" : "light")) {
    r.classList.add("theme-switching");
    const t = doc.startViewTransition(set) as { finished?: Promise<void> };
    t.finished?.finally(() => r.classList.remove("theme-switching"));
  } else set();
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const dark = useSyncExternalStore(subscribe, readDark, () => false);
  const [mode, setModeState] = useState<ThemeMode>("system");
  useEffect(() => {
    let m: ThemeMode = "system";
    try { const saved = localStorage.getItem(THEME_KEY); if (saved === "light" || saved === "dark") m = saved; } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is client-only
    setModeState(m);
    // A hydration error makes React re-render <html> and drop the attribute the head script set; restore it.
    const want = m === "dark" || (m === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    if (document.documentElement.dataset.theme !== (want ? "dark" : "light")) { document.documentElement.dataset.theme = want ? "dark" : "light"; document.documentElement.style.colorScheme = want ? "dark" : "light"; }
  }, []);
  useEffect(() => {
    if (mode !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = () => apply(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [mode]);
  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    try { if (m === "system") localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, m); } catch { /* ignore */ }
    apply(m === "dark" || (m === "system" && matchMedia("(prefers-color-scheme: dark)").matches));
  }, []);
  const value = useMemo(() => ({ mode, dark, setMode }), [mode, dark, setMode]);
  return <ThemeContext.Provider value={value}><ChartPaletteContext.Provider value={dark ? DARK_PALETTE : LIGHT_PALETTE}>{children}</ChartPaletteContext.Provider></ThemeContext.Provider>;
}

/** Light/dark switch. Starts from the system setting; a click pins the other scheme. */
export function ThemeToggle({ className = "icon-btn" }: { className?: string }) {
  const { dark, setMode } = useTheme();
  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button type="button" className={`theme-toggle ${className}`} aria-label={label} title={label} onClick={() => setMode(dark ? "light" : "dark")}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
        <g className="theme-sun"><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" /></g>
        <path className="theme-moon" d="M19.5 14.6A7.8 7.8 0 0 1 9.4 4.5a7.8 7.8 0 1 0 10.1 10.1Z" />
      </svg>
    </button>
  );
}
