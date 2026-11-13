"use client";

import { useState } from "react";
import { benchmarkBlurb } from "@/lib/benchmark-blurb";
import { formatValue, ringLabels, type RadarAxis, type RadarNorm, type RadarPoint } from "./radar-data";
import { radarLabels } from "./radar-labels";

import { effortName, LAYER_OPACITY, type RadarSeries } from "./radar-view";

export type { RadarSeries };
type Hover = { kind: "axis"; axis: number } | { kind: "dot"; axis: number; series: string } | null;

const TAU = Math.PI * 2;
const r1 = (n: number) => +n.toFixed(1);
/** Label size, and the width a side label wraps at: wide enough for most names on one line, narrow enough that the margins do not shrink the chart. */
const LABEL_PX = 11.5, LABEL_W = 118;
export const spokeAngles = (n: number) => Array.from({ length: n }, (_, i) => (i / n) * TAU - Math.PI / 2);

/** Outline through the spokes that have data. A missing benchmark is skipped (no vertex), never pulled to the center. */
function shape(points: RadarPoint[], angles: number[], cx: number, cy: number, R: number) {
  const pts = points.flatMap((p, i) => p.r == null ? [] : [`${r1(cx + Math.cos(angles[i]) * R * p.r)},${r1(cy + Math.sin(angles[i]) * R * p.r)}`]);
  return pts.length ? pts.map((xy, i) => `${i ? "L" : "M"}${xy}`).join("") + "Z" : "";
}

/**
 * Evenly spaced radar. Hover targets are deliberately small: a benchmark name opens a card saying
 * what the benchmark measures, with each model's value; a model's dot opens a one-line value. The
 * plot area itself never triggers a tooltip, so it stays readable. Names wrap, they are never cut.
 */
