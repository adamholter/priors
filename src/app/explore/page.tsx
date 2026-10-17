import type { Metadata } from "next";
import { HeaderAccount } from "@/components/AccountMenu";
import Link from "next/link";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { loadSnapshot } from "@/data/load";
import { chartVariantMode, computeIndex, PAGE_VIEW, selectVariants, type IndexConfig } from "@/engine";
import type { Snapshot } from "@/data/types";
import { Wordmark } from "@/components/Wordmark";
import { SiteNav } from "@/components/SiteNav";
import { SettingsButton } from "@/components/SiteSettings";
import { encodeIndices, prettyQuery } from "@/lib/url";
import { rankedCount } from "@/lib/ranked-count";
import { pageMeta } from "@/lib/site-meta";

export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMeta({ title: "Explore rankings", description: "AI model rankings people have built and published on Priors.", path: "/explore" });

/** `indices` holds the main index only; the page's other tabs come as names. */
type Published = { handle: string; displayName: string; bio?: string; avatarUrl?: string; updatedAt: number; indices: IndexConfig[]; others: string[]; more: number };

/** Leaders and biggest weights of a page's first index, computed against the current snapshot. */
function summary(snapshot: Snapshot, index: IndexConfig) {
  try {
    const r = computeIndex(snapshot, { ...index, variants: "all" }, PAGE_VIEW);
    const top = selectVariants(r.ranked, chartVariantMode(index, "ranking")).slice(0, 3);
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
    <header className="flex items-center gap-5 px-4 sm:px-8 h-14 border-b hairline">
      <Wordmark />
      <SiteNav current="explore" />
      <span className="ml-auto flex items-center gap-2"><HeaderAccount /><SettingsButton /></span>
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
          <Link href="/model-finder" className="btn-quiet">Model finder</Link>
          <Link href="/builder" className="btn-quiet">Publish yours</Link>
        </div>
      </div>
      {!pages.length ? <p className="cap py-16 text-center">No published pages yet. Build an index and claim your page to be the first.</p> :
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((p) => {
          const index = p.indices[0];
          const s = snapshot && index ? summary(snapshot, index) : null;
          return <li key={p.handle} className="grid grid-rows-[1fr_auto] border hairline rounded-md bg-white overflow-hidden">
            <Link href={`/${p.handle}` as "/"} className="explore-card group grid gap-3 p-4 hover:bg-hair-2 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                {p.avatarUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={p.avatarUrl} alt="" width={36} height={36} className="w-9 h-9 rounded-full object-cover border hairline shrink-0" />
                  : <span aria-hidden="true" className="w-9 h-9 rounded-full border hairline grid place-items-center text-grey shrink-0">{p.displayName.slice(0, 1).toUpperCase()}</span>}
                <div className="min-w-0">
                  <div className="text-[14.5px] text-ink truncate">{p.displayName}</div>
                  <div className="cap truncate">@{p.handle} · {ago(p.updatedAt)}</div>
                </div>
              </div>
              <div className="grid gap-1">
                <div className="text-[19px] leading-snug text-ink group-hover:text-indigo" style={{ fontFamily: "var(--font-newsreader), Newsreader, Georgia, serif" }}>{index?.name ?? "Rankings"}</div>
                {p.more > 0 && <p className="cap truncate" title={p.others.join(", ")}>Also {p.others.join(", ")}{p.more > p.others.length ? ` and ${p.more - p.others.length} more` : ""}</p>}
              </div>
              {s?.top.length ? <ol className="grid gap-1.5">
                {s.top.map((r, i) => <li key={r.variant.id} className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-2 text-[13px]">
                  <span className="cap text-right">{i + 1}</span>
                  <span className="flex items-center gap-2 min-w-0"><i aria-hidden="true" className="w-2 h-2 rounded-full shrink-0" style={{ background: colors.get(r.model.labId) ?? "#A3A39B" }} /><span className="truncate">{r.model.name}</span></span>
                  <span className="num text-ink-2">{r.score.toFixed(1)}</span>
                </li>)}
              </ol> : <p className="cap">No ranked models on today&apos;s data.</p>}
              {s && s.count > 0 && <p className="cap leading-relaxed mt-auto">{s.count} benchmark{s.count === 1 ? "" : "s"} · {s.benches.map((b) => `${b.benchmark.shortName ?? b.benchmark.name} ${Math.round(b.share)}%`).join(", ")}</p>}
            </Link>
            {index && <Link href={`/builder?${prettyQuery(encodeIndices([{ ...index, name: `From @${p.handle}` }]))}` as "/builder"} title={`Open @${p.handle}'s mix in the builder as your own copy`} className="border-t hairline px-4 py-2.5 text-[12px] text-ink-2 hover:text-indigo hover:bg-hair-2 transition-colors">Start from this</Link>}
          </li>;
        })}
      </ul>}
    </div>
  </main>;
}
