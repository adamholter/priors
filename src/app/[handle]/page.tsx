import { ConvexHttpClient } from "convex/browser";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { api } from "../../../convex/_generated/api";
import { listSnapshotDates, loadSnapshot } from "@/data/load";
import { mergeImports } from "@/lib/import";
import { IndexPage, type Profile } from "@/components/page/IndexPage";
import { PageTransition } from "@/components/PageTransition";
import { encodeIndex } from "@/lib/url";
import { chartTitle } from "@/lib/metrics";
import { resolveProfileChart } from "../og/route";
import { isPreviewBot, PreviewPage } from "@/lib/link-preview";

export const dynamic = "force-dynamic";

async function getProfile(handle: string): Promise<Profile | null> {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  return (await new ConvexHttpClient(url).query(api.profiles.byHandle, { handle })) as Profile | null;
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
  const p = await getProfile(handle);
  if (!p) return {};
  const { chart, title, description } = profileCard(p, sp);
  const image = chart && p.indices[0]
    ? { url: `/og?handle=${handle}&i=${encodeURIComponent(encodeIndex(p.indices[0]))}&c=${chart}`, width: 1200, height: 630, alt: title }
    : { url: `/${handle}/opengraph-image?v=${Math.round((p as { updatedAt?: number }).updatedAt ?? 0)}`, width: 1200, height: 630, alt: title };
  return { title, description, alternates: { canonical: `/${handle}` }, openGraph: { title, description, type: "profile", url: `/${handle}`, images: [image] }, twitter: { card: "summary_large_image", title, description, images: [image.url] } };
}

export default async function Page({ params, searchParams }: PageProps<"/[handle]">) {
  const { handle } = await params;
  const sp = await searchParams;
  const p = await getProfile(handle);
  if (!p) notFound();
  if (await isPreviewBot()) {
    // Link-preview crawlers cap response size — give them the tags plus a tiny body, not the app.
    const { title, description } = profileCard(p, sp);
    const c = typeof sp.c === "string" ? `?c=${sp.c}` : "";
    return <PreviewPage title={title} description={description} href={`/${handle}${c}`} />;
  }
  const date = typeof sp.date === "string" ? sp.date : undefined;
  const [snap, dates] = await Promise.all([loadSnapshot(date), listSnapshotDates()]);
  if (!snap) notFound();
  const { snapshot } = mergeImports(snap, p.imports ?? []);
  return <PageTransition><IndexPage profile={p} snapshot={snapshot} dates={dates} edit={sp.edit === "1"} /></PageTransition>;
}
