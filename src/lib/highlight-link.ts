import type { IndexConfig } from "../engine";
import { decodeIndex, encodeIndex, encodeIndices } from "./url";
import { findTab } from "./page-layout";
import { setChartHidden, type ChartHidden } from "../components/chart/chart-visibility";

/** Profile links override the selection on one index (`hi`: its id or name slug) without changing the saved page. */
export function linkedHighlights(indices: IndexConfig[], params: URLSearchParams): IndexConfig[] {
  if (!params.has("hl")) return indices;
  // A link that names an index that is gone changes nothing; one that names none means the first.
  const id = (params.has("hi") ? findTab(indices, params.get("hi")) : indices[0])?.id;
  const highlight = (params.get("hl") ?? "").split(",").filter(Boolean).slice(0, 12);
  return indices.map((index) => index.id === id ? { ...index, highlight: highlight.length ? highlight : undefined } : index);
}

export function setHighlightParams(url: URL, indexId: string, items: string[]) {
  url.searchParams.set("hi", indexId);
  // An empty selection must override highlights saved on the profile too.
  url.searchParams.set("hl", items.join(","));
  return url;
}

/**
 * Display settings of an index that a visitor can change without saving the page: which models are shown,
 * the effort mode, release window, cost and time sources. A chart link carries the ones that differ from
 * the saved page (`hv`), written in the index codec's own keys, so it opens looking the way it did when copied.
 */
const VIEW_KEYS = ["ex", "only", "after", "costsrc", "costbasis", "resets", "timesrc", "pareto", "bars", "eff", "reff"] as const;
const VIEW_FIELD: Record<(typeof VIEW_KEYS)[number], keyof IndexConfig> = { ex: "excludeModels", only: "onlyModels", after: "releasedAfter", costsrc: "costSource", costbasis: "costBasis", resets: "planResets", timesrc: "timeSource", pareto: "paretoVariants", bars: "rankingVariants", eff: "efforts", reff: "rankingEfforts" };

const viewParts = (index?: IndexConfig) => {
  const parts = new Map<string, string>();
  if (!index) return parts;
  for (const part of encodeIndex({ ...index, page: undefined }).split("|").slice(2)) {
    const key = part.split("=")[0];
    if ((VIEW_KEYS as readonly string[]).includes(key)) parts.set(key, part.slice(key.length + 1));
  }
  return parts;
};

/** The `hv` value for an index against the saved one (or against nothing, for an index that came from a link): empty when nothing differs. */
export function viewParam(index: IndexConfig, saved?: IndexConfig): string {
  const now = viewParts(index), was = viewParts(saved), out: string[] = [];
  for (const key of VIEW_KEYS) {
    const a = now.get(key), b = was.get(key);
    if (a === b) continue;
    // A cleared hide list has to be said; the other settings cannot be unset by a link, so they are left alone.
    if (a !== undefined) out.push(`${key}=${a}`); else if (key === "ex") out.push("ex=");
  }
  return out.join("|");
}

/** Profile links apply the display settings in `hv` to the index `hi` names, without changing the saved page. */
export function linkedViews(indices: IndexConfig[], params: URLSearchParams): IndexConfig[] {
  const hv = params.get("hv");
  if (!hv) return indices;
  const id = (params.has("hi") ? findTab(indices, params.get("hi")) : indices[0])?.id;
  const parsed = id ? decodeIndex(`x||${hv}`, id) : null;
  if (!id || !parsed) return indices;
  const keys = hv.split("|").map((part) => part.split("=")[0]).filter((key): key is (typeof VIEW_KEYS)[number] => (VIEW_KEYS as readonly string[]).includes(key));
  const patch: Record<string, unknown> = {};
  for (const key of keys) patch[VIEW_FIELD[key]] = parsed[VIEW_FIELD[key]];
  return indices.map((index) => index.id === id ? { ...index, ...patch } : index);
}

/** Copy current React state, including the active mix, before the debounced address bar update. */
export function chartLinkUrl(current: string, id: string, params?: { cv?: "bars" | "scatter"; cm?: "best" | "all"; cs?: "log" | "linear"; ls?: number; hidden?: ChartHidden; extra?: Record<string, string | undefined> }, state?: { items: string[]; indexId?: string; view?: string; linkIndices?: IndexConfig[] }) {
  const url = new URL(current);
  url.searchParams.set("c", id);
  url.hash = id;
  if (params) {
    if (params.hidden) setChartHidden(url, id, params.hidden);
    if (params.ls != null) url.searchParams.set("ls", String(params.ls)); else url.searchParams.delete("ls");
    for (const key of ["cv", "cm", "cs"] as const) {
      if (params[key]) url.searchParams.set(key, params[key]); else url.searchParams.delete(key);
    }
    for (const [key, value] of Object.entries(params.extra ?? {})) {
      if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
    }
  }
  // The look it was copied in, so the link preview matches what the visitor saw: light or dark, and on the builder and
  // benchmark pages the visitor's site theme. A published page keeps its owner's theme, which the card already knows.
  if (typeof document !== "undefined") {
    const root = document.documentElement, scheme = root.dataset.theme;
    if (scheme === "dark" || scheme === "light") url.searchParams.set("scheme", scheme);
    if (root.dataset.siteTheme && /^\/(builder|benchmarks)(\/|$)/.test(url.pathname)) url.searchParams.set("theme", root.dataset.siteTheme);
  }
  if (state?.linkIndices) {
    url.searchParams.delete("i");
    for (const encoded of encodeIndices(state.linkIndices).getAll("i")) url.searchParams.append("i", encoded);
    url.searchParams.delete("hi");
    url.searchParams.delete("hl");
    url.searchParams.delete("hv");
  } else if (state?.indexId) {
    setHighlightParams(url, state.indexId, state.items);
    if (state.view) url.searchParams.set("hv", state.view); else url.searchParams.delete("hv");
  }
  return url;
}
