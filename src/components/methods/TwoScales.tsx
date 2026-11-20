"use client";
/**
 * `/methods/scoring`: why IRT ability stays within 0 to 100 and an ECI-style score does not. Both start from a position on a
 * fitted axis. The top panel is what IRT ability reports from it: the score the benchmark curves expect on the mix, which
 * flattens toward 100. The bottom panel is what ECI-style reports: a straight line of the position. One slider moves both.
 */
import { useState } from "react";
import { curveAt, frame, mixAt, ticks, type FigCurve, type FigPoint } from "./figure-math";
import "./scoring-figures.css";

export interface TwoScalesProps {
  w: number;
  /** The IRT fit's benchmark curves, and its models (best first; x the ability, y the score). */
  curves: FigCurve[]; irt: FigPoint[];
  /** The ECI-style fit's models (best first; x the capability on the fit's own scale, y the score) and its line: score = shift + scale * capability. */
  eci: FigPoint[]; scale: number; shift: number;
  x: [number, number];
}

export function TwoScales({ w, curves, irt, eci, scale, shift, x }: TwoScalesProps) {
  const [at, setAt] = useState(irt[0]?.x ?? 0);
  const wide = w > 500, hTop = wide ? 262 : 232, hBot = wide ? 230 : 210, l = 40;
  const line = (v: number) => shift + scale * v, yLo = Math.floor(line(x[0]) / 10) * 10, yHi = Math.ceil(line(x[1]) / 10) * 10;
  const top = frame(w, hTop, x, [0, 100], { l, t: 24, b: 12 }), bot = frame(w, hBot, x, [yLo, yHi], { l, t: 30, b: 40 });
  const here = mixAt(curves, at), next = mixAt(curves, at + 1), there = line(at);
  const inside = (m: FigPoint) => m.x >= x[0] && m.x <= x[1], r = wide ? 2.6 : 2.1;
  return <div className="mfig-slide grid gap-2">
    <svg viewBox={`0 0 ${w} ${hTop + hBot}`} role="img" aria-label={`Two charts over the same axis. In the top one, the expected score on the mix rises along an S-shaped curve and flattens toward 100. In the bottom one, the ECI-style score rises along a straight line at ${scale.toFixed(1)} points per unit, with no ceiling.`}>
      <g>
        {[0, 25, 50, 75, 100].map((v) => <g key={v}><line className="gridline" x1={l} x2={w - top.r} y1={top.sy(v)} y2={top.sy(v)} /><text className="n" x={l - 6} y={top.sy(v) + 3.5} textAnchor="end">{v}</text></g>)}
        <text className="ink" x={l} y={top.t - 10}>IRT ability: the score the curves expect on the mix</text>
        {curves.map((c) => <path key={c.id} className="faint" d={top.line((v) => curveAt(c, v))} />)}
        <path className="curve c0" strokeWidth={3} d={top.line((v) => mixAt(curves, v))} />
        {irt.filter(inside).map((m) => <circle key={m.name} className="mark" cx={top.sx(m.x).toFixed(1)} cy={top.sy(m.y).toFixed(1)} r={r}><title>{`${m.name}: ability ${m.x.toFixed(2)}, IRT ability score ${m.y.toFixed(1)}`}</title></circle>)}
        {irt[0] && inside(irt[0]) && <text className="ink halo" x={top.sx(irt[0].x) - 8} y={top.sy(irt[0].y) - 7} textAnchor="end">{irt[0].name}</text>}
      </g>
      <g transform={`translate(0 ${hTop})`}>
        {ticks(yLo, yHi, 4).map((v) => <g key={v}><line className="gridline" x1={l} x2={w - bot.r} y1={bot.sy(v)} y2={bot.sy(v)} /><text className="n" x={l - 6} y={bot.sy(v) + 3.5} textAnchor="end">{v}</text></g>)}
        {ticks(x[0], x[1], wide ? 8 : 5).map((v) => <g key={v}><line className="axis" x1={bot.sx(v)} x2={bot.sx(v)} y1={hBot - bot.b} y2={hBot - bot.b + 4} /><text className="n" x={bot.sx(v)} y={hBot - bot.b + 16} textAnchor="middle">{v}</text></g>)}
        <line className="axis" x1={l} x2={w - bot.r} y1={hBot - bot.b} y2={hBot - bot.b} />
        <text className="ink" x={l} y={bot.t - 12}>ECI-style: a straight line of the position</text>
        <text x={(l + w - bot.r) / 2} y={hBot - bot.b + 33} textAnchor="middle">{wide ? "Position on the fitted axis (ability or capability; each method fits its own)" : "Position on the fitted axis"}</text>
        <path className="curve c1" strokeWidth={3} d={`M${bot.sx(x[0])} ${bot.sy(line(x[0]))}L${bot.sx(x[1])} ${bot.sy(line(x[1]))}`} />
        {eci.filter(inside).map((m) => <circle key={m.name} className="mark" cx={bot.sx(m.x).toFixed(1)} cy={bot.sy(m.y).toFixed(1)} r={r}><title>{`${m.name}: capability ${m.x.toFixed(2)}, ECI-style score ${m.y.toFixed(1)}`}</title></circle>)}
        {eci[0] && inside(eci[0]) && <text className="ink halo" x={bot.sx(eci[0].x) - 8} y={bot.sy(eci[0].y) - 7} textAnchor="end">{eci[0].name}</text>}
      </g>
      {/* The slider's position, read in both panels. */}
      <line className="guide" x1={top.sx(at)} x2={top.sx(at)} y1={top.sy(here)} y2={hTop + hBot - bot.b} />
      <line className="guide" x1={l} x2={top.sx(at)} y1={top.sy(here)} y2={top.sy(here)} />
      <line className="guide" x1={l} x2={bot.sx(at)} y1={hTop + bot.sy(there)} y2={hTop + bot.sy(there)} />
      <circle className="d0 knob" cx={top.sx(at)} cy={top.sy(here)} r={5.5} />
      <circle className="d1 knob" cx={bot.sx(at)} cy={hTop + bot.sy(there)} r={5.5} />
      <text className="accent n halo" x={l + 5} y={top.sy(here) - 5}>{here.toFixed(1)}</text>
      <text className="warm n halo" x={l + 5} y={hTop + bot.sy(there) - 5}>{there.toFixed(1)}</text>
    </svg>
    <input type="range" aria-label="Position on the fitted axis" min={x[0]} max={x[1]} step={0.01} value={at} onChange={(e) => setAt(Number(e.target.value))} style={{ marginLeft: `${l / w * 100}%`, width: `${(w - l - top.r) / w * 100}%` }} />
    <div className="mfig-read" aria-live="polite">
      <span data-read="irt">IRT ability score <b>{here.toFixed(1)}</b><em>one more unit adds {(next - here).toFixed(1)}</em></span>
      <span data-read="eci">ECI-style score <b>{there.toFixed(1)}</b><em>one more unit adds {scale.toFixed(1)}, always</em></span>
      <span>Position <b>{at.toFixed(2)}</b></span>
    </div>
  </div>;
}
