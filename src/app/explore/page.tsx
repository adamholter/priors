import type { Metadata } from "next";
import { HeaderAccount } from "@/components/AccountMenu";
import Link from "next/link";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { loadSnapshot } from "@/data/load";
import { computeIndex, PAGE_VIEW, rankingRows, type IndexConfig } from "@/engine";
import type { Snapshot } from "@/data/types";
import { Wordmark } from "@/components/Wordmark";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { SettingsButton } from "@/components/SiteSettings";
import { encodeIndices, prettyQuery } from "@/lib/url";
import { rankedCount } from "@/lib/ranked-count";
import { ExploreCard, type ExploreCardData } from "@/components/explore/ExploreCard";
import { pageMeta } from "@/lib/site-meta";

export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMeta({ title: "Explore rankings", description: "AI model rankings people have built and published on Priors.", path: "/explore" });

/** `indices` holds the main index only; the page's other tabs come as names. */
type Published = { handle: string; displayName: string; bio?: string; avatarUrl?: string; theme?: ExploreCardData["theme"]; socials?: { label: string; url: string }[]; updatedAt: number; indices: IndexConfig[]; others: string[]; more: number };

/** Leaders and biggest weights of a page's first index, computed against the current snapshot. */
function summary(snapshot: Snapshot, index: IndexConfig) {
  try {
    const r = computeIndex(snapshot, { ...index, variants: "all" }, PAGE_VIEW);
    const top = rankingRows(r.ranked, index).slice(0, 3);
    const benches = [...r.benchmarks].sort((a, b) => b.share - a.share);
    return { top, benches: benches.slice(0, 3), count: benches.length };
  } catch {
    return { top: [], benches: [], count: 0 };
  }
}

const ago = (t: number) => {
  const d = Math.floor((Date.now() - t) / 86_400_000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : d < 30 ? `${d} days ago` : new Date(t).toISOString().slice(0, 10);
};

export default async function Explore() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const [snapshot, pages, ranked] = await Promise.all([
    loadSnapshot(),
    url ? new ConvexHttpClient(url).query(api.profiles.explore, {}).catch(() => [] as Published[]) : Promise.resolve([] as Published[]),
    rankedCount(),
  ]);
  const colors = new Map(snapshot?.labs.map((l) => [l.id, l.color]) ?? []);

  return <main className="min-h-dvh">
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-8 py-2 sm:h-14 border-b hairline">
      <div className="flex items-center gap-5"><Wordmark /><span className="max-sm:hidden"><SiteNav current="explore" /></span></div>
      <span className="ml-auto flex items-center gap-2"><HeaderAccount /><SettingsButton /></span>
      <span className="sm:hidden w-full"><SiteNav current="explore" /></span>
    </header>
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[36px] leading-tight">Explore</h1>
          <p className="text-ink-2 text-[14px] mt-1">Rankings people have built and published. Open one to see the full page and every chart, or start from it and make it yours.</p>
          {ranked > 20 && <p className="cap mt-2">{ranked.toLocaleString()}{ranked >= 1000 ? "+" : ""} rankings made · {pages.length} published</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/rank" className="btn">Rank models · 1 min</Link>
          <Link href="/compare?a=me" className="btn-quiet">Compare</Link>
          <Link href="/model-finder" className="btn-quiet">Model finder</Link>
          <Link href="/builder" className="btn-quiet">Publish yours</Link>
        </div>
      </div>
      {!pages.length ? <p className="cap py-16 text-center">No published pages yet. Build an index and claim your page to be the first.</p> :
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((p) => {
          const index = p.indices[0];
          const s = snapshot && index ? summary(snapshot, index) : null;
          if (!index) return null;
          const x = p.socials?.map((l) => l.url.match(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/@?([A-Za-z0-9_]{1,15})\/?(?:[?#].*)?$/)?.[1]).find(Boolean);
          return <ExploreCard key={p.handle} c={{
            handle: p.handle, name: p.displayName, avatarUrl: p.avatarUrl, when: ago(p.updatedAt), index: index.name ?? "Rankings", others: p.others, more: p.more,
            count: s?.count ?? 0, mix: (s?.benches ?? []).map((b) => ({ name: b.benchmark.shortName ?? b.benchmark.name, share: Math.round(b.share) })),
            top: (s?.top ?? []).map((r) => ({ name: r.model.name, score: r.score, labId: r.model.labId, base: colors.get(r.model.labId) ?? "#A3A39B" })),
            theme: p.theme, x, pageHref: `/${p.handle}`, compareHref: `/compare?a=me&b=@${p.handle}`, remixHref: `/builder?${prettyQuery(encodeIndices([{ ...index, name: `From @${p.handle}` }]))}`,
          }} />;
        })}
      </ul>}
    </div>
    <SiteFooter />
  </main>;
}
