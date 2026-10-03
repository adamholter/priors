import { ConvexHttpClient } from "convex/browser";
import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { api } from "../../../convex/_generated/api";
import { listSnapshotDates, loadSnapshot } from "@/data/load";
import { mergeImports } from "@/lib/import";
import type { Profile } from "@/components/page/IndexPage";
import { IndexPage } from "@/components/page/IndexPage";
import { ProfileLoader } from "@/components/page/ProfileLoader";
import { clientSnapshot } from "@/data/client-snapshot";
import { PageTransition } from "@/components/PageTransition";
import { chartVariantMode, computeIndex, selectVariants } from "@/engine";
import { encodeIndex } from "@/lib/url";
import { linkedHighlights } from "@/lib/highlight-link";
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
  for (const key of ["hi", "hl"]) if (typeof sp[key] === "string") query.set(key, sp[key]);
  return { ...p, indices: linkedHighlights(p.indices, query) };
}

function profileCard(p: Profile, sp: Record<string, string | string[] | undefined>) {
  const chart = resolveProfileChart(p, typeof sp.c === "string" ? sp.c : undefined);
  const ct = chartTitle(chart);
  const base = `${p.displayName}’s priors`;
  const title = ct ? `${base} · ${ct}` : base;
  const description = p.bio || `${p.indices.map((i) => i.name).join(", ")} — a personal index of AI models.`;
  return { chart, title, description };
}

export async function generateMetadata({ params, searchParams }: PageProps<"/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  const sp = await searchParams;
  const saved = await getProfile(handle);
  if (!saved) return {};
  const p = profileWithLink(saved, sp);
  const { chart, title, description } = profileCard(p, sp);
  const viewParams = `${typeof sp.cv === "string" ? `&cv=${sp.cv}` : ""}${typeof sp.cm === "string" ? `&cm=${sp.cm}` : ""}`;
  const index = p.indices.find((i) => i.id === sp.hi) ?? p.indices[0];
  const image = (chart || typeof sp.hl === "string") && index
    ? { url: `/og?handle=${handle}&i=${encodeURIComponent(encodeIndex(index))}${chart ? `&c=${chart}` : ""}${viewParams}`, width: 1200, height: 630, alt: title }
    : { url: `/${handle}/opengraph-image?v=${Math.round((p as { updatedAt?: number }).updatedAt ?? 0)}`, width: 1200, height: 630, alt: title };
  const query = new URLSearchParams();
  for (const key of ["c", "cv", "cm", "date", "hl", "hi"]) if (typeof sp[key] === "string") query.set(key, sp[key]);
  return { title, description, alternates: { canonical: `/${handle}` }, openGraph: { title, description, type: "profile", url: `/${handle}${query.size ? `?${query}` : ""}`, images: [image] }, twitter: { card: "summary_large_image", title, description, images: [image.url] } };
}

export default async function Page({ params, searchParams }: PageProps<"/[handle]">) {
  const { handle } = await params;
  const sp = await searchParams;
  const saved = await getProfile(handle);
  if (!saved) notFound();
  const p = profileWithLink(saved, sp);
  if (await isPreviewBot()) {
    // Link-preview crawlers cap response size — give them the tags plus a tiny body, not the app.
    const { title, description } = profileCard(p, sp);
    const query = new URLSearchParams();
    for (const key of ["c", "cv", "cm", "date", "hl", "hi"]) if (typeof sp[key] === "string") query.set(key, sp[key]);
    return <PreviewPage title={title} description={description} href={`/${handle}${query.size ? `?${query}` : ""}`} />;
  }
  const date = typeof sp.date === "string" ? sp.date : undefined;
  const [snap, dates] = await Promise.all([loadSnapshot(date), listSnapshotDates()]);
  if (!snap) notFound();
  const { snapshot } = mergeImports(snap, p.imports ?? []);
  if (await isSearchBot()) return <PageTransition><IndexPage profile={p} snapshot={clientSnapshot(snapshot)} dates={dates} edit={false} /></PageTransition>;
  const first = p.indices[0];
  const leaders = first ? selectVariants(computeIndex(snapshot, { ...first, variants: "all" }).ranked, chartVariantMode(first, "ranking")).slice(0, 10).map((r) => ({ name: r.model.name, score: r.score })) : [];
  return <PageTransition><ProfileLoader key={`${p.handle}-${snapshot.generatedAt}`} profile={p} date={snapshot.date} version={snapshot.generatedAt} dates={dates} edit={sp.edit === "1"} leaders={leaders} /></PageTransition>;
}
