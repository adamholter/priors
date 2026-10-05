"use client";

import { useState } from "react";
import { formatValue, ringLabels, type RadarAxis, type RadarNorm, type RadarPoint } from "./radar-data";

export interface RadarSeries { id: string; name: string; color: string; dash?: string; points: RadarPoint[] }
type Hover = { kind: "axis"; axis: number } | { kind: "dot"; axis: number; series: string } | null;

const TAU = Math.PI * 2;
const r1 = (n: number) => +n.toFixed(1);
const trim = (s: string, n: number) => s.length > n ? `${s.slice(0, n - 1)}…` : s;
export const spokeAngles = (n: number) => Array.from({ length: n }, (_, i) => (i / n) * TAU - Math.PI / 2);

/** Outline through the spokes that have data. A missing benchmark is skipped (no vertex), never pulled to the center. */
function shape(points: RadarPoint[], angles: number[], cx: number, cy: number, R: number) {
  const pts = points.flatMap((p, i) => p.r == null ? [] : [`${r1(cx + Math.cos(angles[i]) * R * p.r)},${r1(cy + Math.sin(angles[i]) * R * p.r)}`]);
  return pts.length ? pts.map((xy, i) => `${i ? "L" : "M"}${xy}`).join("") + "Z" : "";
}

/**
 * Evenly spaced radar. Hover targets are deliberately small: a benchmark name opens a compact
 * benchmark card placed outward from the label; a model's dot opens a one-line value. The plot
 * area itself never triggers a tooltip, so it stays readable.
 */
