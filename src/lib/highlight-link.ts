import type { IndexConfig } from "../engine";
import { encodeIndices } from "./url";
import { setChartHidden, type ChartHidden } from "../components/chart/chart-visibility";

/** Profile links override the selection on one index without changing the saved page. */
export function linkedHighlights(indices: IndexConfig[], params: URLSearchParams): IndexConfig[] {
  if (!params.has("hl")) return indices;
  const id = params.get("hi") ?? indices[0]?.id;
  const highlight = (params.get("hl") ?? "").split(",").filter(Boolean).slice(0, 12);
  return indices.map((index) => index.id === id ? { ...index, highlight: highlight.length ? highlight : undefined } : index);
}

export function setHighlightParams(url: URL, indexId: string, items: string[]) {
  url.searchParams.set("hi", indexId);
  // An empty selection must override highlights saved on the profile too.
  url.searchParams.set("hl", items.join(","));
  return url;
}

/** Copy current React state, including the active mix, before the debounced address bar update. */
export function chartLinkUrl(current: string, id: string, params?: { cv?: "bars" | "scatter"; cm?: "best" | "all"; cs?: "log" | "linear"; ls?: number; hidden?: ChartHidden; extra?: Record<string, string | undefined> }, state?: { items: string[]; indexId?: string; linkIndices?: IndexConfig[] }) {
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
  if (state?.linkIndices) {
    url.searchParams.delete("i");
    for (const encoded of encodeIndices(state.linkIndices).getAll("i")) url.searchParams.append("i", encoded);
    url.searchParams.delete("hi");
    url.searchParams.delete("hl");
  } else if (state?.indexId) setHighlightParams(url, state.indexId, state.items);
  return url;
}
