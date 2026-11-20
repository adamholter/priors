import Link from "next/link";
import { loadSnapshot } from "@/data/load";
import { SettingsButton } from "@/components/SiteSettings";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { Wordmark } from "@/components/Wordmark";
import { HeaderAccount } from "@/components/AccountMenu";
import { curveAt, mixAt, type FigCurve } from "@/components/methods/figure-math";
import { TwoScales } from "@/components/methods/TwoScales";
import { AbilitySteps, AverageFigure, Both, CurveKey, CurvesFigure, Figure, pickThree, StepsFigure } from "@/components/methods/ScoringFigures";
import { computeIndex, defaultConfig, EPOCH_ECI, selectVariants, type RankedVariant, type ScoringFit, type ScoringMethod } from "@/engine";
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
  const run = (scoring?: ScoringMethod) => { const r = snapshot && config ? computeIndex(snapshot, { ...config, scoring }) : undefined; return { fit: r?.fit, shares: r?.benchmarks ?? [], best: r ? selectVariants(r.ranked, "best") : [] }; };
  const A = run(), I = run("irt"), E = run("eci");
  const average = A.best.slice(0, TOP), irt = I.best.slice(0, TOP), eci = E.best.slice(0, TOP);
  const epoch = snapshot?.benchmarks.find((b) => b.id === EPOCH_ECI);

  // The figures: the day's own fits. A curve is moved onto the axis it is drawn on (ECI-style: Epoch's scale).
  const names = new Map(snapshot?.benchmarks.map((b) => [b.id, b.name]));
  const curvesOf = (fit?: ScoringFit): FigCurve[] => (fit?.curves ?? []).map((c) => ({ id: c.benchmarkId, name: names.get(c.benchmarkId) ?? c.benchmarkId, slope: c.slope / fit!.scale, difficulty: fit!.shift + fit!.scale * c.difficulty, floor: c.floor, share: c.share }));
  const irtCurves = curvesOf(I.fit), eciCurves = curvesOf(E.fit), picked = pickThree(irtCurves).map((c) => c.id);
  /** Per picked benchmark: each model's measured score on it, at the model's place on the axis. */
  const scoresOn = (rows: RankedVariant[], x: (r: RankedVariant) => number) => picked.map((id) => rows.flatMap((r) => { const v = r.values.find((b) => b.benchmarkId === id); return v && !v.estimated ? [{ name: label(r), x: x(r), y: v.value }] : []; }));
  const hardest = (curves: FigCurve[]) => curves.reduce((a, c) => (c.difficulty > a.difficulty ? c : a), curves[0]);
  const irtTop = irt[0]?.method?.theta ?? 0, abilities = I.best.map((r) => r.method?.theta ?? 0);
  const irtX: [number, number] = [Math.floor(Math.max(Math.min(...abilities), -2.5) * 10 - 1) / 10, Math.ceil(Math.min(Math.max(irtTop, ...irtCurves.map((c) => c.difficulty)), irtTop + 2) * 10 + 4) / 10];
  // The ability curve runs on until the mix is nearly solved, to show the ceiling.
  let ceiling = irtTop + 0.5;
  while (ceiling < irtTop + 4 && mixAt(irtCurves, ceiling) < 96) ceiling += 0.1;
  const eciTop = eci[0]?.score ?? 150, eciScores = E.best.map((r) => r.score);
  const eciX: [number, number] = [Math.floor(Math.max(Math.min(...eciScores), eciTop - 60) / 5) * 5, Math.ceil((Math.min(Math.max(eciTop, ...eciCurves.map((c) => c.difficulty)), eciTop + 40) + 4) / 5) * 5];
  const epochBy = new Map(snapshot?.observations.filter((o) => o.benchmarkId === EPOCH_ECI).map((o) => [o.variantId, o.value]));
  const eciRows = eci.map((r) => ({ name: label(r), score: r.score, range: r.method!.range, other: epochBy.get(r.variant.id) }));
  const leader = average[0], weight = A.shares.reduce((t, s) => t + s.share, 0);
  const parts = leader ? A.shares.flatMap((s) => { const v = leader.values.find((b) => b.benchmarkId === s.benchmark.id); return v ? [{ name: s.benchmark.name, share: s.share / weight, value: v.value, estimated: v.estimated }] : []; }) : [];
  // Drawn only when the parts shown add up to the score shown.
  const adds = leader && parts.length === A.shares.length && Math.abs(parts.reduce((t, p) => t + p.share * p.value, 0) - leader.score) < 0.06;
  const figures = irtCurves.length > 0 && eciCurves.length > 0 && irt.length > 0 && eci.length > 0;
  // One model, worked through: the IRT leader's ability read off every curve, and the same model under ECI-style.
  const star = irt[0], starAbility = star?.method?.theta ?? 0, starEci = star && E.best.find((r) => r.variant.id === star.variant.id);
  const steps = star ? irtCurves.map((curve) => { const v = star.values.find((b) => b.benchmarkId === curve.id); return { curve, reading: curveAt(curve, starAbility), actual: v && !v.estimated ? v.value : undefined }; }) : [];
  const line = E.fit ? { scale: E.fit.scale, shift: E.fit.shift } : { scale: 1, shift: 0 };
  const far = figures ? hardest(eciCurves) : undefined;
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
          {adds && <Figure title={`${label(leader)} at ${leader.score.toFixed(1)}, benchmark by benchmark`} note="A track is as long as the benchmark's weight and filled to the model's score. The filled lengths add up to the index score."><AverageFigure parts={parts} score={leader.score} /></Figure>}
          <p>When a model has no result on a benchmark, the gap is filled with an estimate from similar models, so a model is not rewarded for skipping its weakest benchmarks.</p>
          <p><b className="font-medium text-ink">Limits.</b> It treats a point on an easy benchmark and a point on a hard one as the same thing. Going from 90 to 95 on a nearly solved benchmark counts as much as going from 10 to 15 on one almost nobody can do. And the filled gaps are guesses that look as exact as measurements.</p>
          <Figure title="The same five points, three sizes of step" note="Scores on a benchmark follow an S-shaped curve as models get more able. Five points in the middle of the curve take the least ability. Five points near the floor take 2.3 times as much, and five near the ceiling 3.7 times. The weighted average counts all three the same."><Both draw={(w) => <StepsFigure w={w} />} /></Figure>
        </section>

        <section id="irt" className="grid gap-3 scroll-mt-6">
          <h2 className="text-[22px] text-ink">IRT ability</h2>
          <p>Item response theory comes from exam scoring. It assumes each model has one underlying ability and each benchmark has a difficulty and a steepness: how much ability it takes to score halfway, and how quickly scores rise past that point. Priors works out those two numbers for every benchmark from all the models that took it, then finds the ability that best explains a model&rsquo;s results on your mix.</p>
          {figures && <Figure title="Each benchmark gets a curve" note={`The General frontier mix, fitted on ${snapshot!.date} to ${I.best.length} models. A dot is one model's score on the benchmark of that colour, placed at the model's ability. Where a curve crosses halfway is the benchmark's difficulty, and how fast it climbs is its steepness.`}>
            <CurveKey curves={irtCurves} picked={picked} fmt={(v) => v.toFixed(2)} others={irtCurves.length - picked.length} />
            <Both draw={(w) => <CurvesFigure w={w} curves={irtCurves} picked={picked} points={scoresOn(I.best, (r) => r.method?.theta ?? 0)} x={irtX} xTitle="Ability (0 is the middle of the models Priors tracks)" top={irtTop} label={`Fitted curves of score against ability for the ${irtCurves.length} benchmarks of the mix, with each model's score on three of them.`} />} />
          </Figure>}
          <h3 className="text-[17px] text-ink mt-2">How an ability becomes a 0 to 100 score</h3>
          <p>An ability is a position along the bottom of that chart: a number like {starAbility.toFixed(2)}, with no top or bottom of its own. Priors does not stretch or rescale it onto 0 to 100. It turns it back into benchmark scores, in two steps.</p>
          <ol className="grid gap-1 list-decimal pl-5">
            <li>Read every benchmark&rsquo;s curve at the model&rsquo;s ability. That gives the score the curve expects from a model that able.</li>
            <li>Average those expected scores with your weights. This is the same sum the weighted average does, on expected scores instead of real ones.</li>
          </ol>
          {figures && star && <Figure title={`${label(star)}, step by step`} note={`Its fitted ability is ${starAbility.toFixed(2)}. Each small chart is one benchmark's curve from the chart above. The dot is where the curve is read, and the ring is the score the model really got.`}>
            <AbilitySteps rows={steps} ability={starAbility} x={[irtX[0], Math.max(irtX[1], starAbility + 0.8)]} score={star.score} average={steps.every((r) => r.actual != null) ? star.method?.average : undefined} />
          </Figure>}
          <p>That is why the score cannot leave 0 to 100. Every reading is a benchmark score, so it lies between 0 and 100, and an average of them does too. A score of 100 would mean the curves expect full marks on every benchmark in the mix. It is also why the score reads like the default one: it is the same weighted average, with each real score replaced by what the model&rsquo;s ability predicts. The likely range is converted the same way, by reading the curves at both ends of the ability&rsquo;s range.</p>
          <p>Your weights also decide how the ability itself is found. A benchmark&rsquo;s weight is its share of the pull on ability, so a steep benchmark does not pull harder than its weight says.</p>
          <p><b className="font-medium text-ink">When it differs.</b> A model that does well on hard benchmarks and loses a few points on easy ones moves up. A model whose average is carried by one unusual result moves down, because one ability cannot explain an outlier. Nothing is filled in: a benchmark a model never ran is left to its curve.</p>
          <p><b className="font-medium text-ink">Limits.</b> One ability per model is a simplification, so a model that is strong at one kind of task and weak at another is described less well. The ability starts from how the model does across every benchmark Priors has, not only your mix, so on a mix of one or two benchmarks it follows them less closely than the average does. Each score has a likely range, and the ranges of neighbouring models usually overlap.</p>
        </section>

        <section id="eci" className="grid gap-3 scroll-mt-6">
          <h2 className="text-[22px] text-ink">ECI-style</h2>
          <p>Epoch AI publishes the <a href="https://epoch.ai/benchmarks/eci" target="_blank" rel="noreferrer" className="text-indigo underline">Epoch Capabilities Index</a>: one capability number per model, fitted across many benchmarks at once. Each benchmark gets a difficulty and a slope, each model a capability, and a model&rsquo;s expected score on a benchmark is sigmoid(slope &times; (capability &minus; difficulty)). Capabilities are then rescaled in a straight line onto a scale with no upper limit.</p>
          {figures && <Figure title="The same curves on an open scale" note={<>The same mix under the ECI-style fit, on {snapshot!.date}. Capability and difficulty share one axis{far && far.difficulty > eciTop ? <>: {far.name} crosses halfway at {far.difficulty.toFixed(0)}, past every model today</> : null}.{eciRows.some((r) => r.other != null) ? " A ring is Epoch's own ECI for the same model, where Epoch has scored it." : ""}</>}>
            <CurveKey curves={eciCurves} picked={picked} fmt={(v) => v.toFixed(0)} others={eciCurves.length - picked.length} />
            <Both draw={(w) => <CurvesFigure w={w} curves={eciCurves} picked={picked} points={scoresOn(E.best, (r) => r.score)} x={eciX} xTitle="ECI-style score" fmtX={(v) => v.toFixed(0)} top={eciTop} rows={eciRows} label={`Fitted curves of score against ECI-style capability for the ${eciCurves.length} benchmarks of the mix, and the top ${eciRows.length} models with their likely ranges.`} />} />
          </Figure>}
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

        {figures && star && <section id="scales" className="grid gap-3 scroll-mt-6">
          <h2 className="text-[22px] text-ink">Why one stops at 100 and the other does not</h2>
          <p>Both methods begin the same way: a fit that places every model at a position on one axis. They differ in what they report from that position.</p>
          <ul className="grid gap-1 list-disc pl-5">
            <li><b className="font-medium text-ink">IRT ability reports a predicted score.</b> It reads the benchmark curves at the model&rsquo;s position and averages them. Every curve flattens as it nears 100, so the score does too.</li>
            <li><b className="font-medium text-ink">ECI-style reports the position itself.</b> It puts the position through a straight line onto Epoch&rsquo;s scale. A straight line never flattens, so the score has no ceiling.</li>
          </ul>
          <div className="mfig-sum" data-worked>
            <div><b>IRT ability</b><span>{label(star)} sits at {starAbility.toFixed(2)}. The curves read there, weighted: <code>{star.score.toFixed(1)}</code></span></div>
            {starEci?.method && <div><b>ECI-style</b><span>Its own fit puts the same model at {starEci.method.theta.toFixed(3)}. On the line: <code>{line.shift.toFixed(2)} + {line.scale.toFixed(2)} × {starEci.method.theta.toFixed(3)} = {starEci.score.toFixed(1)}</code></span></div>}
          </div>
          <Figure title="Move a model up the axis" note="Top: the score the curves expect on this mix at each position, which is what IRT ability reports. Bottom: the straight line ECI-style uses. Drag to the right. The top reading closes in on 100 while the bottom one keeps climbing at the same rate.">
            <Both draw={(w) => <TwoScales w={w} curves={irtCurves} irt={I.best.map((r) => ({ name: label(r), x: r.method?.theta ?? 0, y: r.score }))} eci={E.best.map((r) => ({ name: label(r), x: r.method?.theta ?? 0, y: r.score }))} scale={line.scale} shift={line.shift} x={[irtX[0], Math.ceil(ceiling * 10) / 10]} />} />
          </Figure>
          <p>So the same gap between two strong models shows in full on the ECI-style scale and shrinks on the IRT ability scale as the mix gets closer to solved. Neither is more correct. A 0 to 100 score says how much of this mix a model is expected to get. An open scale keeps separating models after that, though with wider ranges, because a nearly solved benchmark says little about how much further a model could go.</p>
        </section>}

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
