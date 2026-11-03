import Link from "next/link";
import { loadSnapshot } from "@/data/load";
import { SettingsButton } from "@/components/SiteSettings";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { Wordmark } from "@/components/Wordmark";
import { HeaderAccount } from "@/components/AccountMenu";
import { BREADTH_FULL_AT, FRONTIER_RELEASE_DATE, PREFERRED, QUALITY_ADJUST, QUALITY_WEIGHTS } from "@/onboarding/quality";
import { USE_LIFT } from "@/lib/benchmark-recommended";
import { pageMeta } from "@/lib/site-meta";

export const dynamic = "force-dynamic";
export const metadata = pageMeta({ title: "How benchmark scores work", description: "How Priors calculates the quality and recommended scores in its benchmark directory.", path: "/benchmarks/methodology" });

const pct = (n: number) => `${Math.round(n * 100)}%`;
const PARTS = [
  { name: "Headroom and spread", weight: QUALITY_WEIGHTS.saturation, how: "Can it still tell top models apart? 75% is the room left above the top quarter of models, 25% is the gap between best and worst. A board with under 5 points between them caps at 35. Scores with no fixed scale, such as Elo, get a neutral 50." },
  { name: "Recency", weight: QUALITY_WEIGHTS.recency, how: "Full credit for 90 days after the benchmark's release, then falling to zero at two years. Neutral 50 if we haven't verified the release date." },
  { name: "Objectivity", weight: QUALITY_WEIGHTS.objectivity, how: "A judgment by Priors, not a measurement. Some benchmarks have their own hand-set value. The rest default by grading method: 80 for percent scores, 65 for other scores, 45 for Elo, 40 for human or LLM judges." },
  { name: "Breadth", weight: QUALITY_WEIGHTS.breadth, how: `How many models it has measured, with full credit at ${BREADTH_FULL_AT}.` },
  { name: "Frontier coverage", weight: QUALITY_WEIGHTS.frontier, how: "The share of today's 10 default lineup models it has measured." },
];

export default async function Page() {
  const snapshot = await loadSnapshot();
  const names = new Map(snapshot?.benchmarks.map((b) => [b.id, b.name]));
  return (
    <main className="min-h-screen">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-8 py-2 sm:h-14 border-b hairline"><div className="flex items-center gap-5"><Wordmark /><span className="max-sm:hidden"><SiteNav /></span></div><span className="ml-auto flex items-center gap-2"><HeaderAccount /><SettingsButton /></span></header>
      <article className="max-w-[720px] mx-auto px-5 sm:px-8 py-12 grid gap-8 text-[15px] leading-[1.7] text-ink-2">
        <div className="grid gap-2">
          <Link href="/benchmarks" className="cap hover:text-ink">Benchmarks</Link>
          <h1 className="text-[36px] leading-tight text-ink">How benchmark scores work</h1>
          <p>The directory shows two numbers Priors calculates itself. Neither is a model&rsquo;s result: they describe the benchmark. Leaderboard scores stay exactly as published.</p>
        </div>
        <section className="grid gap-3">
          <h2 className="text-[22px] text-ink">Quality</h2>
          <p>A score from 0 to 100 for how useful a benchmark is for telling current models apart. It&rsquo;s a weighted sum of five parts, each also 0 to 100:</p>
          <div className="overflow-x-auto"><table className="w-full text-[14px] leading-normal">
            <thead><tr className="cap text-left"><th className="font-normal py-1.5 pr-4">Part</th><th className="font-normal py-1.5 pr-4 text-right">Weight</th><th className="font-normal py-1.5">What it measures</th></tr></thead>
            <tbody>{PARTS.map((p) => <tr key={p.name} className="border-t hairline align-top"><td className="py-2 pr-4 text-ink whitespace-nowrap">{p.name}</td><td className="py-2 pr-4 text-right num">{pct(p.weight)}</td><td className="py-2">{p.how}</td></tr>)}</tbody>
          </table></div>
          <p>Then points are added or taken away, and the total stays between 0 and 100:</p>
          <ul className="grid gap-1 list-disc pl-5">
            <li><b className="font-medium text-ink">+{QUALITY_ADJUST.preferred}</b> for the benchmarks Priors prefers: {PREFERRED.flatMap((id) => names.get(id) ?? []).join(", ")}.</li>
            <li><b className="font-medium text-ink">&minus;{-QUALITY_ADJUST.superseded}</b> for a few older versions with a clear replacement.</li>
            <li><b className="font-medium text-ink">&minus;{-QUALITY_ADJUST.staleFrontier}</b> if its results were last updated before {FRONTIER_RELEASE_DATE}, when the current frontier models began to ship.</li>
          </ul>
          <p>Quality doesn&rsquo;t prove a benchmark is valid or free of training contamination, and part of it is our judgment. The same score guides the benchmarks suggested in the ranking flow and the builder.</p>
        </section>
        <section className="grid gap-3">
          <h2 className="text-[22px] text-ink">Recommended</h2>
          <p>The directory&rsquo;s default order: quality, lifted by how many published Priors pages give the benchmark weight.</p>
          <p className="num text-[14px] text-ink">quality + {USE_LIFT} &times; log2(1 + pages using it)</p>
          <p>One page adds {USE_LIFT} points and three add {USE_LIFT * 2}. Each doubling adds another {USE_LIFT}, so the first few pages count most.</p>
        </section>
        <section id="cost" className="grid gap-3 scroll-mt-6">
          <h2 className="text-[22px] text-ink">Cost per task</h2>
          <p>Cost is what a model actually spent on a benchmark&rsquo;s tasks, never its token price alone. By default it is then priced the way subscribers pay: measured cost times the model&rsquo;s share of API price on a subscription plan.</p>
          <p>Each model uses its median plan until you pick one for its lab in a cost chart&rsquo;s settings, and the share assumes the plan&rsquo;s full allowance is used. A new OpenAI model with no plan data yet is estimated from Codex&rsquo;s published limits. A model with no plan data at all stays at API price. Plan data comes from Real API Pricing.</p>
          <p>The Pricing setting in a cost chart switches the whole chart to API prices.</p>
        </section>
        <section className="grid gap-3">
          <h2 className="text-[22px] text-ink">The other columns</h2>
          <ul className="grid gap-1 list-disc pl-5">
            <li><b className="font-medium text-ink">Top model:</b> the best score the benchmark reports, older models included.</li>
            <li><b className="font-medium text-ink">Models:</b> how many the publisher has measured. Priors&rsquo; estimates don&rsquo;t count.</li>
            <li><b className="font-medium text-ink">Mixes:</b> how many published Priors pages give it weight.</li>
          </ul>
        </section>
      </article>
      <SiteFooter />
    </main>
  );
}
