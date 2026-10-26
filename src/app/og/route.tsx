import { linkedLabelScale } from "@/components/chart/label-size";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { mergeImports } from "@/lib/import";
import { loadSnapshot } from "@/data/load";
import { decodeIndices } from "@/lib/url";
import { linkedHighlights, linkedViews } from "@/lib/highlight-link";
import { findTab } from "@/lib/page-layout";
import { renderShareCard } from "@/lib/og";
import { profileCardLook } from "@/lib/og-chart";
import { defaultConfig } from "@/engine";
import { resolveProfileChart } from "@/lib/profile-chart";
import type { Profile } from "@/components/page/IndexPage";
import { readChartHidden } from "@/components/chart/chart-visibility";
import { chartFromLink } from "@/agent/link-chart";
import { cardPalette, renderAnswerChartPng } from "@/lib/og-chart";
import { readRadarParams } from "@/components/chart/radar-view";

export const dynamic = "force-dynamic";

/** Share card for anonymous builds: /og?i=<encoded index>[&name=...][&c=<chart anchor>] */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const snap = await loadSnapshot(u.searchParams.get("date") ?? undefined);
  if (!snap) return new Response("no data", { status: 503 });
  // An assistant chart's link: draw that chart, in the theme the link was copied from.
  const linked = u.searchParams.get("chart"), linkedIndex = u.searchParams.get("i");
  if (linked && linkedIndex) {
    const r = await chartFromLink(linkedIndex, linked, u.searchParams.get("date") ?? undefined);
    if ("chart" in r) {
      const scheme = u.searchParams.get("scheme");
      const png = renderAnswerChartPng(r.chart, cardPalette(u.searchParams.get("theme") ? { preset: u.searchParams.get("theme")! } : undefined, scheme === "dark" || scheme === "light" ? scheme : undefined));
      return new Response(png as unknown as BodyInit, { headers: { "content-type": "image/png", "cache-control": "public, max-age=600, s-maxage=86400, stale-while-revalidate=86400" } });
    }
  }
  const handle = u.searchParams.get("handle");
  const profile = handle && process.env.NEXT_PUBLIC_CONVEX_URL ? await new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL).query(api.profiles.byHandle, { handle }) : null;
  const snapshot = profile ? mergeImports(snap, profile.imports).snapshot : snap;
  const list = decodeIndices(u.searchParams);
  const indices = linkedViews(linkedHighlights(list.length ? list : profile?.indices.length ? profile.indices : [defaultConfig(snapshot)], u.searchParams), u.searchParams);
  const index = findTab(indices, u.searchParams.get("hi")) ?? indices[0];
  const chart = profile ? resolveProfileChart(profile as Profile, u.searchParams.get("c")) : u.searchParams.get("c") ?? undefined;
  // `theme` picks a page theme for this card (the share dialog lets people try others); `scheme` its light or dark version.
  // With neither, a profile's card takes its page theme in the mode the owner chose.
  const themeParam = u.searchParams.get("theme") ?? undefined, scheme = u.searchParams.get("scheme");
  const res = await renderShareCard(snapshot, index, profile ? { name: profile.displayName, handle: profile.handle, avatarUrl: profile.avatarUrl } : { name: u.searchParams.get("name") ?? "" }, { labelScale: linkedLabelScale(u.searchParams), hidden: readChartHidden(u.searchParams, u.searchParams.get("c") ?? undefined), design: u.searchParams.get("design") ?? undefined, chart, cv: u.searchParams.get("cv") ?? undefined, cm: u.searchParams.get("cm") ?? undefined, cs: u.searchParams.get("cs") ?? undefined, scheme: scheme === "dark" || scheme === "light" ? scheme : undefined, ...(themeParam ? { theme: { preset: themeParam } } : profileCardLook(profile?.theme)), radar: readRadarParams(u.searchParams), points: u.searchParams.get("debug") === "points" });
  return new Response(res.body, { status: res.status, headers: { "content-type": res.headers.get("content-type") ?? "image/png", "cache-control": "public, max-age=600, s-maxage=86400, stale-while-revalidate=86400" } });
}
