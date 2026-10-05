"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconArrowDown, IconArrowUp, IconChevronLeft, IconChevronRight, IconX } from "@tabler/icons-react";
import { Radar, RadarSwatch, type RadarSeries } from "./Radar";
import { formatValue, type RadarAxis, type RadarModel, type RadarNorm, type RadarPoint } from "./radar-data";

/** One model's full radar against a chosen comparison, benchmarks sorted by gap. Arrow keys step through models. */
export function RadarModal({ onClose, onStep, series, all, axes, norm, model, leader, median, onAxisClick }: {
  onClose: () => void; onStep: (dir: 1 | -1) => void; onAxisClick?: (benchmarkId: string) => void;
  series: RadarSeries; all: RadarSeries[]; axes: RadarAxis[]; norm: RadarNorm; model: RadarModel; leader: RadarSeries; median: RadarPoint[];
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [axis, setAxis] = useState<number | null>(null);
  const [compareId, setCompareId] = useState("leader");
  useEffect(() => {
    const d = ref.current;
    // No close() in cleanup: StrictMode's remount would fire onClose and dismiss the modal. Unmounting removes it anyway.
    if (d && !d.open) d.showModal();
  }, []);

  const isLeader = series.id === leader.id;
  const other = useMemo(() => {
    if (compareId === "median") return { name: "Field median", points: median, outline: false };
    const pick = compareId === "leader" ? (isLeader ? all[1] : leader) : all.find((s) => s.id === compareId);
    return pick ? { name: pick.name, points: pick.points, outline: true } : { name: "Field median", points: median, outline: false };
  }, [compareId, median, isLeader, all, leader]);
  // Benchmarks either side lacks have no gap; they sort last.
  const gaps = axes.map((a, i) => {
    const mine = model.points[i], theirs = other.points[i];
    return { a, i, mine, theirs, d: mine.r == null || theirs.r == null ? null : Math.round((mine.r - theirs.r) * 100) };
  }).sort((x, y) => (y.d ?? -Infinity) - (x.d ?? -Infinity));

  return <dialog ref={ref} className="rl-modal" aria-labelledby="rl-modal-title" onClose={onClose} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    onKeyDown={(e) => { if (e.target instanceof HTMLSelectElement) return; if (e.key === "ArrowRight") onStep(1); if (e.key === "ArrowLeft") onStep(-1); }}>
    <div className="rl-modal-inner">
      <header className="rl-modal-head">
        <div className="rl-modal-title">
          <RadarSwatch color={series.color} dash={series.dash} />
          <h2 id="rl-modal-title">{model.name}</h2>
          <span className="num cap">#{model.rank} · {model.score.toFixed(1)}</span>
        </div>
        <div className="rl-modal-nav">
          {all.length > 1 && <>
            <button type="button" aria-label="Previous model" onClick={() => onStep(-1)}><IconChevronLeft size={16} aria-hidden="true" /></button>
            <span className="cap num">{all.findIndex((s) => s.id === series.id) + 1} / {all.length}</span>
            <button type="button" aria-label="Next model" onClick={() => onStep(1)}><IconChevronRight size={16} aria-hidden="true" /></button>
          </>}
          <button type="button" aria-label="Close" onClick={onClose}><IconX size={16} aria-hidden="true" /></button>
        </div>
      </header>
      <div className="rl-modal-body">
        <div className="rl-modal-chart">
          <Radar axes={axes} series={[series]} ghost={other.points} ghostStyle={other.outline ? "outline" : "median"} ghostLabel={other.name} norm={norm} size={360} hoverAxis={axis} onHoverAxis={setAxis} onAxisClick={onAxisClick} ariaLabel={`${model.name} against ${other.name}`} />
          <p className="rl-modal-key cap"><span className={other.outline ? "rl-key-outline" : "rl-key-median"} aria-hidden="true" /> {other.name}</p>
        </div>
        <aside className="rl-modal-notes">
          <div className="rl-m-compare">
            <label htmlFor="rl-compare">Compare with</label>
            <select id="rl-compare" value={compareId} onChange={(e) => setCompareId(e.target.value)}>
              {(!isLeader || all.length > 1) && <option value="leader">{isLeader ? `Next best (${all[1]?.name})` : `Leader (${leader.name})`}</option>}
              <option value="median">Field median</option>
              {all.filter((s) => s.id !== series.id && s.id !== leader.id && !(isLeader && s.id === all[1]?.id)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <h3>Biggest gaps vs {other.name}</h3>
          <ol className="rl-m-list">{gaps.map(({ a, i, mine, theirs, d }) => <li key={a.id} className={axis === i ? "rl-m-row rl-m-row-on" : "rl-m-row"} onMouseEnter={() => setAxis(i)} onMouseLeave={() => setAxis(null)}>
            <span className="rl-m-name" title={a.name}>{a.name}</span>
            <span className="rl-m-val-cmp">
              <b className="num">{formatValue(mine, a)}</b><span className="cap">vs {formatValue(theirs, a)}</span>
              {d == null ? <span className="num rl-m-delta">–<i aria-hidden="true" /></span> :
              <span className={`num rl-m-delta${d > 0 ? " up" : d < 0 ? " down" : ""}`} aria-label={d === 0 ? "even" : `${d > 0 ? "ahead" : "behind"} by ${Math.abs(d)}`}>
                {d > 0 ? `+${d}` : d < 0 ? `−${-d}` : "0"}
                {d > 0 ? <IconArrowUp size={13} stroke={2.2} aria-hidden="true" /> : d < 0 ? <IconArrowDown size={13} stroke={2.2} aria-hidden="true" /> : <i aria-hidden="true" />}
              </span>}
            </span>
          </li>)}</ol>
          <p className="rl-m-foot cap">Gap in spoke points (0–100 on the current scale).</p>
        </aside>
      </div>
    </div>
  </dialog>;
}
