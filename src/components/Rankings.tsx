"use client";
import { ChartExport, escapeSvg } from "./chart/ChartExport";
import { useState } from "react";
import type { Lab } from "@/data/types";
import type { RankedVariant } from "@/engine";
import { variantLabel } from "./chart/ParetoChart";

/** Dense horizontal bars, color by lab, rows slide to their new position when the order changes. */
export function Rankings({ ranked, hidden, hiddenCount, onShowHidden, onIncludeAll, hiddenNote, labs, limit = 30, onSelect, selected, showEffort = true }: { ranked: RankedVariant[]; hidden?: RankedVariant[]; hiddenCount?: number; onShowHidden?: () => void; onIncludeAll?: () => void; hiddenNote?: string; labs: Lab[]; limit?: number; showEffort?: boolean; onSelect?: (r: RankedVariant | null) => void; selected?: string | null }) {
  const color = new Map(labs.map((l) => [l.id, l.color]));
  const [expanded, setExpanded] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const rows = expanded ? ranked : ranked.slice(0, limit);
  const max = Math.max(...rows.map((r) => r.score), ...(hidden ?? []).map((r) => r.score), 1);

  if (!rows.length && !(hiddenCount ?? 0)) return <p className="cap py-6">No model has every required benchmark. Loosen a requirement or lower a weight.</p>;
  return (
    <>
    <ChartExport name="Rankings" getRows={() => ranked.map((r) => ({ rank: r.rank, model: r.model.name, effort: showEffort ? r.variant.effort : "best", score: +r.score.toFixed(2), lab: r.model.labId, cost_per_task_usd: r.costUsd ?? null, speed_toks: r.speed ?? null, coverage: r.coverage }))} getSvg={() => {
      const h = 88 + rows.length * 38;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="${h}" viewBox="0 0 1600 ${h}"><rect width="1600" height="${h}" fill="#FBFBF9"/><g font-family="Inter,Arial,sans-serif" fill="#1A1A1A"><text x="30" y="36" font-size="24">Rankings</text>${rows.map((r, i) => {
        const y = 76 + i * 38;
        const label = showEffort ? variantLabel(r) : r.model.name;
        return `<text x="30" y="${y}" font-size="14" fill="#8A8A80">${i + 1}</text><text x="70" y="${y}" font-size="15">${escapeSvg(label)}</text><rect x="850" y="${y - 13}" width="600" height="14" fill="#ECEAE3"/><rect x="850" y="${y - 13}" width="${r.score / max * 600}" height="14" fill="${escapeSvg(color.get(r.model.labId) ?? '#A3A39B')}"/><text x="1550" y="${y}" text-anchor="end" font-size="16">${r.score.toFixed(1)}</text>`;
      }).join('')}</g></svg>`;
    }} />
    <div className="ranking-list relative overflow-hidden isolate" style={{ height: Math.max(0, rows.length * 30 - 4), contain: "layout paint" }}>
      {rows.map((r, index) => (
        <button type="button" key={showEffort ? r.variant.id : r.model.id} title={r.variant.sourceModel?.name ?? variantLabel(r)} aria-label={`${r.variant.sourceModel?.name ?? variantLabel(r)}, ${r.score.toFixed(1)}`} data-k={r.variant.id} data-mixed={r.mixedEfforts || undefined} onClick={() => onSelect?.(selected === r.variant.id ? null : r)}
          style={{ transform: `translateY(${index * 30}px)` }}
          className={`row-move absolute top-0 left-0 w-full grid grid-cols-[28px_minmax(0,140px)_minmax(0,1fr)_48px] sm:grid-cols-[28px_minmax(120px,210px)_minmax(0,1fr)_48px] items-center gap-2.5 h-[26px] text-left text-[12.5px] rounded-sm px-1 focus-visible:outline-offset-[-2px] ${selected === r.variant.id ? "bg-white" : "hover:bg-white/60"}`}>
          <span className="cap text-right">{r.rank}</span>
          <span className="truncate">{r.model.name}{showEffort && r.variant.effort !== "default" && <em className="not-italic cap ml-1.5">{r.variant.effort}</em>}</span>
          <span className="h-[12px] rounded-[2px] bg-hair-2 overflow-hidden"><i className="bar-fill block h-full rounded-[2px]" style={{ width: `${(r.score / max) * 100}%`, background: color.get(r.model.labId) ?? "#A3A39B" }} /></span>
          <span className="num text-right">{r.score.toFixed(1)}</span>
        </button>
      ))}
      {rows[0] && <span className="sr-only">{variantLabel(rows[0])}</span>}
    </div>
    {ranked.length > limit && <button className="cap mt-3 hover:text-ink" onClick={() => setExpanded(!expanded)}>{expanded ? "Show fewer" : `Show all ${ranked.length} ${showEffort ? "variants" : "models"}`}</button>}
    {(hiddenCount ?? 0) > 0 && (
      <div className="mt-4 border-t hairline pt-3">
        <button type="button" className="cap hover:text-ink" onClick={() => { setShowHidden(!showHidden); onShowHidden?.(); }}>
          {showHidden ? "Hide" : "Show"} {hiddenCount} {hiddenNote ?? `hidden ${showEffort ? "variants" : "models"}`}
        </button>
        {showHidden && hidden && <>
          <div className="mt-2 grid gap-0.5">
            {hidden.map((r) => (
              <div key={r.variant.id} className="grid grid-cols-[28px_minmax(0,140px)_minmax(0,1fr)_48px] sm:grid-cols-[28px_minmax(120px,210px)_minmax(0,1fr)_48px] items-center gap-2.5 h-[26px] text-[12.5px] px-1 opacity-55" title={`${variantLabel(r)} — hidden from this index`}>
                <span className="cap text-right">—</span>
                <span className="truncate text-ink-2">{r.model.name}{showEffort && r.variant.effort !== "default" && <em className="not-italic cap ml-1.5">{r.variant.effort}</em>}</span>
                <span className="h-[12px] rounded-[2px] bg-hair-2 overflow-hidden"><i className="block h-full rounded-[2px]" style={{ width: `${(r.score / max) * 100}%`, background: color.get(r.model.labId) ?? "#A3A39B" }} /></span>
                <span className="num text-right text-ink-2">{r.score.toFixed(1)}</span>
              </div>
            ))}
          </div>
          {onIncludeAll && <button type="button" className="cap mt-2 hover:text-ink" onClick={onIncludeAll}>Include all in this index</button>}
        </>}
        {showHidden && !hidden && <p className="cap mt-2">Computing scores…</p>}
      </div>
    )}
    </>
  );
}
