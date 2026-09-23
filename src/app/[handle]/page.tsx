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

export const dynamic = "force-dynamic";

async function getProfile(handle: string): Promise<Profile | null> {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  return (await new ConvexHttpClient(url).query(api.profiles.byHandle, { handle })) as Profile | null;
}

export async function generateMetadata({ params, searchParams }: PageProps<"/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  const sp = await searchParams;
  const p = await getProfile(handle);
  if (!p) return {};
  const chart = resolveProfileChart(p, typeof sp.c === "string" ? sp.c : undefined);
  const ct = chartTitle(chart);
  const base = `${p.displayName}’s priors`;
  const title = ct ? `${base} · ${ct}` : base;
  const description = p.bio || `${p.indices.map((i) => i.name).join(", ")} — a personal index of AI models.`;
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
  const date = typeof sp.date === "string" ? sp.date : undefined;
  const [snap, dates] = await Promise.all([loadSnapshot(date), listSnapshotDates()]);
  if (!snap) notFound();
  const { snapshot } = mergeImports(snap, p.imports ?? []);
  return <PageTransition><IndexPage profile={p} snapshot={snapshot} dates={dates} edit={sp.edit === "1"} /></PageTransition>;
}
