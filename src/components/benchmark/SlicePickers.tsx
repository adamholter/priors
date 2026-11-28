"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { Lab } from "@/data/types";
import type { RankedVariant } from "@/engine";
import { LabLogo } from "../LabLogo";
import { useLabColor } from "../chart/echarts";
import { Panel } from "../page/MetricGallery";
import { valueFor } from "@/lib/benchmark-chart";
import { formatMetric, type BenchMetric, type MetricGroup } from "@/lib/benchmark-metrics";
import { benchmarkPath } from "@/lib/benchmark-slug";
import { dotPath, flatSlices, measureSet, measureStat, rowText, shadeOf, sliceGroups, type MStat, type Peer, type PeerTop, type PRow, type PSet, type SlicePeers } from "@/lib/benchmark-slices";
import { LowerMark, OldMark, Palette, PickTrigger, type Block, type Lead } from "./Picker";

/** The pickers of a benchmark page: category, version, measure and breakdown group. Each names its choice and who leads it, and opens a palette that previews the highlighted row. */

const leadOfTop = (t?: PeerTop): Lead | undefined => t && { labId: t.labId, name: t.name, color: t.color, text: t.text };

/* ---------- previews ---------- */

function TopFive({ top }: { top: PeerTop[] }) {
  const colorOf = useLabColor();
  const max = Math.max(...top.map((t) => t.raw), 0) || 1;
  return (
    <ol className="pk-top5">
      {top.map((t, i) => (
        <li key={t.id}>
          <span className="pk-top5-rank num">{i + 1}</span>
          <LabLogo lab={t.labId} name={t.name} color={t.color} size={16} />
          <span className="pk-top5-name">{t.name}</span>
          <span className="pk-top5-bar"><span style={{ width: `${Math.max(2, (t.raw / max) * 100)}%`, background: colorOf(t.labId, t.color) }} /></span>
          <span className="pk-top5-val num">{t.text}</span>
        </li>
      ))}
    </ol>
  );
}

function BoardPreview({ title, peer, older }: { title: string; peer?: Peer; older?: boolean }) {
  const lead = peer?.top[0];
  return (
    <>
      <h3 className="pk-prev-title">{lead && <LabLogo lab={lead.labId} name={lead.name} color={lead.color} size={20} />}<span>{title}</span></h3>
      {peer && peer.top.length > 0 && <TopFive top={peer.top} />}
      <p className="pk-prev-foot num">{peer ? `${peer.n} models` : ""}{older && <OldMark />}</p>
    </>
  );
}

/** One measure as a small score-against-measure plot: every model grey, the five best on the score in lab colour. Nothing but dots. */
const THUMB = { w: 380, h: 150, k: 1.35 };
function Thumb({ stat }: { stat: MStat | undefined }) {
  const colorOf = useLabColor();
  const { w, h, k } = THUMB;
  const hot = useMemo(() => {
    const by = new Map<string, { x: number; y: number }[]>();
    for (const p of stat?.hot ?? []) { const c = colorOf(p.labId, p.color); (by.get(c) ?? by.set(c, []).get(c)!).push(p); }
    return [...by];
  }, [stat, colorOf]);
  if (!stat || stat.n < 3) return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="pk-thumb" aria-hidden="true"><text x={w / 2} y={h / 2 + 4} textAnchor="middle" className="pk-thumb-none">no data</text></svg>;
  const pad = 2.5 + 2.2 * k;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="pk-thumb" aria-hidden="true">
      <line x1={pad} x2={w - pad} y1={h - 1} y2={h - 1} stroke="var(--hair)" />
      <path d={dotPath(stat.pts, w, h - 2, pad + 1)} stroke="var(--grey)" strokeOpacity=".5" strokeWidth={2.6 * k} strokeLinecap="round" fill="none" />
      {hot.map(([c, pts]) => <path key={c} d={dotPath(pts, w, h - 2, pad + 1)} stroke={c} strokeWidth={4.4 * k} strokeLinecap="round" fill="none" />)}
    </svg>
  );
}

