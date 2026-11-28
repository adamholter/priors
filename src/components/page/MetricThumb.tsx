"use client";
import { createContext, useCallback, useContext, useMemo, useState, type PointerEvent } from "react";
import type { Lab, Snapshot } from "@/data/types";
import type { Mark, Summary } from "@/lib/metric-summary";
import { AXIS_H, frontier, nearestMark, PAD, placeMarks, radarPath, thumbKind } from "@/lib/metric-thumbs";
import { usageData, usageStack } from "@/lib/usage-stream";
import { LabLogo } from "../LabLogo";
import { useLabColor } from "../chart/echarts";
import { RadarSwatch } from "../chart/Radar";
import { radarSeries } from "../chart/radar-view";

const LabsCtx = createContext<Lab[]>([]);
export const MetricLabs = LabsCtx.Provider;
/** The page's labs and `color(labId)`, the lab's mark color for the current palette (dark-tuned). */
function useMetricLabs() {
  const labs = useContext(LabsCtx), colorOf = useLabColor();
  const color = useCallback((labId: string) => colorOf(labId, labs.find((l) => l.id === labId)?.color), [labs, colorOf]);
  return { labs, color };
}
export function Logo({ labId, name, size = 16 }: { labId: string; name: string; size?: number }) {
  const { labs } = useMetricLabs();
  return <LabLogo lab={labId} name={name} size={size} color={labs.find((l) => l.id === labId)?.color} />;
}

/** A small real chart per metric, drawn from the same points the open chart uses. The top ten models carry their lab color, every other model is grey, and the answer is ringed. */
export function Thumb({ s, w, h, active, onActive, snapshot, mini = false }: { s: Summary; w: number; h: number; active?: Mark | null; onActive?: (m: Mark | null) => void; snapshot: Snapshot; mini?: boolean }) {
  const { color } = useMetricLabs();
  const kind = thumbKind(s.id);
  const placed = useMemo(() => placeMarks(s, w, h, mini), [s, w, h, mini]);
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!onActive || !placed.length) return;
    const r = e.currentTarget.getBoundingClientRect();
    onActive(nearestMark(placed, kind, e.clientX - r.left, e.clientY - r.top, h));
  };
  const ringR = mini ? 3.6 : 4.8;
  const lead = s.answer?.key ? placed.find((p) => p.m.key === s.answer!.key) : undefined, hit = active && placed.find((p) => p.m.key === active.key);
  const ring = (p: (typeof placed)[number] | null | undefined) => p && (kind === "bars"
    ? <rect x={p.x - (p.bw ?? 2) / 2 - 1} y={p.y - 1} width={(p.bw ?? 2) + 2} height={(p.bh ?? 0) + 1} fill="none" stroke="var(--ink)" strokeWidth="1.5" />
    : <circle cx={p.x} cy={p.y} r={ringR} fill="none" stroke="var(--ink)" strokeWidth="1.5" />);
  const greys = placed.filter((p) => !p.m.top), tops = placed.filter((p) => p.m.top), r = mini ? 1.8 : 2.4;
  const round = s.id === "uptime" ? 2 : 0;
  return (
    <svg className="cs-thumb-svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${s.title}, ${s.n} models`} onPointerMove={onMove} onPointerLeave={() => onActive?.(null)}>
      {kind === "scatter" && <>
        {s.id === "date" && !mini && <DateAxis s={s} w={w} h={h} />}
        {s.id === "tpt" && <polyline points={frontier(placed).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} fill="none" stroke="var(--ink)" strokeOpacity=".6" strokeWidth="1" />}
        {greys.map((p) => <circle key={p.m.key} cx={p.x} cy={p.y} r={r} fill="var(--grey)" fillOpacity={active ? .22 : .38} />)}
        {tops.map((p) => <circle key={p.m.key} cx={p.x} cy={p.y} r={r + .5} fill={color(p.m.labId)} fillOpacity={active ? .55 : .85} />)}
        {lead && <circle cx={lead.x} cy={lead.y} r={r + .8} fill={lead.m.top ? color(lead.m.labId) : "var(--grey)"} />}
        {ring(lead)}
      </>}
      {kind === "bars" && <>
        <line x1={PAD} x2={w - PAD} y1={h - PAD + .5} y2={h - PAD + .5} stroke="var(--hair-2)" strokeWidth="1" />
        {greys.map((p) => <rect key={p.m.key} x={p.x - (p.bw ?? 2) / 2} y={p.y} width={p.bw} height={p.bh} rx={round} fill="var(--grey)" fillOpacity={active ? .18 : .3} />)}
        {tops.map((p) => <rect key={p.m.key} x={p.x - (p.bw ?? 2) / 2} y={p.y} width={p.bw} height={p.bh} rx={round} fill={color(p.m.labId)} fillOpacity={active ? .6 : .9} />)}
        {ring(lead)}
      </>}
      {kind === "radar" && s.strengths && <RadarShape s={s} size={h} mini={mini} />}
      {kind === "stream" && <StreamShape w={w} h={h} snapshot={snapshot} />}
      {hit && hit !== lead && ring(hit)}
    </svg>
  );
}

