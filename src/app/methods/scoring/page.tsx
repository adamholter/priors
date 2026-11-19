import Link from "next/link";
import { loadSnapshot } from "@/data/load";
import { SettingsButton } from "@/components/SiteSettings";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { Wordmark } from "@/components/Wordmark";
import { HeaderAccount } from "@/components/AccountMenu";
import { computeIndex, defaultConfig, EPOCH_ECI, selectVariants, type RankedVariant, type ScoringMethod } from "@/engine";
import { encodeIndices, prettyQuery } from "@/lib/url";
import { pageMeta } from "@/lib/site-meta";

export const dynamic = "force-dynamic";
export const metadata = pageMeta({ title: "Scoring methods", description: "The three ways Priors can turn a mix of benchmarks into one score per model: the weighted average, IRT ability and an ECI-style score.", path: "/methods/scoring" });

const TOP = 10;
const label = (r: RankedVariant) => `${r.model.name}${r.variant.effort === "default" ? "" : ` ${r.variant.effort}`}`;

export default async function Page() {
  const snapshot = await loadSnapshot();
  // The same mix under each method, so the table shows what switching does today.
  const config = snapshot && { ...defaultConfig(snapshot), variants: "all" as const };
  const rows = (scoring?: ScoringMethod) => (snapshot && config ? selectVariants(computeIndex(snapshot, { ...config, scoring }).ranked, "best").slice(0, TOP) : []);
  const average = rows(), irt = rows("irt"), eci = rows("eci");
  const epoch = snapshot?.benchmarks.find((b) => b.id === EPOCH_ECI);
  const open = (scoring: ScoringMethod) => (config ? `/builder?${prettyQuery(encodeIndices([{ ...config, name: "General frontier", scoring }]))}` : "/builder");
  return (
    <main className="min-h-screen">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-8 py-2 sm:h-14 border-b hairline"><div className="flex items-center gap-5"><Wordmark /><span className="max-sm:hidden"><SiteNav /></span></div><span className="ml-auto flex items-center gap-2"><HeaderAccount /><SettingsButton /></span></header>
      <article className="max-w-[720px] mx-auto px-5 sm:px-8 py-12 grid gap-8 text-[15px] leading-[1.7] text-ink-2">
        <div className="grid gap-2">
          <Link href="/builder" className="cap hover:text-ink">Rankings</Link>
          <h1 className="text-[36px] leading-tight text-ink">Scoring methods</h1>
          <p>A mix is a set of benchmarks with weights. A scoring method turns a model&rsquo;s results on that mix into one number. Priors has three. The weighted average is the default and what every ranking uses unless you change it under Calculation settings in the mix editor. A ranking that uses another method says so beside its scores.</p>
          <p>All three rank the same models. Whether a model has enough measured data to be ranked is decided first, by the same rules, so switching method never adds or removes a model.</p>
        </div>

        <section id="average" className="grid gap-3 scroll-mt-6">
          <h2 className="text-[22px] text-ink">Weighted average</h2>
          <p>Each benchmark&rsquo;s score, on a 0 to 100 scale, times its weight, added up. Percent scores are used as published. A benchmark at 15% contributes 15% of the score.</p>
          <p>When a model has no result on a benchmark, the gap is filled with an estimate from similar models, so a model is not rewarded for skipping its weakest benchmarks.</p>
          <p><b className="font-medium text-ink">Limits.</b> It treats a point on an easy benchmark and a point on a hard one as the same thing. Going from 90 to 95 on a nearly solved benchmark counts as much as going from 10 to 15 on one almost nobody can do. And the filled gaps are guesses that look as exact as measurements.</p>
        </section>

        <section id="irt" className="grid gap-3 scroll-mt-6">
          <h2 className="text-[22px] text-ink">IRT ability</h2>
          <p>Item response theory comes from exam scoring. It assumes each model has one underlying ability and each benchmark has a difficulty and a steepness: how much ability it takes to score halfway, and how quickly scores rise past that point. Priors works out those two numbers for every benchmark from all the models that took it, then finds the ability that best explains a model&rsquo;s results on your mix.</p>
          <p>The score shown is the index score a model of that ability would be expected to average on your mix. So it stays on the 0 to 100 scale and reads like the default score.</p>
          <p>Your weights still decide what counts. A benchmark&rsquo;s weight is its share of the pull on ability, so a steep benchmark does not pull harder than its weight says.</p>
          <p><b className="font-medium text-ink">When it differs.</b> A model that does well on hard benchmarks and loses a few points on easy ones moves up. A model whose average is carried by one unusual result moves down, because one ability cannot explain an outlier. Nothing is filled in: a benchmark a model never ran is left to its curve.</p>
          <p><b className="font-medium text-ink">Limits.</b> One ability per model is a simplification, so a model that is strong at one kind of task and weak at another is described less well. The ability starts from how the model does across every benchmark Priors has, not only your mix, so on a mix of one or two benchmarks it follows them less closely than the average does. Each score has a likely range, and the ranges of neighbouring models usually overlap.</p>
        </section>

        <section id="eci" className="grid gap-3 scroll-mt-6">
          <h2 className="text-[22px] text-ink">ECI-style</h2>
          <p>Epoch AI publishes the <a href="https://epoch.ai/benchmarks/eci" target="_blank" rel="noreferrer" className="text-indigo underline">Epoch Capabilities Index</a>: one capability number per model, fitted across many benchmarks at once. Each benchmark gets a difficulty and a slope, each model a capability, and a model&rsquo;s expected score on a benchmark is sigmoid(slope &times; (capability &minus; difficulty)). Capabilities are then rescaled in a straight line onto a scale with no upper limit.</p>
          <p>This method runs the same kind of fit on the benchmarks in your mix. It is not Epoch&rsquo;s index{epoch ? <>, which Priors also carries, unchanged, as the benchmark <Link href={`/benchmarks/${epoch.id}`} className="text-indigo underline">{epoch.name}</Link></> : null}. It differs in these ways:</p>
          <ul className="grid gap-1 list-disc pl-5">
            <li><b className="font-medium text-ink">Benchmarks.</b> Epoch fits over 50 benchmarks it chose. This uses only the ones in your mix, including Elo ratings converted to 0 to 100, which Epoch leaves out.</li>
            <li><b className="font-medium text-ink">Weights.</b> Epoch has none. Here a benchmark&rsquo;s errors count in proportion to its weight, so a benchmark at 20% pulls twice as hard on capability as one at 10%.</li>
            <li><b className="font-medium text-ink">Fit.</b> Since November 4, 2026 Epoch samples a Bayesian version of the model, which takes minutes. This uses the method Epoch used until then, least squares with a small penalty on every parameter, because it has to run while you drag a slider.</li>
            <li><b className="font-medium text-ink">Scale.</b> Epoch pins Claude 3.5 Sonnet at 130 and GPT-5 at 150. Neither has results on today&rsquo;s benchmarks, so the scale here is lined up with Epoch&rsquo;s published scores instead: over the models both score, the average and the spread are made to match. If a ranking has fewer than five such models, the middle model reads 150.</li>
            <li><b className="font-medium text-ink">Which models.</b> Epoch scores a model with at least four benchmark results in the middle of the range. Priors keeps its own coverage rule, the same one the other methods use.</li>
            <li><b className="font-medium text-ink">Ranges.</b> Epoch reports 90% intervals from its samples. Priors shows a 95% range worked out from how well the fit explains each model&rsquo;s scores.</li>
          </ul>
          <p><b className="font-medium text-ink">When it differs.</b> In the same direction as IRT ability: results on hard benchmarks count for more than the same number of points on easy ones. Unlike IRT it uses your mix alone, and it reports capability itself, so the numbers are not 0 to 100.</p>
          <p><b className="font-medium text-ink">Limits.</b> Epoch says of its own index that a score means little by itself and is for comparing models. That holds here too. A model with scores near zero on everything gets a very low number with a very wide range. With one benchmark in the mix it can only repeat that benchmark&rsquo;s order.</p>
        </section>

        {average.length > 0 && <section id="today" className="grid gap-3 scroll-mt-6">
          <h2 className="text-[22px] text-ink">The same mix, three ways</h2>
          <p>The top {TOP} on the General frontier mix as of {snapshot!.date}, each model at its best reasoning effort, with its likely range underneath.</p>
          <div className="overflow-x-auto"><table className="w-full text-[13px] leading-normal">
            <thead><tr className="cap text-left"><th className="font-normal py-1.5 pr-3 w-6">#</th><th className="font-normal py-1.5 pr-3">Weighted average</th><th className="font-normal py-1.5 pr-3">IRT ability</th><th className="font-normal py-1.5">ECI-style</th></tr></thead>
            <tbody>{average.map((a, i) => <tr key={a.variant.id} className="border-t hairline align-top">
              <td className="py-2 pr-3 num">{i + 1}</td>
              <td className="py-2 pr-3"><span className="text-ink">{label(a)}</span> <span className="num">{a.score.toFixed(1)}</span></td>
              {[irt[i], eci[i]].map((r, k) => <td key={k} className="py-2 pr-3">{r && <><span className="text-ink">{label(r)}</span> <span className="num">{r.score.toFixed(1)}</span>{r.method && <span className="num block text-grey">{r.method.range[0].toFixed(1)} to {r.method.range[1].toFixed(1)}</span>}</>}</td>)}
            </tr>)}</tbody>
          </table></div>
          <p>Open this mix with <Link href={open("irt") as "/"} className="text-indigo underline">IRT ability</Link> or <Link href={open("eci") as "/"} className="text-indigo underline">ECI-style</Link> scores.</p>
        </section>}

        <section className="grid gap-3">
          <h2 className="text-[22px] text-ink">What stays the same</h2>
          <ul className="grid gap-1 list-disc pl-5">
            <li>Benchmark scores are used as published under every method.</li>
            <li>Cost, speed and time per task do not depend on the method.</li>
            <li>Rankings through time always use the weighted average, so one day compares with the next.</li>
            <li>The method travels with the ranking: in its link, on a saved page and on its share card.</li>
          </ul>
        </section>
      </article>
      <SiteFooter />
    </main>
  );
}