/** Every model's value on one min to max line: grey dots, the top three in lab colour. */
function DotLine({ stat }: { stat: MStat }) {
  const colorOf = useLabColor();
  const w = 120, h = 16;
  if (stat.n < 3) return <span className="pk-dotline-none" style={{ width: w }} />;
  const by = new Map<string, { x: number; y: number }[]>();
  for (const p of [...stat.top].reverse()) { const c = colorOf(p.labId, p.color); (by.get(c) ?? by.set(c, []).get(c)!).push({ x: p.t, y: 0.5 }); }
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <line x1="3" x2={w - 3} y1={h / 2} y2={h / 2} stroke="var(--hair)" />
      <path d={dotPath(stat.pts.map((p) => ({ x: p.x, y: 0.5 })), w, h, 4)} stroke="var(--grey)" strokeOpacity=".45" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      {[...by].map(([c, pts]) => <path key={c} d={dotPath(pts, w, h, 4)} stroke={c} strokeWidth="4.4" strokeLinecap="round" fill="none" />)}
    </svg>
  );
}

function MeasurePreview({ row, stat }: { row: PRow; stat?: MStat }) {
  const lead = stat?.leader;
  return (
    <>
      <h3 className="pk-prev-title"><span>{row.label}</span></h3>
      <div className="pk-prev-plot">
        <Thumb stat={stat} />
        {stat && stat.n >= 3 && <div className="pk-prev-axis num"><span>{formatMetric(stat.kind, stat.min)}</span><span>{formatMetric(stat.kind, stat.max)}</span></div>}
      </div>
      {lead && <p className="pk-prev-lead"><LabLogo lab={lead.labId} name={lead.name} color={lead.color} size={16} /><span>{lead.name}</span><span className="num pk-leader-val">{lead.text}</span>{row.lower && <span className="pk-prev-lower"><LowerMark size={14} />Lower is better</span>}</p>}
      <p className="pk-prev-foot num">{stat ? `${stat.n} models` : ""}</p>
    </>
  );
}

function GroupPreview({ row, group, ranked }: { row: PRow; group: MetricGroup; ranked: RankedVariant[] }) {
  const cols = group.metrics.slice(0, 3), rows = ranked.slice(0, 5); // five rows: the preview box is a fixed height, and six clipped the footer when headers wrap
  const range = useMemo(() => cols.map((m) => { const v = ranked.flatMap((r) => { const x = valueFor(m, r); return x == null ? [] : [x]; }); return [Math.min(...v), Math.max(...v)] as const; }), [cols, ranked]);
  return (
    <>
      <h3 className="pk-prev-title"><span>{row.label}</span></h3>
      <div className="pk-prev-table" style={{ gridTemplateColumns: `minmax(0, 1.2fr) repeat(${cols.length}, minmax(0, 1fr))` }}>
        <span />{cols.map((m) => <span key={m.id} className="pk-prev-col" title={m.label}>{m.group ? m.label.split(" · ").pop() : m.label}</span>)}
        {rows.map((r) => <div key={r.variant.id} className="pk-prev-row">
          <span className="pk-prev-model">{r.model.name}</span>
          {cols.map((m, i) => { const v = valueFor(m, r), [lo, hi] = range[i]; return <span key={m.id} className="pk-prev-cell num" style={v == null ? undefined : { background: shadeOf(hi > lo ? (v - lo) / (hi - lo) : 0.5, m.better === "lower") }}>{v == null ? "" : formatMetric(m.kind, v)}</span>; })}
        </div>)}
      </div>
      <p className="pk-prev-foot num">{group.metrics.length} columns{group.metrics.length > cols.length ? `, ${cols.length} shown` : ""}</p>
    </>
  );
}

/* ---------- category and version ---------- */

/** A pick goes to another page, which draws its own picker: the person who picked from the keyboard keeps their place there. */
let refocus: "cat" | "ver" | null = null;

