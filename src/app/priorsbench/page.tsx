import Link from "next/link";
import { unstable_cache } from "next/cache";
import { loadSnapshot } from "@/data/load";
import { SettingsButton } from "@/components/SiteSettings";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { Wordmark } from "@/components/Wordmark";
import { HeaderAccount } from "@/components/AccountMenu";
import { Podium, PriorsBenchBoard } from "@/components/PriorsBenchBoard";
import { pageMeta } from "@/lib/site-meta";
import { fetchRankings, HALF_LIFE_DAYS, MIN_RANKINGS, PRIORS_CONVEX_URL } from "@/lib/priorsbench";
import { buildBoard } from "@/lib/priorsbench-board";

export const dynamic = "force-dynamic";
export const metadata = pageMeta({ title: "PriorsBench", description: "The AI models people rank highest on Priors: an Elo-scale leaderboard from every ranking, with head-to-head records and history.", path: "/priorsbench" });

/** The votes and the whole board, recomputed at most every 15 minutes (and when the snapshot changes). */
const board = unstable_cache(async (date: string) => { void date; return buildBoard(await fetchRankings(PRIORS_CONVEX_URL), await loadSnapshot()); }, ["priorsbench-board-v2"], { revalidate: 900 });

const shortDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default async function Page() {
  const snapshot = await loadSnapshot();
  let data: Awaited<ReturnType<typeof board>> | null = null;
  try { data = await board(snapshot?.date ?? ""); } catch (e) { console.error("PriorsBench failed", e); }
  const stats: [string, string][] = data ? [[data.totals.rankings.toLocaleString("en-US"), "rankings"], [data.totals.votes.toLocaleString("en-US"), "head-to-head votes"], [String(data.totals.models), "models rated"], [shortDate(data.totals.since), "first ranking"]] : [];
  return (
    <main className="min-h-screen">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-8 py-2 sm:min-h-14 border-b hairline"><div className="flex items-center gap-5"><Wordmark /><span className="max-sm:hidden"><SiteNav /></span></div><span className="ml-auto flex items-center gap-2"><HeaderAccount /><SettingsButton /></span><span className="sm:hidden w-full"><SiteNav mobile /></span></header>
      <div className="max-w-[1240px] mx-auto px-4 sm:px-8 py-10 sm:py-12 grid gap-12">
        <div className="grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-end">
          <div className="grid gap-7">
            <div className="grid gap-2">
              <h1 className="font-serif text-[40px] sm:text-[52px] leading-none text-ink">PriorsBench</h1>
              <p className="text-[15px] text-ink-2">The models people rank highest on Priors.</p>
            </div>
            {stats.length > 0 && <dl className="grid grid-cols-2 sm:grid-cols-[repeat(4,auto)] gap-x-9 gap-y-4 w-fit">
              {stats.map(([n, label]) => <div key={label} className="flex flex-col"><dt className="cap order-2 whitespace-nowrap">{label}</dt><dd className="order-1 font-mono text-[22px] sm:text-[24px] tabular-nums text-ink leading-tight whitespace-nowrap">{n}</dd></div>)}
            </dl>}
            <Link href="/rank" className="w-fit inline-flex items-center h-11 px-5 rounded-[4px] bg-[var(--indigo-fill)] text-[var(--on-accent)] text-[14px] font-medium transition-transform hover:-translate-y-px active:translate-y-px">Add your ranking</Link>
          </div>
          {data && <Podium rows={data.views[0].rows.slice(0, 3)} floor={Math.min(...data.views[0].rows.map((r) => r.rating))} />}
        </div>

        {data ? <PriorsBenchBoard data={data} /> : <p className="text-ink-2">The rankings could not be loaded. Try again in a minute.</p>}

        <details className="max-w-[720px] text-[14px] leading-[1.7] text-ink-2">
          <summary className="disclosure text-ink w-fit hit">How it&rsquo;s scored</summary>
          <ul className="mt-3 grid gap-1.5 list-disc pl-5">
            <li>Each ranking counts every higher model as beating every lower one, fitted with Bradley-Terry on the Elo scale (400 points apart means placed higher 10 times in 11).</li>
            <li>Recent rankings count more: weight halves every {HALF_LIFE_DAYS} days. A model needs {MIN_RANKINGS} rankings.</li>
            <li>Rank range comes from 95% intervals over 100 resamples. A repeated lineup within a day counts once, and no day counts more than three times a typical day.</li>
            <li>It measures belief, not ability, so it is never in a default mix. It is also on the <Link href="/benchmarks/priorsbench" className="text-indigo hover:underline">benchmark list</Link>.</li>
          </ul>
        </details>
      </div>
      <SiteFooter />
    </main>
  );
}
