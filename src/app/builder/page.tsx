import type { Metadata } from "next";
import { BuilderLoader } from "@/components/BuilderLoader";
import { Builder } from "@/components/Builder";
import { clientSnapshot } from "@/data/client-snapshot";
import { PageTransition } from "@/components/PageTransition";
import { loadSnapshot } from "@/data/load";
import { decodeIndices, prettyQuery } from "@/lib/url";
import { indexSummary, pageMeta, previewText } from "@/lib/site-meta";
import { chartTitle } from "@/lib/metrics";
import { RADAR_PARAM_KEYS } from "@/components/chart/radar-view";
import { isPreviewBot, isSearchBot, PreviewPage } from "@/lib/link-preview";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

async function cardFor(sp: SP) {
  const query = new URLSearchParams();
  for (const key of ["i", "design", "handle", "c", "cv", "cm", "cs", "ls", "ch", "scheme", "theme", ...RADAR_PARAM_KEYS]) {
    const value = sp[key];
    for (const item of Array.isArray(value) ? value : value ? [value] : []) query.append(key, item);
  }
  const index = decodeIndices(query)[0];
  const ct = chartTitle(typeof sp.c === "string" ? sp.c : undefined);
  // No index in the link: the builder itself, on the default mix.
  const base = index?.name ?? "Builder";
  const title = ct ? `${base} · ${ct}` : base;
  const snapshot = index ? await loadSnapshot() : null;
  const summary = index && snapshot ? indexSummary(snapshot, index) : undefined;
  const desc = summary ? previewText([ct ? `${ct}: ${summary}` : summary]) : undefined;
  return { query, title, desc };
}

export async function generateMetadata({ searchParams }: PageProps<"/builder">): Promise<Metadata> {
  const { query, title, desc } = await cardFor(await searchParams);
  const image = { url: query.size ? `/og?${query}` : "/og", width: 1200, height: 630, alt: `${title} model rankings` };
  return pageMeta({ title, description: desc, path: "/builder", share: query.size ? `/builder?${prettyQuery(query)}` : "/builder", image });
}

export default async function Home({ searchParams }: PageProps<"/builder">) {
  const sp = await searchParams;
  if (await isPreviewBot()) {
    // Link-preview crawlers cap response size — give them the tags plus a tiny body, not the app.
    const { query, title, desc } = await cardFor(sp);
    return <PreviewPage title={title} description={desc} href={query.size ? `/builder?${prettyQuery(query)}` : "/builder"} />;
  }
  const i = sp.i == null ? [] : Array.isArray(sp.i) ? sp.i : [sp.i];
  if (await isSearchBot()) {
    const snapshot = await loadSnapshot();
    if (!snapshot) return <main className="p-10">No benchmark snapshot available.</main>;
    return <PageTransition><Builder snapshot={clientSnapshot(snapshot)} initialIndices={decodeIndices(i)} /></PageTransition>;
  }
  return <PageTransition><BuilderLoader initialIndices={decodeIndices(i)} /></PageTransition>;
}
