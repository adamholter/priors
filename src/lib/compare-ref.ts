import type { IndexConfig } from "../engine";
import { findTab, tabKey } from "./page-layout";
import { decodeIndex, encodeIndex, prettyQuery } from "./url";

/**
 * What one side of /compare points at, as written in the address (`?a=` and `?b=`):
 * `me` (this visitor's own ranking), `@handle` or `@handle~tab` (a published page, its main index or the tab a link would name),
 * or an index spelled out in the builder's own codec, so any ranking can be compared, saved or not.
 */
export type Ref = { kind: "me" } | { kind: "preset"; id: string } | { kind: "page"; handle: string; tab?: string } | { kind: "index"; config: IndexConfig };
/** Starting points a side can be set to by name (`preset:aa`): Artificial Analysis' composite, and the General frontier mix. */
export const PRESET_IDS = ["aa", "general"] as const;

const HANDLE = /^[a-z0-9][a-z0-9_-]{0,38}$/;

export function parseRef(value: string | undefined | null, id = "cmp"): Ref | undefined {
  const v = value?.trim();
  if (!v) return undefined;
  if (v === "me") return { kind: "me" };
  if (v.startsWith("preset:")) { const id = v.slice(7); return (PRESET_IDS as readonly string[]).includes(id) ? { kind: "preset", id } : undefined; }
  if (v.startsWith("@")) {
    const [handle, tab] = v.slice(1).split("~");
    return HANDLE.test(handle.toLowerCase()) ? { kind: "page", handle: handle.toLowerCase(), tab: tab || undefined } : undefined;
  }
  if (!v.includes("|") && !v.includes(":")) return undefined;
  const config = decodeIndex(v, id);
  return config && Object.keys(config.weights).length ? { kind: "index", config } : undefined;
}

export function formatRef(ref: Ref): string {
  return ref.kind === "me" ? "me" : ref.kind === "preset" ? `preset:${ref.id}` : ref.kind === "page" ? `@${ref.handle}${ref.tab ? `~${ref.tab}` : ""}` : encodeIndex(ref.config);
}

/** The ref that names one tab of a page, leaving the main index implicit. */
export function pageRef(handle: string, indices: IndexConfig[], index: IndexConfig): Ref {
  return { kind: "page", handle, tab: index === indices[0] || index.id === indices[0]?.id ? undefined : tabKey(indices, index) };
}

/** The index a page ref names: the tab it spells, else the main one. */
export function pageIndex<T extends IndexConfig>(indices: T[], tab?: string): T | undefined {
  return (tab ? findTab(indices, tab) : undefined) ?? indices[0];
}

/**
 * What someone pasted into the picker: a Priors link (a builder link carries an index, a page link names a handle and maybe a tab),
 * a `@handle`, or a bare ref.
 */
export function parsePasted(text: string): Ref | undefined {
  const t = text.trim();
  if (!t) return undefined;
  if (/^https?:\/\//i.test(t)) {
    let u: URL;
    try { u = new URL(t); } catch { return undefined; }
    const i = u.searchParams.get("i");
    if (u.pathname.startsWith("/builder") && i) return parseRef(i);
    const seg = u.pathname.split("/").filter(Boolean);
    if (seg.length === 1 && !RESERVED.has(seg[0].toLowerCase())) return parseRef(`@${seg[0]}${u.searchParams.get("hi") ? `~${u.searchParams.get("hi")}` : ""}`);
    return undefined;
  }
  return parseRef(t) ?? parseRef(`@${t}`);
}

const RESERVED = new Set(["builder", "explore", "rank", "compare", "history", "models", "model-finder", "import", "skill", "privacy", "claim", "sign-in", "lab", "api", "og", "3d", "support"]);

/** The address of a comparison: `/compare?a=&b=`, plus `n` (top list length, 10 when absent) and `same` (same models only). */
export function compareUrl(a: Ref | undefined, b: Ref | undefined, opts: { top?: number; same?: boolean } = {}): string {
  const q = new URLSearchParams();
  if (a) q.set("a", formatRef(a));
  if (b) q.set("b", formatRef(b));
  if (opts.top && opts.top !== 10) q.set("n", String(opts.top));
  if (opts.same) q.set("same", "1");
  return `/compare${q.size ? `?${prettyQuery(q).replace(/%40/g, "@").replace(/%7E/gi, "~")}` : ""}`;
}

/** The address of the 3D view of one ranking: `/3d?a=`, the same refs `/compare` takes. */
export function threeDUrl(ref: Ref): string {
  const q = new URLSearchParams({ a: formatRef(ref) });
  return `/3d?${prettyQuery(q).replace(/%40/g, "@").replace(/%7E/gi, "~")}`;
}