/** Category splits and versions: the other boards of this benchmark, each with its leader. */
export function Relatives({ current, family, familyLabel = "Category", versions, peers }: { current: string; family: { id: string; label: string }[]; familyLabel?: string; versions: { id: string; label: string }[]; peers?: SlicePeers }) {
  const router = useRouter();
  const [open, setOpen] = useState<"cat" | "ver" | null>(null);
  const cat = useRef<HTMLButtonElement>(null), ver = useRef<HTMLButtonElement>(null);
  const groups = useMemo(() => sliceGroups(family, peers), [family, peers]);
  const flat = useMemo(() => flatSlices(groups), [groups]);
  const catBlocks = useMemo<Block[]>(() => groups.map((g) => ({ key: g.key, label: g.label || undefined, rows: g.items.map((x) => ({ id: x.id, label: x.short, lead: leadOfTop(x.peer?.top[0]), href: benchmarkPath(x.id) })) })), [groups]);
  const verBlocks = useMemo<Block[]>(() => [{ key: "v", rows: versions.map((x, i) => ({ id: x.id, label: x.label, old: i > 0, lead: leadOfTop(peers?.[x.id]?.top[0]), href: benchmarkPath(x.id) })) }], [versions, peers]);
  const go = useCallback((id: string, from: "cat" | "ver") => { refocus = from; router.push(benchmarkPath(id) as "/"); }, [router]);
  const goCat = useCallback((id: string) => go(id, "cat"), [go]);
  const goVer = useCallback((id: string) => go(id, "ver"), [go]);
  const closeAll = useCallback(() => setOpen(null), []);
  useEffect(() => { const r = refocus; refocus = null; if (r) (r === "ver" ? ver : cat).current?.focus({ preventScroll: true }); }, [current]);
  if (!family.length && !versions.length) return null;
  const at = flat.findIndex((x) => x.id === current), cur = flat[Math.max(0, at)];
  const vcur = versions.find((x) => x.id === current) ?? versions[0];
  const step = (e: KeyboardEvent, d: number) => { const n = flat[at + d]; if (n && at >= 0) { e.preventDefault(); goCat(n.id); } };
  return (
    <div className="pk pk-fields">
      {/* The pickers draw their lists only when open, so the sibling boards are linked here for crawlers and screen readers (no prefetch: 29 links must not fetch 29 pages). */}
      {flat.length + versions.length > 1 && <nav className="sr-only" aria-label="Related benchmarks"><ul>
        {flat.map((x) => <li key={x.id}><Link href={benchmarkPath(x.id) as "/"} prefetch={false}>{x.label}</Link></li>)}
        {versions.map((x) => <li key={x.id}><Link href={benchmarkPath(x.id) as "/"} prefetch={false}>{x.label}</Link></li>)}
      </ul></nav>}
      {cur && <>
        <PickTrigger innerRef={cat} label={familyLabel} name={cur.label} lead={leadOfTop(cur.peer?.top[0])} open={open === "cat"} onClick={() => setOpen(open === "cat" ? null : "cat")}
          onKeyDown={(e) => { if (e.key === "ArrowRight") step(e, 1); else if (e.key === "ArrowLeft") step(e, -1); }} />
        {open === "cat" && <Palette blocks={catBlocks} value={at < 0 ? flat[0].id : current} onPick={goCat} onClose={closeAll} anchor={cat} label={familyLabel} small={family.length <= 6}
          preview={(id) => <BoardPreview title={family.find((x) => x.id === id)?.label ?? ""} peer={peers?.[id]} />} />}
      </>}
      {vcur && <>
        <PickTrigger innerRef={ver} label="Version" name={vcur.label} old={versions.indexOf(vcur) > 0} lead={leadOfTop(peers?.[vcur.id]?.top[0])} open={open === "ver"} onClick={() => setOpen(open === "ver" ? null : "ver")} />
        {open === "ver" && <Palette blocks={verBlocks} value={vcur.id} onPick={goVer} onClose={closeAll} anchor={ver} label="Version" small
          preview={(id) => <BoardPreview title={versions.find((x) => x.id === id)?.label ?? ""} peer={peers?.[id]} older={versions.findIndex((x) => x.id === id) > 0} />} />}
      </>}
    </div>
  );
}

