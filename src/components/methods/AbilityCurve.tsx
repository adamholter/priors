"use client";
/**
 * `/methods/scoring`: the curve that turns an ability into an IRT ability score. The thick line is what a model of each ability
 * is expected to average on the mix; today's models sit on it. The slider moves a model along it, to show the height closing in
 * on 100 while the position keeps going.
 */
import { useState } from "react";
import { curveAt, frame, mixAt, spaced, ticks, type FigCurve, type FigPoint } from "./figure-math";
import "./scoring-figures.css";

export function AbilityCurve({ w, curves, models, x }: { w: number; curves: FigCurve[]; /** Best first; x is the ability, y the score. */ models: FigPoint[]; x: [number, number] }) {
  const [at, setAt] = useState(models[0]?.x ?? 0);
  const wide = w > 500, f = frame(w, wide ? 330 : 280, x, [0, 100]), y0 = f.h - f.b, mid = (f.l + f.w - f.r) / 2;
  const here = mixAt(curves, at), next = mixAt(curves, at + 1);
  // Names go up and to the left of their dot, into the empty space above the curve; one that would run off the left edge is dropped.
  const named = spaced(models.filter((m) => m.x >= x[0] && f.sx(m.x) - 8 - m.name.length * 6.2 > f.l), (m) => [f.sx(m.x), f.sy(m.y)], wide ? 104 : 84);
  const xs = ticks(x[0], x[1], wide ? 8 : 5);
  return <div className="mfig-slide grid gap-2">
    <svg viewBox={`0 0 ${f.w} ${f.h}`} role="img" aria-label={`The index score a model is expected to average on this mix, against its ability. It rises along an S-shaped curve and flattens toward 100. Today's top model, ${models[0]?.name}, sits at ${models[0]?.y.toFixed(1)}.`}>
      {[0, 25, 50, 75, 100].map((v) => <g key={v}><line className="gridline" x1={f.l} x2={f.w - f.r} y1={f.sy(v)} y2={f.sy(v)} /><text className="n" x={f.l - 6} y={f.sy(v) + 3.5} textAnchor="end">{v}</text></g>)}
      {xs.map((v) => <g key={v}><line className="axis" x1={f.sx(v)} x2={f.sx(v)} y1={y0} y2={y0 + 4} /><text className="n" x={f.sx(v)} y={y0 + 16} textAnchor="middle">{v}</text></g>)}
      <line className="axis" x1={f.l} x2={f.w - f.r} y1={y0} y2={y0} />
      <text x={f.l} y={f.t - 9}>Expected score on the mix: what IRT ability reports</text>
      <text x={mid} y={y0 + 33} textAnchor="middle">Ability: what an ECI-style score reports, on its own scale</text>
      {curves.map((c) => <path key={c.id} className="faint" d={f.line((v) => curveAt(c, v))} />)}
      <path className="curve c0" strokeWidth={3} d={f.line((v) => mixAt(curves, v))} />
      {models.filter((m) => m.x >= x[0]).map((m) => <circle key={m.name} className="mark" cx={f.sx(m.x).toFixed(1)} cy={f.sy(m.y).toFixed(1)} r={wide ? 2.6 : 2.1}><title>{`${m.name}: ability ${m.x.toFixed(2)}, score ${m.y.toFixed(1)}`}</title></circle>)}
      {named.map((m) => <text key={m.name} className="ink halo" x={f.sx(m.x) - 8} y={f.sy(m.y) - 6} textAnchor="end">{m.name}</text>)}
      <path className="guide" d={`M${f.l} ${f.sy(here)}H${f.sx(at)}V${y0}`} />
      <circle className="d0 knob" cx={f.sx(at)} cy={f.sy(here)} r={5.5} />
      <text className="accent n halo" x={f.l + 5} y={f.sy(here) - 5}>{here.toFixed(1)}</text>
    </svg>
    <input type="range" aria-label="Ability" min={x[0]} max={x[1]} step={0.01} value={at} onChange={(e) => setAt(Number(e.target.value))} style={{ marginLeft: `${f.l / f.w * 100}%`, width: `${(f.w - f.l - f.r) / f.w * 100}%` }} />
    <div className="mfig-read" aria-live="polite">
      <span>Ability <b>{at.toFixed(2)}</b></span>
      <span>IRT ability score <b>{here.toFixed(1)}</b></span>
      <span>One more unit of ability adds <b>{(next - here).toFixed(1)} points</b></span>
    </div>
  </div>;
}
