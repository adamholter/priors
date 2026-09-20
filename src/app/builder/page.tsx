import type { Metadata } from "next";
import { Builder } from "@/components/Builder";
import { listSnapshotDates, loadSnapshot } from "@/data/load";
import { decodeIndices } from "@/lib/url";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: PageProps<"/builder">): Promise<Metadata> {
  const sp = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["i", "date", "design", "handle"]) {
    const value = sp[key];
    for (const item of Array.isArray(value) ? value : value ? [value] : []) query.append(key, item);
  }
  const index = decodeIndices(query)[0];
  const title = index?.name ?? "priors";
  const image = { url: `/og?${query}`, width: 1200, height: 630, alt: `${title} model rankings` };
  return { title, openGraph: { title, images: [image] }, twitter: { card: "summary_large_image", title, images: [image] } };
}

export default async function Home({ searchParams }: PageProps<"/builder">) {
  const sp = await searchParams;
  const date = typeof sp.date === "string" ? sp.date : undefined;
  const [snapshot, dates] = await Promise.all([loadSnapshot(date), listSnapshotDates()]);
  if (!snapshot) return <main className="p-10"><h1 className="text-3xl">priors</h1><p className="mt-3 text-ink-2">No snapshot yet. Run <code className="mono">npm run scrape</code>.</p></main>;
  const i = sp.i == null ? [] : Array.isArray(sp.i) ? sp.i : [sp.i];
  return <Builder snapshot={snapshot} dates={dates} initialIndices={decodeIndices(i)} />;
}
