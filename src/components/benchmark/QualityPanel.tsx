import Link from "next/link";
import type { BenchmarkQuality } from "@/onboarding/quality";
import { FACTS_CHECKED, type BenchmarkFacts } from "@/data/benchmark-facts";
import "./quality-panel.css";

/** What a benchmark page shows about the benchmark's quality: the score and every part behind it, worked out on the server from the full data. */
export interface QualityView { quality: BenchmarkQuality; facts: BenchmarkFacts; stars: number; uses: number }

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n) % 1 ? Math.abs(n).toFixed(1) : Math.abs(n)}`;

/**
 * The quality score with each part on its own line: a 0 to 100 bar, the share it carries, the points it adds and the fact it rests on.
 * Then the points added or taken away, and what people make of the benchmark (stars, pages using it), which the score does not count.
 */
export function QualityPanel({ view }: { view: QualityView }) {
  const { quality: q, facts, stars, uses } = view;
  return <section className="grid gap-3" id="quality" aria-labelledby="quality-title" data-quality-panel>
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-b hairline pb-2">
      <h2 id="quality-title" className="text-[22px] sm:text-[26px]">Benchmark quality <span className="num text-ink-2" data-quality-score>{q.score}</span><span className="cap"> of 100</span></h2>
      <Link href="/benchmarks/methodology" className="cap underline decoration-dotted underline-offset-2 hover:text-ink">How the score works</Link>
    </div>
    <p className="text-[13px] text-ink-2 max-w-[68ch]">How useful this benchmark is for telling current models apart. It describes the benchmark, not any model.</p>
    <div className="quality-rows" role="table" aria-label="Quality factors">
      {q.factors.map((f) => <div key={f.id} className="quality-row" role="row" data-factor={f.id}>
        <span className="quality-name" role="rowheader">{f.name}</span>
        <span className="quality-bar" role="cell" aria-label={`${f.score} of 100`}><i style={{ width: `${f.score}%` }} /><b className="num">{f.score}</b></span>
        <span className="quality-points cap" role="cell" title={`${Math.round(f.weight * 100)}% of the score`}>{Math.round(f.weight * 100)}% · {signed(f.points)}</span>
        <span className="quality-detail" role="cell">{f.detail}{f.id === "testSet" && facts.testUrl && <> <a href={facts.testUrl} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-ink">Source</a></>}</span>
      </div>)}
      {q.adjustments.map((a) => <div key={a.id} className="quality-row is-adjust" role="row" data-adjust={a.id}>
        <span className="quality-name" role="rowheader">{a.points > 0 ? "Added" : "Taken away"}</span>
        <span className="quality-bar" role="cell" />
        <span className="quality-points cap" role="cell">{signed(a.points)}</span>
        <span className="quality-detail" role="cell">{a.label}.</span>
      </div>)}
    </div>
    <p className="cap">Not counted in the score: {stars} star{stars === 1 ? "" : "s"} · weighted by {uses} published page{uses === 1 ? "" : "s"}. Both lift it in the directory&rsquo;s recommended order. Test set, release date and grading were researched from the publisher&rsquo;s pages ({FACTS_CHECKED}); <Link href="/request" className="underline decoration-dotted underline-offset-2 hover:text-ink">tell us</Link> if one is wrong.</p>
  </section>;
}
