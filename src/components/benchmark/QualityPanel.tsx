import Link from "next/link";
import { IconAdjustmentsHorizontal, IconRosetteDiscountCheck, IconArrowBarToUp, IconCalendar, IconGavel, IconLock, IconLockOpen, IconLockQuestion, IconStopwatch, IconUsersGroup, type Icon } from "@tabler/icons-react";
import { QUALITY_FACTORS, type BenchmarkQuality, type QualityFactorId } from "@/onboarding/quality";
import { FACTS_CHECKED, type BenchmarkFacts } from "@/data/benchmark-facts";
import "./quality-panel.css";

/** What a benchmark page shows about the benchmark's quality: the score and every part behind it, worked out on the server from the full data. */
export interface QualityView { quality: BenchmarkQuality; facts: BenchmarkFacts; stars: number; uses: number }

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n) % 1 ? Math.abs(n).toFixed(1) : Math.abs(n)}`;
const ASK = Object.fromEntries(QUALITY_FACTORS.map((f) => [f.id, f.ask])) as Record<QualityFactorId, string>;
const ICON: Record<QualityFactorId, Icon> = {
  saturation: IconArrowBarToUp, testSet: IconLock, recency: IconCalendar, objectivity: IconGavel, frontier: IconStopwatch, efforts: IconAdjustmentsHorizontal, breadth: IconUsersGroup,
};
const TEST_ICON = { private: IconLock, partial: IconLock, public: IconLockOpen, unknown: IconLockQuestion } as const;

/** A score out of 100 as a ring: the filled arc is the share of the whole it reaches. */
function Dial({ score, size = 52, label }: { score: number; size?: number; label: string }) {
  const r = (size - 6) / 2, c = 2 * Math.PI * r, on = Math.max(0, Math.min(100, score)) / 100;
  return <span className="quality-dial" style={{ width: size, height: size }} role="img" aria-label={label}>
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} className="quality-dial-track" />
      <circle cx={size / 2} cy={size / 2} r={r} className="quality-dial-arc" strokeDasharray={`${c * on} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
    <b className="num">{score}</b>
  </span>;
}

/**
 * The quality score as the first card, then one card per part: what it asks, a ring out of 100, the answer in a few words, and the share of the
 * score it carries. How each was worked out, the points added or taken away, and what people make of the benchmark sit under one
 * disclosure, out of the way of the answers.
 */
export function QualityPanel({ view }: { view: QualityView }) {
  const { quality: q, facts, stars, uses } = view;
  return <section className="grid gap-4" id="quality" aria-labelledby="quality-title" data-quality-panel>
    <div className="quality-head">
      <h2 id="quality-title" className="text-[22px] sm:text-[26px]">Benchmark quality</h2>
      <Link href="/benchmarks/methodology" className="cap underline decoration-dotted underline-offset-2 hover:text-ink">How the score works</Link>
    </div>
    <ul className="quality-grid" aria-label="Quality factors">
      <li className="quality-card is-total">
        <div className="quality-card-top">
          <span className="quality-icon"><IconRosetteDiscountCheck size={17} stroke={1.6} aria-hidden="true" /></span>
          <span className="quality-name">Overall</span>
        </div>
        <div className="quality-card-body">
          <Dial score={q.score} size={60} label={`Quality ${q.score} of 100`} />
          <div className="min-w-0">
            <p className="quality-summary"><span data-quality-score>{q.score}</span> of 100</p>
            {q.adjustments.length ? q.adjustments.map((a) => <p key={a.id} className="quality-ask" data-adjust={a.id}><b className="num">{signed(a.points)}</b> {a.label}</p>) : <p className="quality-ask">How useful it is for telling today&rsquo;s models apart</p>}
          </div>
        </div>
      </li>
      {q.factors.map((f) => {
        const I = f.id === "testSet" ? TEST_ICON[q.testSet] : ICON[f.id];
        return <li key={f.id} className="quality-card" data-factor={f.id} title={f.detail}>
          <div className="quality-card-top">
            <span className="quality-icon"><I size={17} stroke={1.6} aria-hidden="true" /></span>
            <span className="quality-name">{f.name}</span>
            <span className="quality-share cap" title={`${Math.round(f.weight * 100)}% of the quality score, adding ${signed(f.points)} points`}>{Math.round(f.weight * 100)}%</span>
          </div>
          <div className="quality-card-body">
            <Dial score={f.score} label={`${f.name}: ${f.score} of 100`} />
            <div className="min-w-0">
              <p className="quality-summary">{f.summary}</p>
              <p className="quality-ask">{ASK[f.id]}</p>
            </div>
          </div>
        </li>;
      })}
    </ul>
    <details className="quality-more">
      <summary className="disclosure disclosure-inline cap">How each part was worked out</summary>
      <dl>
        {q.factors.map((f) => <div key={f.id}><dt>{f.name} <span className="cap">{f.score} of 100 · {Math.round(f.weight * 100)}% · {signed(f.points)}</span></dt><dd>{f.detail}{f.id === "testSet" && facts.testUrl && <> <a href={facts.testUrl} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-ink">Source</a></>}</dd></div>)}
      </dl>
      <p className="cap">Not counted in the score: {stars} star{stars === 1 ? "" : "s"} · used by {uses} published page{uses === 1 ? "" : "s"}. Both lift it in the directory&rsquo;s recommended order. Test set, release date and grading were researched from the publisher&rsquo;s pages ({FACTS_CHECKED}); <Link href="/request" className="underline decoration-dotted underline-offset-2 hover:text-ink">tell us</Link> if one is wrong.</p>
    </details>
  </section>;
}
