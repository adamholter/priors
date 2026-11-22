import Link from "next/link";
import { unstable_cache } from "next/cache";
import { loadSnapshot } from "@/data/load";
import { SettingsButton } from "@/components/SiteSettings";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { Wordmark } from "@/components/Wordmark";
import { HeaderAccount } from "@/components/AccountMenu";
import { LabLogo } from "@/components/LabLogo";
import { PriorsBenchChart, type BenchLine } from "@/components/PriorsBenchChart";
import { pageMeta } from "@/lib/site-meta";
import { dedupe, fetchRankings, HALF_LIFE_DAYS, history, MIN_RANKINGS, PRIORS_CONVEX_URL, rate } from "@/lib/priorsbench";

export const dynamic = "force-dynamic";
export const metadata = pageMeta({ title: "PriorsBench", description: "What people think the best AI models are: every ranking finished on Priors, fitted into an Elo-scale leaderboard and tracked week by week.", path: "/priorsbench" });

const CHART_LINES = 8;

/** The votes and the fitted board, recomputed at most every 15 minutes. */
const board = unstable_cache(async (known: string[]) => {
  const rankings = await fetchRankings(PRIORS_CONVEX_URL);
  const has = new Set(known), isKnown = (id: string) => has.has(id);
  const now = Date.now();
  return { ratings: rate(rankings, { asOf: now, bootstrap: 100, known: isKnown }), weeks: history(rankings, { now, known: isKnown }), total: dedupe(rankings).length, first: Math.min(...rankings.map((r) => r.createdAt)) };
}, ["priorsbench-v1"], { revalidate: 900 });

const longDate = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export default async function Page() {
  const snapshot = await loadSnapshot();
  const models = new Map(snapshot?.models.map((m) => [m.id, m]));
  const labs = new Map(snapshot?.labs.map((l) => [l.id, l]));
  let data: Awaited<ReturnType<typeof board>> | null = null;
  try { data = await board([...models.keys()].sort()); } catch (e) { console.error("PriorsBench failed", e); }
  const ratings = data?.ratings ?? [];
  const top = ratings.slice(0, CHART_LINES).map((r) => r.modelId);
  const dates = data?.weeks.map((w) => w.date) ?? [];
  const lines: BenchLine[] = top.map((id) => {
    const m = models.get(id);
    return { id, name: m?.name ?? id, points: (data?.weeks ?? []).flatMap((w) => { const r = w.ratings.find((x) => x.modelId === id); return r ? [{ date: w.date, rating: r.rating }] : []; }) };
  });
  return (
    <main className="min-h-screen">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-8 py-2 sm:h-14 border-b hairline"><div className="flex items-center gap-5"><Wordmark /><span className="max-sm:hidden"><SiteNav /></span></div><span className="ml-auto flex items-center gap-2"><HeaderAccount /><SettingsButton /></span></header>
      <article className="max-w-[760px] mx-auto px-4 sm:px-8 py-12 grid gap-10 text-[15px] leading-[1.7] text-ink-2">
        <div className="grid gap-3">
          <Link href="/benchmarks" className="cap hover:text-ink">Benchmarks</Link>
          <h1 className="text-[36px] leading-tight text-ink">PriorsBench</h1>
          <p>What people think the best models are. Everyone who ranks models on Priors puts a lineup in order, best first. Each of those rankings counts as votes that every model beat the ones placed below it, and the votes are fitted into one rating per model, the way an arena turns head-to-head votes into Elo.</p>
          {data && <p className="text-[13px] text-grey">{data.total.toLocaleString("en-US")} rankings since {longDate(data.first)} &middot; {ratings.length} models rated &middot; updated every 15 minutes</p>}
          <p><Link href="/rank" className="text-indigo hover:underline">Add your ranking &rarr;</Link></p>
        </div>

        {!data && <p>The rankings could not be loaded just now. Try again in a minute.</p>}

        {ratings.length > 0 && <section className="grid gap-3" aria-labelledby="board">
          <h2 id="board" className="text-[22px] text-ink">The board</h2>
          <div className="grid">
            <div className="grid grid-cols-[28px_minmax(0,1fr)_60px_110px_64px] max-sm:grid-cols-[22px_minmax(0,1fr)_52px_56px] gap-x-3 items-center text-[11px] font-mono text-grey pb-2 border-b hairline"><span>#</span><span>Model</span><span className="text-right">Rating</span><span className="max-sm:hidden">95% range</span><span className="text-right">Rankings</span></div>
            {ratings.map((r, i) => {
              const m = models.get(r.modelId);
              return <div key={r.modelId} className="grid grid-cols-[28px_minmax(0,1fr)_60px_110px_64px] max-sm:grid-cols-[22px_minmax(0,1fr)_52px_56px] gap-x-3 items-center py-2 border-b hairline text-[14px]">
                <span className="font-mono text-[12px] text-grey">{i + 1}</span>
                <span className="flex items-center gap-2 min-w-0">{m && <LabLogo lab={m.labId} name={labs.get(m.labId)?.name ?? m.labId} color={labs.get(m.labId)?.color} size={16} />}<Link href={`/models/${r.modelId}`} className="truncate text-ink hover:underline">{m?.name ?? r.modelId}</Link></span>
                <span className="text-right font-mono tabular-nums text-ink">{Math.round(r.rating)}</span>
                <span className="font-mono tabular-nums text-[12px] text-grey max-sm:hidden">{r.ci ? `${Math.round(r.ci[0])} to ${Math.round(r.ci[1])}` : ""}</span>
                <span className="text-right font-mono tabular-nums text-[12px] text-grey">{r.rankings.toLocaleString("en-US")}</span>
              </div>;
            })}
          </div>
        </section>}

        {lines.length > 0 && dates.length > 1 && <section className="grid gap-3" aria-labelledby="time">
          <h2 id="time" className="text-[22px] text-ink">Over time</h2>
          <p>The top {lines.length} today, rated at the end of each week from the rankings made by then. A line starts once a model has {MIN_RANKINGS} rankings.</p>
          <PriorsBenchChart dates={dates} lines={lines} />
        </section>}

        <section className="grid gap-3" aria-labelledby="how">
          <h2 id="how" className="text-[22px] text-ink">How it works</h2>
          <ul className="grid gap-2 list-disc pl-5">
            <li>A ranking of n models gives every pair in it: the higher model wins. Each pair counts 1/(n&minus;1) of a vote, so a long lineup is worth about as much as a short one.</li>
            <li>The same lineup saved again within a day counts once.</li>
            <li>Recent rankings count most: a ranking&rsquo;s weight halves every {HALF_LIFE_DAYS} days, so the board follows what people think now.</li>
            <li>The votes are fitted with a Bradley-Terry model, the method arena leaderboards use, and shown on the Elo scale: 400 points apart means the higher model is placed above the lower one 10 times out of 11.</li>
            <li>Every model also plays one drawn game against a fixed 1000-rated opponent. That keeps a model with few rankings from jumping to an extreme and keeps the scale steady from week to week.</li>
            <li>A model needs {MIN_RANKINGS} rankings to be rated. The range is a 95% interval from resampling the rankings 100 times.</li>
            <li>People rank the models Priors shows them, so a model shown to more people has more rankings. The rankings are anonymous.</li>
          </ul>
          <p>It measures belief, not ability, so it is never part of a default mix, and the fit that turns your ranking into a mix never uses it. It is also on the <Link href="/benchmarks/priorsbench" className="text-indigo hover:underline">benchmark list</Link>, where you can add it to a mix of your own.</p>
        </section>
      </article>
      <SiteFooter />
    </main>
  );
}
