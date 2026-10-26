import { anchorOf, CHART_TITLES } from "./metrics";
import { pageLayout } from "./page-layout";
import type { Profile, Section } from "@/components/page/IndexPage";

/** Titles shown when a profile section has no custom title (mirrors IndexPage defaultTitle). */
function sectionTitle(s: Section, indexName?: string, subscription = false): string {
  if (s.title) return s.title;
  switch (s.kind) {
    case "rankings": return indexName ?? "Rankings";
    case "pareto": return `${indexName ?? "Score"} vs ${subscription ? "subscription " : ""}cost per task`;
    case "speed": return `${indexName ?? "Score"} vs speed`;
    case "gallery": return "More metrics";
    default: return "";
  }
}

/**
 * Profile chart links copy `?c=<section title slug>`: map it back to a canonical chart id. The page shows
 * sections it never saved (a plain index gets rankings, cost and more metrics), so the lookup runs over
 * the layout the page shows (`pageLayout`), not only the sections stored on the profile.
 */
export function resolveProfileChart(p: { indices: Profile["indices"]; sections?: Profile["sections"] }, c: string | null | undefined): string | undefined {
  if (!c) return undefined;
  if (c in CHART_TITLES) return c;
  // The page titles a pareto "... vs subscription cost per task" when the index prices by subscription, so a copied link carries either slug.
  const s = pageLayout(p.indices, p.sections ?? []).find((sec) => { const name = (sec.indexId ? p.indices.find((i) => i.id === sec.indexId) : undefined)?.name ?? p.indices[0]?.name; return !sec.hidden && [false, true].some((sub) => anchorOf(sectionTitle(sec, name, sub)) === c); });
  if (!s) return c;
  if (s.kind === "pareto") return "cost";
  if (s.kind === "speed") return "output-speed";
  if (s.kind === "rankings") return "rankings";
  return c;
}
