import { ConvexHttpClient } from "convex/browser";
import { RADAR_PARAM_KEYS } from "@/components/chart/radar-view";
import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { api } from "../../../convex/_generated/api";
import { loadSnapshot } from "@/data/load";
import { mergeImports } from "@/lib/import";
import type { Profile } from "@/components/page/IndexPage";
import { IndexPage } from "@/components/page/IndexPage";
import { ProfileLoader } from "@/components/page/ProfileLoader";
import { clientSnapshot } from "@/data/client-snapshot";
import { PageTransition } from "@/components/PageTransition";
import { chartVariantMode, computeIndex, selectVariants } from "@/engine";
import { prettyQuery } from "@/lib/url";
import { findTab } from "@/lib/page-layout";
import { indexSummary, pageMeta, previewText } from "@/lib/site-meta";
import type { Snapshot } from "@/data/types";
import { linkedHighlights, linkedViews } from "@/lib/highlight-link";
import { chartTitle } from "@/lib/metrics";
import { resolveProfileChart } from "../og/route";
import { isPreviewBot, isSearchBot, PreviewPage } from "@/lib/link-preview";

export const dynamic = "force-dynamic";

const getProfile = cache(async function getProfile(handle: string): Promise<Profile | null> {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  return (await new ConvexHttpClient(url).query(api.profiles.byHandle, { handle })) as Profile | null;
});

function profileWithLink(p: Profile, sp: Record<string, string | string[] | undefined>): Profile {
  const query = new URLSearchParams();
  for (const key of ["hi", "hl", "hv"]) if (typeof sp[key] === "string") query.set(key, sp[key]);
  return { ...p, indices: linkedViews(linkedHighlights(p.indices, query), query) };
}

/** The words of a link preview: whose page, which index and chart, and who leads it today. */
function profileCard(p: Profile, sp: Record<string, string | string[] | undefined>, snapshot: Snapshot | null) {
  const chart = resolveProfileChart(p, typeof sp.c === "string" ? sp.c : undefined);
  const index = findTab(p.indices, typeof sp.hi === "string" ? sp.hi : undefined) ?? p.indices[0];
  const title = [`${p.displayName}’s priors`, index && index !== p.indices[0] ? index.name : undefined, chartTitle(chart)].filter(Boolean).join(" · ");
  const summary = index && snapshot ? indexSummary(mergeImports(snapshot, p.imports ?? []).snapshot, index) : undefined;
  const description = previewText([p.bio, summary ? `${index.name}: ${summary}` : `${p.indices.map((i) => i.name).join(", ")}: a personal index of AI models`]);
  return { chart, index, title, description };
}

/** The link as shared, with only the params a preview or the page reads. */
function shareHref(handle: string, sp: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  for (const key of ["c", "cv", "cm", "cs", "ls", "ch", "hl", "hi", "hv", ...RADAR_PARAM_KEYS]) {
    const value = sp[key];
    for (const item of Array.isArray(value) ? value : typeof value === "string" ? [value] : []) query.append(key, item);
  }
  return `/${handle}${query.size ? `?${prettyQuery(query)}` : ""}`;
}

export async function generateMetadata({ params, searchParams }: PageProps<"/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  const sp = await searchParams;
  const saved = await getProfile(handle);
  if (!saved) return { title: "Page not found" };
  const p = profileWithLink(saved, sp);
  const { chart, index, title, description } = profileCard(p, sp, await loadSnapshot());
  const viewParams = `${typeof sp.cv === "string" ? `&cv=${sp.cv}` : ""}${typeof sp.cm === "string" ? `&cm=${sp.cm}` : ""}${typeof sp.cs === "string" ? `&cs=${sp.cs}` : ""}${typeof sp.ls === "string" ? `&ls=${encodeURIComponent(sp.ls)}` : ""}`;
  const radarQuery = RADAR_PARAM_KEYS.map((key) => typeof sp[key] === "string" ? `&${key}=${encodeURIComponent(sp[key] as string)}` : "").join("");
  const viewIndexParam = typeof sp.hv === "string" ? `&hv=${encodeURIComponent(sp.hv)}` : "";
  const hiddenParams = (Array.isArray(sp.ch) ? sp.ch : typeof sp.ch === "string" ? [sp.ch] : []).map(value => `&ch=${encodeURIComponent(value)}`).join("");
  // `v` gives every saved version of the page its own image address, so a cached preview never outlives an edit.
  const v = Math.round((p as { updatedAt?: number }).updatedAt ?? 0);
  // A link to a chart, a selection or another tab unfurls as that index; the plain page link as the first.
  // The image names the page and the index instead of spelling the index out, which keeps its address short.
  const image = (chart || typeof sp.hl === "string" || typeof sp.hv === "string" || index !== p.indices[0]) && index
    ? { url: `/og?handle=${handle}&hi=${encodeURIComponent(index.id)}${typeof sp.hl === "string" ? `&hl=${encodeURIComponent(sp.hl)}` : ""}${chart ? `&c=${encodeURIComponent(typeof sp.c === "string" ? sp.c : chart)}` : ""}${viewParams}${viewIndexParam}${radarQuery}${hiddenParams}&v=${v}`, width: 1200, height: 630, alt: title }
    : { url: `/${handle}/opengraph-image?v=${v}`, width: 1200, height: 630, alt: title };
  return pageMeta({ title, description, path: `/${handle}`, share: shareHref(handle, sp), image, type: "profile" });
}

export default async function Page({ params, searchParams }: PageProps<"/[handle]">) {
  const { handle } = await params;
  const sp = await searchParams;
  const saved = await getProfile(handle);
  if (!saved) notFound();
  const p = profileWithLink(saved, sp);
  const snap = await loadSnapshot();
  if (await isPreviewBot()) {
    // Link-preview crawlers cap response size — give them the tags plus a tiny body, not the app.
    const { title, description } = profileCard(p, sp, snap);
    return <PreviewPage title={title} description={description} href={shareHref(handle, sp)} />;
  }
  if (!snap) notFound();
  const { snapshot } = mergeImports(snap, p.imports ?? []);
  const tab = typeof sp.hi === "string" ? sp.hi : undefined;
  const open = findTab(p.indices, tab) ?? p.indices[0];
  // The index whose selection came from the link: its share link has to keep spelling that selection out.
  const linkedHighlight = typeof sp.hl === "string" ? open?.id : undefined;
  // Likewise the index whose display settings (hidden models and so on) came from the link.
  const linkedView = typeof sp.hv === "string" ? open?.id : undefined;
  if (await isSearchBot()) return <PageTransition><IndexPage profile={p} snapshot={clientSnapshot(snapshot)} edit={false} tab={tab} linkedHighlight={linkedHighlight} linkedView={linkedView} /></PageTransition>;
  const leaders = open ? selectVariants(computeIndex(snapshot, { ...open, variants: "all" }).ranked, chartVariantMode(open, "ranking")).slice(0, 10).map((r) => ({ name: r.model.name, score: r.score })) : [];
  return <PageTransition><ProfileLoader key={`${p.handle}-${snapshot.generatedAt}`} profile={p} version={snapshot.generatedAt} edit={sp.edit === "1"} tab={tab} linkedHighlight={linkedHighlight} linkedView={linkedView} leaders={leaders} /></PageTransition>;
}
