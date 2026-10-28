"use client";
import { useMemo, useSyncExternalStore } from "react";
import { inlinePreset } from "@/lib/custom-theme";
import type { PagePreset } from "@/lib/page-presets";

/** The custom themes (see custom-theme.ts) this browser keeps: just their ids, which carry the whole theme. */
export const MY_THEMES_KEY = "priors:my-themes";
const MAX = 12, EVENT = "priors:my-themes";

const read = () => { try { return localStorage.getItem(MY_THEMES_KEY) ?? "[]"; } catch { return "[]"; } };
function write(ids: string[]) {
  try { localStorage.setItem(MY_THEMES_KEY, JSON.stringify(ids.slice(0, MAX))); } catch { /* storage full or blocked: the theme still applies this session */ }
  window.dispatchEvent(new Event(EVENT));
}
const parse = (raw: string): string[] => { try { const v = JSON.parse(raw); return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []; } catch { return []; } };

export const addMyTheme = (id: string) => write([id, ...parse(read()).filter((x) => x !== id)]);
export const removeMyTheme = (id: string) => write(parse(read()).filter((x) => x !== id));

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb); window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}

/** Saved custom themes, newest first, each as its picker preset (light version when it has one). Empty on the server. */
export function useMyThemes(): PagePreset[] {
  const raw = useSyncExternalStore(subscribe, read, () => "[]");
  return useMemo(() => parse(raw).map((id) => inlinePreset(id)).filter((p): p is PagePreset => !!p), [raw]);
}
