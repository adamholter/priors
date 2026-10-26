import { anchorOf, CHART_TITLES } from "./metrics";
import { pageLayout } from "./page-layout";
import type { Profile, Section } from "@/components/page/IndexPage";

/** Titles shown when a profile section has no custom title (mirrors IndexPage defaultTitle). */
function sectionTitle(s: Section, indexName?: string): string {
  if (s.title) return s.title;
  switch (s.kind) {
    case "rankings": return indexName ?? "Rankings";
    case "pareto": return `${indexName ?? "Score"} vs cost per task`;
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
  const s = pageLayout(p.indices, p.sections ?? []).find((sec) => !sec.hidden && anchorOf(sectionTitle(sec, (sec.indexId ? p.indices.find((i) => i.id === sec.indexId) : undefined)?.name ?? p.indices[0]?.name)) === c);
  if (!s) return c;
  if (s.kind === "pareto") return "cost";
  if (s.kind === "speed") return "output-speed";
  if (s.kind === "rankings") return "rankings";
  return c;
}
