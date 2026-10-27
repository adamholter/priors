import Link from "next/link";
import type { Metadata } from "next";
import { loadSnapshot } from "@/data/load";
import { Wordmark } from "@/components/Wordmark";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { benchmarkPath } from "@/lib/benchmark-slug";
import { pageMeta } from "@/lib/site-meta";

export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMeta({ title: "Benchmarks", description: "Every benchmark Priors tracks, each with its own leaderboard and a cost chart adjusted for subscription plans.", path: "/benchmarks" });

export default async function Page() {
  const snapshot = await loadSnapshot();
  const count = new Map<string, number>();
  for (const o of snapshot?.observations ?? []) count.set(o.benchmarkId, (count.get(o.benchmarkId) ?? 0) + 1);
  const superseded = new Set((snapshot?.benchmarks ?? []).map((b) => b.versionPolicy?.kind === "fresh" ? b.versionPolicy.supersedes : undefined));
  const list = (snapshot?.benchmarks ?? []).filter((b) => count.has(b.id) && !b.proxy);
  const groups = [...new Set(list.map((b) => b.category))].sort();
  return (
    <main className="min-h-screen">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 sm:px-8 py-2 sm:h-14 border-b hairline"><Wordmark /><span className="max-sm:hidden"><SiteNav /></span></header>
      <div className="max-w-[1100px] mx-auto px-5 sm:px-8 py-10 grid gap-10">
        <div><h1 className="text-[38px] leading-tight">Benchmarks</h1><p className="text-[14px] text-ink-2 mt-2 max-w-[62ch]">{list.length} benchmarks, each with its own leaderboard. Where a benchmark publishes cost per task, its cost chart uses that data, adjusted for subscription plans.</p></div>
        {groups.map((g) => <section key={g} className="grid gap-2">
          <h2 className="text-[20px] border-b hairline pb-2 capitalize">{g}</h2>
          <ul className="grid gap-x-8 sm:grid-cols-2">{list.filter((b) => b.category === g).sort((a, b) => a.name.localeCompare(b.name)).map((b) =>
            <li key={b.id}><Link href={benchmarkPath(b.id) as "/"} className="flex items-baseline justify-between gap-3 py-1.5 text-[14px] hover:text-ink text-ink-2"><span className="truncate">{b.name}{superseded.has(b.id) ? <span className="cap"> · older version</span> : null}</span><span className="cap shrink-0">{count.get(b.id)}</span></Link></li>)}</ul>
        </section>)}
      </div>
      <SiteFooter />
    </main>
  );
}
