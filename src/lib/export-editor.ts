/** What a screenshot link remembers: crop size, theme, title and the chart settings it overrides. Carried in `xe`. */
export interface EditorView { scale?: "log" | "linear"; frontier?: boolean; links?: boolean; guides?: boolean; density?: number; labelScale?: number }
export interface EditorState { w: number; h: number; ratio?: string; theme?: string; title?: string; view?: EditorView }

export const EDITOR_RATIOS: { id: string; label: string; r?: number }[] = [
  { id: "free", label: "Free" }, { id: "16:9", label: "16:9", r: 16 / 9 }, { id: "3:2", label: "3:2", r: 3 / 2 }, { id: "4:3", label: "4:3", r: 4 / 3 },
  { id: "1:1", label: "1:1", r: 1 }, { id: "4:5", label: "4:5", r: 4 / 5 }, { id: "9:16", label: "9:16", r: 9 / 16 },
];
export const ratioOf = (id?: string) => EDITOR_RATIOS.find((r) => r.id === id)?.r;
export const EDITOR_MIN = { w: 320, h: 220 }, EDITOR_MAX = 2400;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));
const num = (v: unknown, lo: number, hi: number) => typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined;

export function clampSize(w: number, h: number) { return { w: clamp(w, EDITOR_MIN.w, EDITOR_MAX), h: clamp(h, EDITOR_MIN.h, EDITOR_MAX) }; }

export function encodeEditor(s: EditorState): string {
  const v = s.view ?? {};
  const out: Record<string, unknown> = { w: s.w, h: s.h, r: s.ratio && s.ratio !== "free" ? s.ratio : undefined, t: s.theme, ti: s.title || undefined,
    sc: v.scale, fr: v.frontier == null ? undefined : +v.frontier, ln: v.links == null ? undefined : +v.links, gd: v.guides == null ? undefined : +v.guides, de: v.density, ls: v.labelScale };
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return btoa(unescape(encodeURIComponent(JSON.stringify(out)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Anything that does not parse is ignored (null), so a mangled link still opens the page. */
export function decodeEditor(raw: string | null | undefined): EditorState | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(decodeURIComponent(escape(atob(raw.replace(/-/g, "+").replace(/_/g, "/"))))) as Record<string, unknown>;
    if (!o || typeof o !== "object" || typeof o.w !== "number" || typeof o.h !== "number") return null;
    const { w, h } = clampSize(o.w, o.h);
    const view: EditorView = {};
    if (o.sc === "log" || o.sc === "linear") view.scale = o.sc;
    if (o.fr != null) view.frontier = !!o.fr;
    if (o.ln != null) view.links = !!o.ln;
    if (o.gd != null) view.guides = !!o.gd;
    const de = num(o.de, 0, 1), ls = num(o.ls, 0.75, 1.75);
    if (de != null) view.density = de;
    if (ls != null) view.labelScale = ls;
    return { w, h, ratio: typeof o.r === "string" && ratioOf(o.r) ? o.r : undefined, theme: typeof o.t === "string" ? o.t.slice(0, 24) : undefined, title: typeof o.ti === "string" ? o.ti.slice(0, 120) : undefined, view };
  } catch { return null; }
}