/** The two end dates under a release-date thumbnail, on a thin time axis. */
function DateAxis({ s, w, h }: { s: Summary; w: number; h: number }) {
  const first = s.marks[s.marks.length - 1]?.text ?? "", last = s.marks[0]?.text ?? "";
  return <>
    <line x1={PAD} x2={w - PAD} y1={h - PAD - AXIS_H + 3} y2={h - PAD - AXIS_H + 3} stroke="var(--hair-2)" strokeWidth="1" />
    <text x={PAD} y={h - 1} className="cs-axt" textAnchor="start">{first}</text>
    <text x={w - PAD} y={h - 1} className="cs-axt" textAnchor="end">{last}</text>
  </>;
}

/** The index's top three models over each other: the leader filled, the others outlined, same-lab models told apart by dashes (as the full radar does). */
function useStrengthSeries(s: Summary) {
  const { color } = useMetricLabs();
  return useMemo(() => {
    const top = s.strengths?.top ?? [];
    return radarSeries(top, top.map((m) => m.id), "lab", false, color);
  }, [s, color]);
}

function RadarShape({ s, size, mini, focus }: { s: Summary; size: number; mini: boolean; focus?: string | null }) {
  const series = useStrengthSeries(s), n = s.strengths!.axes;
  const R = size / 2 - (mini ? 2 : 6), c = mini ? R + 2 : size / 2;
  const ring = (k: number) => radarPath(Array.from({ length: n }, () => ({ r: k })), c, size / 2, R);
  return <g>
    <polygon points={ring(1)} fill="none" stroke="var(--hair-2)" strokeWidth="1" />
    {!mini && <polygon points={ring(0.55)} fill="none" stroke="var(--hair-2)" strokeWidth="1" />}
    {!mini && Array.from({ length: n }, (_, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return <line key={i} x1={c} y1={size / 2} x2={c + Math.cos(a) * R} y2={size / 2 + Math.sin(a) * R} stroke="var(--hair-2)" strokeWidth="1" />; })}
    {/* Back to front, so the leader is drawn last. */}
    {[...series].reverse().map((m, i, all) => {
      const lead = i === all.length - 1, dim = !!focus && focus !== m.id;
      return <polygon key={m.id} points={radarPath(m.points, c, size / 2, R)} fill={m.color} fillOpacity={lead || focus === m.id ? .16 : 0} stroke={m.color} strokeOpacity={dim ? .3 : 1} strokeWidth={lead ? 1.6 : 1.3} strokeDasharray={m.dash} strokeLinejoin="round" />;
    })}
  </g>;
}

/** The Strengths card's chart: the radar with the three models named beside it, pointing at a name lights its outline. */
export function StrengthsThumb({ s, h }: { s: Summary; h: number }) {
  const series = useStrengthSeries(s), [focus, setFocus] = useState<string | null>(null);
  return <div className="cs-radar" onPointerLeave={() => setFocus(null)}>
    <svg className="cs-thumb-svg" width={h} height={h} viewBox={`0 0 ${h} ${h}`} role="img" aria-label={`${s.title}, ${series.map((m) => m.name).join(", ")}`}><RadarShape s={s} size={h} mini={false} focus={focus} /></svg>
    <ol className="cs-key" aria-hidden="true">
      {series.map((m) => <li key={m.id} data-on={focus === m.id} onPointerEnter={() => setFocus(m.id)}><RadarSwatch color={m.color} dash={m.dash} /><span title={m.name}>{m.name}</span></li>)}
    </ol>
  </div>;
}

/** The names of the top three, for the phone row: "Fable 5.2, Opus 5.5, Gemini 4 Neon". */
export const strengthNames = (s: Summary) => (s.strengths?.top ?? []).map((m) => m.name).join(", ");

/** Daily share of T3 Code turns by model: the top six by lab color, the rest in a neutral band. */
function StreamShape({ w, h, snapshot }: { w: number; h: number; snapshot: Snapshot }) {
  const { color } = useMetricLabs();
  const stack = useMemo(() => { const d = usageData(snapshot); return d ? usageStack(d, 6) : null; }, [snapshot]);
  if (!stack) return null;
  const days = stack.series[0]?.share.length ?? 0, iw = w - 2 * PAD, ih = h - 2 * PAD;
  const seen = new Map<string, number>(), cum = new Array<number>(days).fill(0);
  const x = (i: number) => PAD + (days > 1 ? (i / (days - 1)) * iw : 0);
  const y = (v: number) => (PAD + ih - (Math.min(v, 100) / 100) * ih).toFixed(1);
  const bands = stack.series.map((band) => {
    const lo = [...cum];
    band.share.forEach((v, i) => { cum[i] += v; });
    const k = seen.get(band.labId ?? band.id) ?? 0; seen.set(band.labId ?? band.id, k + 1);
    const top = cum.map((v, i) => `${x(i).toFixed(1)},${y(v)}`), bottom = lo.map((v, i) => `${x(i).toFixed(1)},${y(v)}`).reverse();
    return { id: band.id, d: `M${top.join("L")}L${bottom.join("L")}Z`, fill: band.id === "other" ? "var(--hair-2)" : color(band.labId ?? ""), op: band.id === "other" ? 1 : [.62, .44, .32, .24][Math.min(k, 3)] };
  });
  return <g>{bands.map((b) => <path key={b.id} d={b.d} fill={b.fill} fillOpacity={b.op} stroke="var(--bone)" strokeWidth=".75" />)}</g>;
}
