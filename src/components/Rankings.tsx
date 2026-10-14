"use client";
import { ChartExport, escapeSvg } from "./chart/ChartExport";
import { useRef, useState, type ReactNode } from "react";
import type { Lab } from "@/data/types";
import type { RankedVariant } from "@/engine";
import { variantLabel } from "./chart/ParetoChart";
import { markColor, useChartPalette } from "./chart/echarts";
import { ChartLink } from "./chart/ChartLink";
import { RankingColumns } from "./chart/RankingColumns";

/** Dense horizontal bars, color by lab, rows slide to their new position when the order changes. */
type RankingsProps = { ranked: RankedVariant[]; labs: Lab[]; limit?: number; showEffort?: boolean; onSelect?: (r: RankedVariant | null) => void; selected?: string | null; title?: ReactNode; actions?: ReactNode; anchor?: string };

/** Analysis-style themes draw the leaderboard as vertical columns; every other theme keeps the dense rows. */
export function Rankings(props: RankingsProps) {
  const columns = useChartPalette().style?.barLabels === "inside";
  return columns ? <RankingsColumns {...props} /> : <RankingsRows {...props} />;
}

function RankingsColumns({ ranked, labs, limit = 30, onSelect, selected, showEffort = true, title, actions, anchor }: RankingsProps) {
  const [expanded, setExpanded] = useState(false);
  const cap = Math.min(limit, 20);
  const rows = expanded ? ranked : ranked.slice(0, cap);
  const svg = useRef<() => string | undefined>(() => undefined);
  const head = <div id={anchor} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-3 min-h-8 scroll-mt-20"><div className="min-w-0">{title}</div><div className="flex items-center gap-1 ml-auto">{actions}{anchor && <ChartLink id={anchor} name="Rankings" />}<ChartExport name="Rankings" getSvg={() => svg.current()} getRows={() => ranked.map((r) => ({ rank: r.rank, model: r.model.name, effort: showEffort ? r.variant.effort : "best", score: +r.score.toFixed(2), lab: r.model.labId, cost_per_task_usd: r.costUsd ?? null, speed_toks: r.speed ?? null, coverage: r.coverage }))} /></div></div>;
  if (!rows.length) return <>{head}<p className="cap py-6">No model has enough measured data for this index. Loosen a requirement, lower a weight, or reduce strictness.</p></>;
  return <>{head}<RankingColumns rows={rows} labs={labs} showEffort={showEffort} selected={selected} onSelect={onSelect} getRef={(f) => { svg.current = f; }} />
    {ranked.length > cap && <button className="cap mt-3 hover:text-ink" onClick={() => setExpanded(!expanded)}>{expanded ? "Show fewer" : `Show all ${ranked.length} ${showEffort ? "variants" : "models"}`}</button>}</>;
}

function RankingsRows({ ranked, labs, limit = 30, onSelect, selected, showEffort = true, title, actions, anchor }: RankingsProps) {
  const pal = useChartPalette();
  const color = new Map(labs.map((l) => [l.id, markColor(l.color, pal, l.id)]));
  const [expanded, setExpanded] = useState(false);
  const rows = expanded ? ranked : ranked.slice(0, limit);
  const max = Math.max(...rows.map((r) => r.score), 1);
  const pitch = Math.round(30 * (pal.size?.row ?? 1));

  const head = (exp: ReactNode) => <div id={anchor} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-3 min-h-8 scroll-mt-20"><div className="min-w-0">{title}</div><div className="flex items-center gap-1 ml-auto">{actions}{anchor && <ChartLink id={anchor} name="Rankings" />}{exp}</div></div>;
  if (!rows.length) return <>{head(null)}<p className="cap py-6">No model has enough measured data for this index. Loosen a requirement, lower a weight, or reduce strictness.</p></>;
  return (
    <>
    {head(<ChartExport name="Rankings" getRows={() => ranked.map((r) => ({ rank: r.rank, model: r.model.name, effort: showEffort ? r.variant.effort : "best", score: +r.score.toFixed(2), lab: r.model.labId, cost_per_task_usd: r.costUsd ?? null, speed_toks: r.speed ?? null, coverage: r.coverage }))} getSvg={() => {
      const h = 88 + rows.length * 38;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="${h}" viewBox="0 0 1600 ${h}"><rect width="1600" height="${h}" fill="${pal.bg}"/><g font-family="Inter,Arial,sans-serif" fill="${pal.ink}"><text x="30" y="36" font-size="24">Rankings</text>${rows.map((r, i) => {
        const y = 76 + i * 38;
        const label = showEffort ? variantLabel(r) : r.model.name;
        return `<text x="30" y="${y}" font-size="14" fill="${pal.grey}">${i + 1}</text><text x="70" y="${y}" font-size="15">${escapeSvg(label)}</text><rect x="330" y="${y - 13}" width="1120" height="14" fill="${pal.dark ? "#262624" : "#ECEAE3"}"/><rect x="330" y="${y - 13}" width="${r.score / max * 1120}" height="14" fill="${escapeSvg(color.get(r.model.labId) ?? '#A3A39B')}"/><text x="1550" y="${y}" text-anchor="end" font-size="16">${r.score.toFixed(1)}</text>`;
      }).join('')}</g></svg>`;
    }} />)}
    <div className="ranking-list relative overflow-hidden isolate" style={{ height: Math.max(0, rows.length * pitch - 4), contain: "layout paint" }}>
      {rows.map((r, index) => (
        <button type="button" key={showEffort ? r.variant.id : r.model.id} title={r.variant.sourceModel?.name ?? variantLabel(r)} aria-label={`${r.variant.sourceModel?.name ?? variantLabel(r)}, ${r.score.toFixed(1)}`} data-k={r.variant.id} data-mixed={r.mixedEfforts || undefined} onClick={() => onSelect?.(selected === r.variant.id ? null : r)}
          style={{ transform: `translateY(${index * pitch}px)`, ...(pitch !== 30 ? { height: pitch - 4 } : {}) }}
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
    </>
  );
}