export function Radar({ axes, series, ghost, norm, size = 340, labels = true, compact = false, hoverAxis, onHoverAxis, focus, ariaLabel, ghostLabel = "Field median", ghostStyle = "median", onAxisClick }: {
  axes: RadarAxis[]; series: RadarSeries[]; ghost?: RadarPoint[]; norm: RadarNorm; size?: number; labels?: boolean; compact?: boolean;
  hoverAxis?: number | null; onHoverAxis?: (i: number | null) => void; focus?: string | null; ariaLabel: string; ghostLabel?: string; ghostStyle?: "median" | "outline"; onAxisClick?: (benchmarkId: string) => void;
}) {
  const [hover, setHover] = useState<Hover>(null);
  const activeAxis = hover?.axis ?? hoverAxis ?? null;
  const set = (h: Hover) => { setHover(h); onHoverAxis?.(h?.kind === "axis" ? h.axis : null); };
  const padX = labels ? 112 : 4, padY = labels ? 30 : 4;
  const W = size + padX * 2, H = size + padY * 2, cx = W / 2, cy = H / 2, R = size / 2;
  const angles = spokeAngles(axes.length);
  const rings = [0.25, 0.5, 0.75, 1], caps = ringLabels(norm);
  const single = series.length === 1;
  const at = (i: number, r: number) => ({ x: cx + Math.cos(angles[i]) * R * r, y: cy + Math.sin(angles[i]) * R * r });
  const label = (i: number) => {
    const a = angles[i], c = Math.cos(a), s = Math.sin(a);
    const x = r1(cx + c * (R + 12)), y = r1(cy + s * (R + 12));
    const anchor: "middle" | "start" | "end" = Math.abs(c) < 0.2 ? "middle" : c > 0 ? "start" : "end";
    const dy = s < -0.6 ? -4 : s > 0.6 ? 12 : 4;
    return { x, y: y + dy, anchor, top: s < -0.2, text: trim(axes[i].label, compact ? 12 : 18) };
  };
  const pct = (x: number, y: number) => ({ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` });

  let tip = null;
  if (hover?.kind === "axis" && labels) {
    const l = label(hover.axis), a = axes[hover.axis];
    const tx = l.anchor === "start" ? "0" : l.anchor === "end" ? "-100%" : "-50%";
    const ty = l.top ? "calc(-100% - 18px)" : "10px";
    tip = <div className="rl-tip rl-tip-axis" role="status" style={{ ...pct(l.x, l.y), transform: `translate(${tx}, ${ty})` }}>
      <strong>{a.name}</strong>
      <span className="rl-tip-sub">{a.share.toFixed(0)}% of index</span>
      {series.map((s) => <span key={s.id} className="rl-tip-row"><i style={{ background: s.color }} />{s.name}<b>{formatValue(s.points[hover.axis], a)}</b></span>)}
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
      {labels && !compact && caps.map((c, i) => c && <text key={c} x={r1(cx + Math.cos(-1.22) * R * rings[i] + 4)} y={r1(cy + Math.sin(-1.22) * R * rings[i] - 3)} className="rl-ring-cap">{c}</text>)}
      {ghost && (() => { const d = shape(ghost, angles, cx, cy, R); return <path d={d} className={ghostStyle === "outline" ? "rl-ghost rl-ghost-outline" : "rl-ghost"} style={{ d: `path("${d}")` }}><title>{ghostLabel}</title></path>; })()}
      {series.map((s) => {
        const d = shape(s.points, angles, cx, cy, R), dim = !!focus && focus !== s.id;
        return <g key={s.id} className="rl-series" style={{ opacity: dim ? 0.15 : 1 }}>
          <path d={d} style={{ d: `path("${d}")`, fill: s.color, fillOpacity: single ? 0.16 : focus === s.id ? 0.2 : 0.05, stroke: s.color }} strokeDasharray={s.dash} className="rl-shape" />
          {!compact && s.points.map((p, i) => { if (p.r == null) return null; const { x, y } = at(i, p.r); const on = hover?.kind === "dot" && hover.series === s.id && hover.axis === i;
            return <circle key={i} cx={r1(x)} cy={r1(y)} r={on ? 5 : 3.2} className="rl-dot" style={{ fill: p.estimated ? "var(--white)" : s.color, stroke: p.estimated ? s.color : "var(--white)" }} />; })}
        </g>;
      })}
      {/* Dot hit targets: 7px radius, only around the marks. Later series win ties, so the top-drawn dot gets the hover. */}
      {!compact && series.map((s) => (!focus || focus === s.id) && s.points.map((p, i) => { if (p.r == null) return null; const { x, y } = at(i, p.r);
        return <circle key={`${s.id}-${i}`} cx={r1(x)} cy={r1(y)} r={7} className="rl-hit" onMouseEnter={() => set({ kind: "dot", axis: i, series: s.id })} onMouseLeave={() => set(null)} />; }))}
      {labels && angles.map((_, i) => { const l = label(i);
        const w = l.text.length * 6.4 + 8, x0 = l.anchor === "start" ? l.x - 4 : l.anchor === "end" ? l.x - w + 4 : l.x - w / 2;
        const open = onAxisClick && (() => { set(null); onAxisClick(axes[i].id); });
        return <g key={axes[i].id} className={open ? "rl-axis-link" : undefined} onMouseEnter={() => set({ kind: "axis", axis: i })} onMouseLeave={() => set(null)}
          {...(open ? { role: "button", tabIndex: 0, "aria-label": `About ${axes[i].name}`, onClick: open, onFocus: () => set({ kind: "axis", axis: i }), onBlur: () => set(null), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } } } : {})}>
          <rect x={r1(x0)} y={l.y - 13} width={r1(w)} height={18} className="rl-hit" />
          <text x={l.x} y={l.y} textAnchor={l.anchor} className={activeAxis === i ? "rl-label rl-label-on" : "rl-label"}>{l.text}</text>
        </g>; })}
    </svg>
    {tip}
  </div>;
}

export function RadarSwatch({ color, dash }: { color: string; dash?: string }) {
  return <svg className="rl-swatch" width="20" height="10" aria-hidden="true"><line x1="1" y1="5" x2="19" y2="5" stroke={color} strokeWidth="2.5" strokeDasharray={dash} strokeLinecap="round" /></svg>;
}
