import type { Metadata } from "next";
import Link from "next/link";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { loadSnapshot } from "@/data/load";
import { SiteFooter } from "@/components/SiteFooter";
import { buildCards, featuredCards, type PublishedPage } from "@/lib/explore-cards";
import { EXPLORE_LIMIT } from "@/lib/explore-find";
import { FeaturedMixCard } from "@/components/explore/ExploreCard";
import { PublishedGrid } from "@/components/explore/PublishedGrid";
import { pageMeta } from "@/lib/site-meta";
import { SiteHeader } from "@/components/SiteHeader";

export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMeta({ title: "Explore rankings", description: "AI model rankings people have built and published on Priors.", path: "/explore" });

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Explore({ searchParams }: PageProps<"/explore">) {
  const sp = await searchParams;
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  let failed = false;
  const [snapshot, pages] = await Promise.all([
    loadSnapshot(),
    url ? new ConvexHttpClient(url).query(api.profiles.explore, {}).catch(() => { failed = true; return [] as PublishedPage[]; }) : Promise.resolve([] as PublishedPage[]),
  ]);
  const featured = featuredCards(snapshot);
  const cards = buildCards(snapshot, pages);

  return <main className="min-h-dvh">
    <SiteHeader current="explore" />
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[36px] leading-tight">Explore</h1>
          <p className="text-ink-2 text-[14px] mt-1">Rankings people have built and published. Open one to see the full page and every chart, or start from it and make it yours.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/rank" className="btn">Rank models · 1 min</Link>
          <Link href="/compare?a=me" className="btn-quiet">Compare</Link>
          <Link href="/model-finder" className="btn-quiet">Model finder</Link>
          <Link href="/builder" className="btn-quiet">Publish yours</Link>
        </div>
      </div>
      {featured.length > 0 && <section className="mb-10" aria-labelledby="featured-mixes">
        <h2 id="featured-mixes" className="text-[22px] mb-3">Featured</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{featured.map((c) => <FeaturedMixCard key={c.name} c={c} />)}</ul>
      </section>}
      <PublishedGrid cards={cards} failed={failed} capped={pages.length >= EXPLORE_LIMIT} initial={{ q: one(sp.q), sort: one(sp.sort), all: one(sp.all) }} />
    </div>
    <SiteFooter />
  </main>;
}