export function Radar({ axes, series, ghost, norm, size = 340, labels = true, compact = false, hoverAxis, onHoverAxis, focus, ariaLabel, ghostLabel = "Field median", ghostStyle = "median", onAxisClick }: {
  axes: RadarAxis[]; series: RadarSeries[]; ghost?: RadarPoint[]; norm: RadarNorm; size?: number; labels?: boolean; compact?: boolean;
  hoverAxis?: number | null; onHoverAxis?: (i: number | null) => void; focus?: string | null; ariaLabel: string; ghostLabel?: string; ghostStyle?: "median" | "outline"; onAxisClick?: (benchmarkId: string) => void;
}) {
  const [hover, setHover] = useState<Hover>(null);
  const activeAxis = hover?.axis ?? hoverAxis ?? null;
  const set = (h: Hover) => { setHover(h); onHoverAxis?.(h?.kind === "axis" ? h.axis : null); };
  const R = size / 2, angles = spokeAngles(axes.length);
  const lay = labels ? radarLabels(axes.map((a) => a.label), { R, px: LABEL_PX, maxW: LABEL_W }) : null;
  // The circle stays centered; the canvas grows to hold the widest and tallest label.
  const padX = lay ? Math.ceil(Math.max(-lay.minX, lay.maxX) - R) + 4 : 4, padT = lay ? Math.ceil(-lay.minY - R) + 4 : 4, padB = lay ? Math.ceil(lay.maxY - R) + 4 : 4;
  const W = size + padX * 2, H = size + padT + padB, cx = W / 2, cy = padT + R;
  const rings = [0.25, 0.5, 0.75, 1], caps = ringLabels(norm);
  const single = series.length === 1;
  const at = (i: number, r: number) => ({ x: cx + Math.cos(angles[i]) * R * r, y: cy + Math.sin(angles[i]) * R * r });
  const label = (i: number) => { const l = lay!.labels[i]; return { ...l, x: r1(cx + l.x), y: r1(cy + l.y), left: r1(cx + l.left) }; };
  const pct = (x: number, y: number) => ({ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` });

  let tip = null;
  if (hover?.kind === "axis" && labels) {
    const l = label(hover.axis), a = axes[hover.axis], what = benchmarkBlurb(a.name, a.description, 220);
    // The card has a set width, so it can be held inside the chart: it starts under the label's left edge (centered for a label above or below) and slides in from the sides.
    const at = l.anchor === "middle" ? `${(l.x / W) * 100}% - var(--rl-tip-w) / 2` : `${(l.left / W) * 100}%`;
    // Always under the name, never above it: the card is tall now, and above the top labels it could leave the screen.
    const below = (l.y + (l.lines.length - 1) * lay!.lineHeight) / H;
    tip = <div className="rl-tip rl-tip-axis" role="status" style={{ left: `clamp(0px, ${at}, 100% - var(--rl-tip-w))`, top: `${below * 100}%`, transform: "translateY(10px)" }}>
      <strong>{a.name}</strong>
      <span className="rl-tip-sub">{a.sub ?? `${a.share.toFixed(0)}% of index`}</span>
      {what && <span className="rl-tip-what">{what}</span>}
      {series.map((s) => <span key={s.id} className="rl-tip-model">
        <span className="rl-tip-row"><i style={{ background: s.color }} />{s.name}{s.effort ? ` ${effortName(s.effort)}` : ""}<b>{formatValue(s.points[hover.axis], a)}</b></span>
        {!!s.layers?.length && <span className="rl-tip-layers">{s.layers.map((l) => `${effortName(l.effort)} ${formatValue(l.points[hover.axis], a)}`).join(" · ")}</span>}
      </span>)}
    </div>;
  } else if (hover?.kind === "dot") {
    const s = series.find((x) => x.id === hover.series), p = s?.points[hover.axis];
    if (s && p?.r != null) {
      const { x, y } = at(hover.axis, p.r);
      tip = <div className="rl-tip rl-tip-dot" role="status" style={{ ...pct(x, y), transform: "translate(-50%, calc(-100% - 9px))" }}>
        <b>{formatValue(p, axes[hover.axis])}{p.estimated && <em> est.</em>}</b> <span>{s.name} · {axes[hover.axis].label}</span>
      </div>;
    }
  }

  return <div className="rl-radar" style={{ maxWidth: W }}>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      {rings.map((t, i) => <circle key={t} cx={cx} cy={cy} r={R * t} className={i === rings.length - 1 ? "rl-ring rl-ring-outer" : "rl-ring"} />)}
      {angles.map((_, i) => { const e = at(i, 1); return <line key={axes[i].id} x1={cx} y1={cy} x2={r1(e.x)} y2={r1(e.y)} className={activeAxis === i ? "rl-spoke rl-spoke-on" : "rl-spoke"} />; })}
      {labels && !compact && caps.map((c, i) => { const a = -Math.PI / 2 + Math.PI / Math.max(3, axes.length); return c && <text key={c} x={r1(cx + Math.cos(a) * R * rings[i] + 3)} y={r1(cy + Math.sin(a) * R * rings[i] - 3)} className="rl-ring-cap">{c}</text>; })}
      {ghost && (() => { const d = shape(ghost, angles, cx, cy, R); return <path d={d} className={ghostStyle === "outline" ? "rl-ghost rl-ghost-outline" : "rl-ghost"} style={{ d: `path("${d}")` }}><title>{ghostLabel}</title></path>; })()}
      {series.map((s) => {
        const d = shape(s.points, angles, cx, cy, R), dim = !!focus && focus !== s.id;
        return <g key={s.id} className="rl-series" style={{ opacity: dim ? 0.15 : 1 }}>
          {/* Other efforts: fills with no outline, so the shape darkens toward the center where the lower efforts overlap. */}
          {s.layers?.map((l) => { const ld = shape(l.points, angles, cx, cy, R); return ld && <path key={l.effort} d={ld} className="rl-layer" style={{ fill: s.color, fillOpacity: LAYER_OPACITY * (focus === s.id ? 1.5 : 1) }} />; })}
          <path d={d} style={{ d: `path("${d}")`, fill: s.color, fillOpacity: s.layers?.length ? LAYER_OPACITY * (focus === s.id ? 1.5 : 1) : single ? 0.16 : focus === s.id ? 0.2 : 0.05, stroke: s.color }} strokeDasharray={s.dash} className="rl-shape" />
          {!compact && s.points.map((p, i) => { if (p.r == null) return null; const { x, y } = at(i, p.r); const on = hover?.kind === "dot" && hover.series === s.id && hover.axis === i;
            return <circle key={i} cx={r1(x)} cy={r1(y)} r={on ? 5 : 3.2} className="rl-dot" style={{ fill: p.estimated ? "var(--white)" : s.color, stroke: p.estimated ? s.color : "var(--white)" }} />; })}
        </g>;
      })}
      {/* Dot hit targets: 7px radius, only around the marks. Later series win ties, so the top-drawn dot gets the hover. */}
      {!compact && series.map((s) => (!focus || focus === s.id) && s.points.map((p, i) => { if (p.r == null) return null; const { x, y } = at(i, p.r);
        return <circle key={`${s.id}-${i}`} cx={r1(x)} cy={r1(y)} r={7} className="rl-hit" onMouseEnter={() => set({ kind: "dot", axis: i, series: s.id })} onMouseLeave={() => set(null)} />; }))}
      {labels && angles.map((_, i) => { const l = label(i);
        const open = onAxisClick && (() => { set(null); onAxisClick(axes[i].id); });
        return <g key={axes[i].id} className={open ? "rl-axis-link" : undefined} onMouseEnter={() => set({ kind: "axis", axis: i })} onMouseLeave={() => set(null)}
          {...(open ? { role: "button", tabIndex: 0, "aria-label": `About ${axes[i].name}`, onClick: open, onFocus: () => set({ kind: "axis", axis: i }), onBlur: () => set(null), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } } } : {})}>
          <rect x={r1(l.left - 4)} y={r1(l.y - 13)} width={r1(l.w + 8)} height={r1(l.h + 4)} className="rl-hit" />
          <text x={l.x} y={l.y} textAnchor={l.anchor} className={activeAxis === i ? "rl-label rl-label-on" : "rl-label"}>{l.lines.map((line, k) => <tspan key={k} x={l.x} dy={k ? lay!.lineHeight : 0}>{line}</tspan>)}</text>
        </g>; })}
    </svg>
    {tip}
  </div>;
}

export function RadarSwatch({ color, dash }: { color: string; dash?: string }) {
  return <svg className="rl-swatch" width="20" height="10" aria-hidden="true"><line x1="1" y1="5" x2="19" y2="5" stroke={color} strokeWidth="2.5" strokeDasharray={dash} strokeLinecap="round" /></svg>;
}
