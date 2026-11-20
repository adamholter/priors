/**
 * The drawings on `/methods/scoring`, built on the server from the day's own fits (`IndexResult.fit`): nothing here is a sketch
 * except `StepsFigure`, which is the logistic curve itself. Each is drawn twice, wide and narrow, so text stays readable on a phone.
 */
import type { ReactNode } from "react";
import { curveAt, frame, pickThree, ticks, type FigCurve, type FigPoint, type Frame } from "./figure-math";
import "./scoring-figures.css";

const WIDE = 680, NARROW = 350;
/** One drawing at both widths; CSS shows the one that fits. */
export const Both = ({ draw }: { draw: (w: number) => ReactNode }) => <><div className="max-sm:hidden">{draw(WIDE)}</div><div className="sm:hidden">{draw(NARROW)}</div></>;

export function Figure({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return <figure className="mfig"><figcaption><b>{title}</b>{note && <span>{note}</span>}</figcaption>{children}</figure>;
}

/** Horizontal gridlines with their values, x ticks, and a title for each axis. */
function Axes({ f, xs, ys, xTitle, yTitle, fmtX = String }: { f: Frame; xs: number[]; ys: number[]; xTitle: string; yTitle: string; fmtX?: (v: number) => string }) {
  return <g>
    {ys.map((v) => <g key={v}><line className="gridline" x1={f.l} x2={f.w - f.r} y1={f.sy(v)} y2={f.sy(v)} /><text className="n" x={f.l - 6} y={f.sy(v) + 3.5} textAnchor="end">{v}</text></g>)}
    {xs.map((v) => <g key={v}><line className="axis" x1={f.sx(v)} x2={f.sx(v)} y1={f.h - f.b} y2={f.h - f.b + 4} /><text className="n" x={f.sx(v)} y={f.h - f.b + 16} textAnchor="middle">{fmtX(v)}</text></g>)}
    <line className="axis" x1={f.l} x2={f.w - f.r} y1={f.h - f.b} y2={f.h - f.b} />
    <text x={f.l} y={f.t - 9}>{yTitle}</text>
    <text x={(f.l + f.w - f.r) / 2} y={f.h - f.b + 33} textAnchor="middle">{xTitle}</text>
  </g>;
}

/** The weighted average of one model: every benchmark's score times its weight, and the sum. */
export function AverageFigure({ parts, score }: { parts: { name: string; share: number; value: number; estimated: boolean }[]; score: number }) {
  const widest = Math.max(...parts.map((p) => p.share));
  return <div className="mfig-avg">
    {[...parts].sort((a, b) => b.share * b.value - a.share * a.value).map((p) => <div key={p.name} className="contents">
      <span className="name">{p.name}{p.estimated && <span className="text-grey"> (estimate)</span>}</span>
      <span><span className="track" style={{ width: `${p.share / widest * 100}%` }}><i style={{ width: `${Math.max(0, Math.min(100, p.value))}%` }} /></span></span>
      <span className="calc num">{p.value.toFixed(1)} × {(p.share * 100).toFixed(0)}%</span>
      <span className="add num">{(p.share * p.value).toFixed(1)}</span>
    </div>)}
    <div className="total"><span>Added up</span><span className="num">{score.toFixed(1)}</span></div>
  </div>;
}

const logit = (p: number) => Math.log(p / (1 - p));
const STEPS: [number, number][] = [[10, 15], [50, 55], [90, 95]];

/** Equal steps in score are unequal steps in ability: the same five points, at three places on one curve. */
export function StepsFigure({ w }: { w: number }) {
  const wide = w > 500, f = frame(w, wide ? 290 : 250, [-4.4, 4.4], [0, 100], { l: 70, b: 46, t: 24 });
  const base = logit(0.55) - logit(0.5), y0 = f.h - f.b;
  return <svg viewBox={`0 0 ${f.w} ${f.h}`} role="img" aria-label="One S-shaped curve of score against ability. Going from 50 to 55 takes a small step in ability. Going from 10 to 15 takes 2.3 times as much, and from 90 to 95 takes 3.7 times as much.">
    <line className="axis" x1={f.l} x2={f.w - f.r} y1={y0} y2={y0} /><line className="axis" x1={f.l} x2={f.l} y1={f.t} y2={y0} />
    <text x={f.l} y={f.t - 10}>Score</text>
    {STEPS.map(([lo, hi]) => {
      const a = logit(lo / 100), b = logit(hi / 100), mid = (f.sx(a) + f.sx(b)) / 2;
      return <g key={lo}>
        <path className="guide" d={`M${f.l} ${f.sy(lo)}H${f.sx(a)}V${y0}`} /><path className="guide" d={`M${f.l} ${f.sy(hi)}H${f.sx(b)}V${y0}`} />
        <line className="ink-line" strokeWidth={4} x1={f.l} x2={f.l} y1={f.sy(lo)} y2={f.sy(hi)} />
        <line className="c0" strokeWidth={4} x1={f.sx(a)} x2={f.sx(b)} y1={y0} y2={y0} />
        <text className="ink n" x={f.l - 8} y={(f.sy(lo) + f.sy(hi)) / 2 + 3.5} textAnchor="end">{lo} to {hi}</text>
        <text className="accent n" x={mid} y={y0 + 17} textAnchor="middle">{((b - a) / base).toFixed(1)}×</text>
      </g>;
    })}
    <path className="curve ink-line" d={f.line((x) => 100 / (1 + Math.exp(-x)))} />
    <text x={(f.l + f.w - f.r) / 2} y={y0 + 37} textAnchor="middle">{wide ? "Ability each step takes, against the step in the middle" : "Ability each step takes"}</text>
  </svg>;
}

export interface CurvesProps {
  w: number;
  /** Every benchmark of the mix, already on the figure's x scale. */
  curves: FigCurve[];
  /** The benchmarks to draw in color (ids), and the models' scores on each, in the same order. */
  picked: string[]; points: FigPoint[][];
  x: [number, number]; xTitle: string; fmtX?: (v: number) => string;
  /** Where today's best model sits on the x axis. */
  top: number;
  /** Models to list under the plot on the same axis: score, range, and another source's value for the same model. */
  rows?: { name: string; score: number; range: [number, number]; other?: number }[];
  label: string;
}

/** Fitted curves with the scores they were fitted to: every benchmark faint, three in color, and each colored curve's halfway point dropped to the axis. */
export function CurvesFigure({ w, curves, picked, points, x, xTitle, fmtX, top, rows = [], label }: CurvesProps) {
  const wide = w > 500, plotH = wide ? 330 : 270, rowH = 17, stripH = rows.length ? rows.length * rowH + 30 : 0;
  const f = frame(w, plotH, x, [0, 100]), inside = (v: number) => v >= x[0] && v <= x[1];
  const chosen = picked.map((id) => curves.find((c) => c.id === id)!).filter(Boolean), y0 = f.h - f.b;
  // Left of the line is the empty corner above the curves; right of it only when the line is hard against the left edge.
  const topLeft = f.sx(top) - f.l > 100;
  return <svg viewBox={`0 0 ${f.w} ${plotH + stripH}`} role="img" aria-label={label}>
    <Axes f={f} xs={ticks(x[0], x[1], wide ? 8 : 4)} ys={[0, 25, 50, 75, 100]} xTitle={xTitle} yTitle="Score on the benchmark" fmtX={fmtX} />
    {curves.filter((c) => !picked.includes(c.id)).map((c) => <path key={c.id} className="faint" d={f.line((v) => curveAt(c, v))} />)}
    {inside(top) && <g><line className="guide" x1={f.sx(top)} x2={f.sx(top)} y1={f.t} y2={y0} /><text className="ink halo" x={f.sx(top) + (topLeft ? -6 : 6)} y={f.t + 10} textAnchor={topLeft ? "end" : "start"}>Top model today</text></g>}
    {chosen.map((c, i) => <g key={c.id}>
      {points[i].filter((p) => inside(p.x)).map((p, k) => <circle key={k} className={`dot d${i}`} cx={f.sx(p.x).toFixed(1)} cy={f.sy(p.y).toFixed(1)} r={wide ? 2.4 : 1.9}><title>{`${p.name}: ${p.y.toFixed(1)} on ${c.name}`}</title></circle>)}
    </g>)}
    {chosen.map((c, i) => {
      const half = 100 * (c.floor + (1 - c.floor) / 2);
      return <g key={c.id}>
        <path className={`curve c${i}`} d={f.line((v) => curveAt(c, v))} />
        {inside(c.difficulty) && <><line className={`c${i}`} strokeDasharray="3 3" x1={f.sx(c.difficulty)} x2={f.sx(c.difficulty)} y1={f.sy(half)} y2={y0} /><circle className={`d${i} knob`} cx={f.sx(c.difficulty)} cy={f.sy(half)} r={4} /></>}
      </g>;
    })}
    {rows.length > 0 && <g>
      <text x={f.l} y={plotH + 12}>{wide ? "The top models on the same axis, each with its likely range" : "Top models, with likely range"}</text>
      {rows.map((r, i) => {
        const y = plotH + 30 + i * rowH, a = f.sx(Math.max(x[0], r.range[0])), b = f.sx(Math.min(x[1], r.range[1]));
        return <g key={r.name}>
          <line className="ink-line" strokeWidth={1.3} x1={a} x2={b} y1={y} y2={y} />
          {r.other != null && inside(r.other) && <circle className="ring" cx={f.sx(r.other)} cy={y} r={4.2}><title>{`Epoch's own ECI for ${r.name}: ${r.other.toFixed(1)}`}</title></circle>}
          <circle className="mark" cx={f.sx(r.score)} cy={y} r={3}><title>{`${r.name}: ${r.score.toFixed(1)}, likely ${r.range[0].toFixed(1)} to ${r.range[1].toFixed(1)}`}</title></circle>
          <text className="ink" x={Math.min(a, r.other != null && inside(r.other) ? f.sx(r.other) - 5 : a) - 7} y={y + 3.5} textAnchor="end">{r.name} <tspan className="n">{r.score.toFixed(1)}</tspan></text>
        </g>;
      })}
    </g>}
  </svg>;
}

/** The colored curves' names, each with where it crosses halfway. */
export function CurveKey({ curves, picked, fmt, others }: { curves: FigCurve[]; picked: string[]; fmt: (v: number) => string; others: number }) {
  return <div className="mfig-key">
    {picked.map((id, i) => { const c = curves.find((x) => x.id === id); return c && <span key={id}><i className={`k${i}`} />{c.name} <em>halfway at {fmt(c.difficulty)}</em></span>; })}
    {others > 0 && <span><i className="kf" />the mix&rsquo;s other {others}</span>}
  </div>;
}

export { pickThree };