/* ---------- measures ---------- */

/** The "Score vs any published measure" panel: the measure picker sits in its header and previews each measure's own plot. */
export function ExplorePanel({ details, exploring, pick, defaultOpen, chart, ranked, labs }: { details: BenchMetric[]; exploring: BenchMetric; pick: (id: string) => void; defaultOpen?: boolean; /** The chart, keyed by the measure. */ chart: ReactNode; ranked: RankedVariant[]; labs: Lab[] }) {
  const set = useMemo(() => measureSet(details), [details]);
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  // Every measure's spread is only worked out while the palette is open.
  const stats = useMemo(() => open ? new Map(details.map((m) => [m.id, measureStat(m, ranked, labs)])) : null, [open, details, ranked, labs]);
  const blocks = useMemo<Block[]>(() => set.sections.map((s) => ({ key: s.key, label: s.label, rows: [...s.rows, ...s.entities.flatMap((e) => e.rows)].map((r) => ({ id: r.id, label: rowText(r), lower: r.lower, lead: stats?.get(r.id)?.leader })) })), [set, stats]);
  const close = useCallback(() => setOpen(false), []);
  const row = set.byId.get(exploring.id);
  return (
    <>
      <Panel anchor="metric-explore" title="Score vs any published measure" desc={`${details.length} measures: sub-scores, splits, counts`} defaultOpen={defaultOpen}
        tools={<span className="pk-tools" onClick={(e) => e.stopPropagation()}><PickTrigger bare innerRef={btn} name={row?.label ?? exploring.label} lower={row?.lower} open={open} onClick={() => setOpen((v) => !v)} /></span>}>
        {chart}
      </Panel>
      {open && stats && <Palette blocks={blocks} value={exploring.id} onPick={pick} onClose={close} anchor={btn} label="Measures"
        preview={(id) => <MeasurePreview row={set.byId.get(id)!} stat={stats.get(id)} />} />}
    </>
  );
}

/** A standard measure's summary (steps, time, tokens): the spread of every model and who leads, so a closed row says something. */
export function StandardTools({ metric, ranked, labs }: { metric: BenchMetric; ranked: RankedVariant[]; labs: Lab[] }) {
  const stat = useMemo(() => measureStat(metric, ranked, labs), [metric, ranked, labs]);
  const lead = stat.leader;
  if (!lead) return null;
  return (
    <span className="pk-std">
      <span className="pk-std-line"><DotLine stat={stat} /></span>
      <LabLogo lab={lead.labId} name={lead.name} color={lead.color} size={14} />
      <span className="pk-std-val num">{lead.text}</span>
    </span>
  );
}

/* ---------- breakdown groups ---------- */

/** The Breakdown table's group picker: 28 groups in sections, each previewing its first columns. */
export function GroupPicker({ set, groups, ranked, value, onPick }: { set: PSet; groups: MetricGroup[]; ranked: RankedVariant[]; value: string; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const byId = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const blocks = useMemo<Block[]>(() => set.sections.map((s) => ({ key: s.key, label: s.label, rows: s.rows.map((r) => ({ id: r.id, label: r.label, note: `${r.count} columns` })) })), [set]);
  const close = useCallback(() => setOpen(false), []);
  return (
    <div className="pk pk-fields">
      <PickTrigger innerRef={btn} label="Breakdown" name={set.byId.get(value)?.label ?? ""} open={open} onClick={() => setOpen((v) => !v)} />
      {open && <Palette blocks={blocks} value={value} onPick={onPick} onClose={close} anchor={btn} label="Breakdown groups" preview={(id) => <GroupPreview row={set.byId.get(id)!} group={byId.get(id)!} ranked={ranked} />} />}
    </div>
  );
}
