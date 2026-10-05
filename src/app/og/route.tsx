import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { mergeImports } from "@/lib/import";
import { loadSnapshot } from "@/data/load";
import { decodeIndices } from "@/lib/url";
import { linkedHighlights } from "@/lib/highlight-link";
import { renderShareCard } from "@/lib/og";
import { defaultConfig } from "@/engine";
import { anchorOf, CHART_TITLES } from "@/lib/metrics";
import type { Profile, Section } from "@/components/page/IndexPage";

export const dynamic = "force-dynamic";

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

/** Profile chart links copy `?c=<section title slug>` — map it back to a canonical chart id. */
export function resolveProfileChart(p: Profile, c: string | null | undefined): string | undefined {
  if (!c) return undefined;
  if (c in CHART_TITLES) return c;
  const s = p.sections?.find((sec) => !sec.hidden && anchorOf(sectionTitle(sec, (sec.indexId ? p.indices.find((i) => i.id === sec.indexId) : undefined)?.name ?? p.indices[0]?.name)) === c);
  if (!s) return c;
  if (s.kind === "pareto") return "cost";
  if (s.kind === "speed") return "output-speed";
  if (s.kind === "rankings") return "rankings";
  return c;
}

/** Share card for anonymous builds: /og?i=<encoded index>[&name=...][&c=<chart anchor>] */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const snap = await loadSnapshot(u.searchParams.get("date") ?? undefined);
  if (!snap) return new Response("no data", { status: 503 });
  const handle = u.searchParams.get("handle");
  const profile = handle && process.env.NEXT_PUBLIC_CONVEX_URL ? await new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL).query(api.profiles.byHandle, { handle }) : null;
  const snapshot = profile ? mergeImports(snap, profile.imports).snapshot : snap;
  const list = decodeIndices(u.searchParams);
  const indices = linkedHighlights(list.length ? list : profile?.indices.length ? profile.indices : [defaultConfig(snapshot)], u.searchParams);
  const index = indices.find((i) => i.id === u.searchParams.get("hi")) ?? indices[0];
  const chart = profile ? resolveProfileChart(profile as Profile, u.searchParams.get("c")) : u.searchParams.get("c") ?? undefined;
  const res = await renderShareCard(snapshot, index, profile ? { name: profile.displayName, handle: profile.handle, avatarUrl: profile.avatarUrl } : { name: u.searchParams.get("name") ?? "" }, { design: u.searchParams.get("design") ?? undefined, chart, cv: u.searchParams.get("cv") ?? undefined, cm: u.searchParams.get("cm") ?? undefined, cs: u.searchParams.get("cs") ?? undefined, scheme: u.searchParams.get("scheme") === "dark" ? "dark" : undefined, accent: profile?.theme?.accent, surface: profile?.theme?.surface === "white" ? "#FFFFFF" : undefined, theme: profile?.theme ? { preset: profile.theme.preset, surface: profile.theme.surface } : undefined });
  return new Response(res.body, { status: res.status, headers: { "content-type": res.headers.get("content-type") ?? "image/png", "cache-control": "public, max-age=600, s-maxage=86400, stale-while-revalidate=86400" } });
}
