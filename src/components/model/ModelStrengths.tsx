"use client";
import { useState } from "react";
import type { ModelView } from "@/lib/model-view";
import { markColor, useChartPalette } from "../chart/echarts";
import { Radar, RadarSwatch } from "../chart/Radar";
import { formatValue } from "../chart/radar-data";
import type { RadarSeries } from "../chart/radar-view";
import { InfoIcon } from "../BenchmarkInfo";
import "../chart/radar.css";

/**
 * The model's shape across the index's benchmarks, as on the builder's Strengths panel: a radar of
 * this model against the index leader and the field median, and beside it one bar per benchmark
 * showing where the model sits in the field (the median ticked), with its value and place.
 */
export function ModelStrengths({ data, labColors, onInfo }: { data: NonNullable<ModelView["strengths"]>; labColors: ModelView["labColors"]; onInfo: (benchmarkId: string) => void }) {
  const pal = useChartPalette();
  const { axes, me, leader, median, place, models, mixName } = data;
  const [axis, setAxis] = useState<number | null>(null);
  const colorOf = (labId: string) => markColor(labColors[labId], pal, labId);
  const series: RadarSeries[] = [
    { id: me.id, name: me.name, color: colorOf(me.labId), points: me.points },
    ...(leader && leader.id !== me.id ? [{ id: leader.id, name: `${leader.name} (#1)`, color: leader.labId === me.labId ? pal.ink2 : colorOf(leader.labId), dash: "5 4", points: leader.points }] : []),
  ];
  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b hairline pb-2">
        <h2 className="text-[26px]">Strengths</h2>
        <ul className="rl-legend" aria-label="On the radar">
          {series.map((s) => <li key={s.id}><RadarSwatch color={s.color} dash={s.dash} />{s.name}</li>)}
          <li className="rl-legend-median"><i aria-hidden="true" />Field median</li>
        </ul>
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center">
        <div className="flex justify-center min-w-0 overflow-x-clip">
          <Radar axes={axes} series={series} ghost={median} norm="field" size={300} hoverAxis={axis} onHoverAxis={setAxis} onAxisClick={onInfo} ariaLabel={`${me.name} across the ${axes.length} benchmarks in ${mixName}, against ${leader?.name ?? "the leader"} and the field median`} />
        </div>
        <ol className="grid gap-3 min-w-0" onMouseLeave={() => setAxis(null)}>
          {axes.map((a, i) => {
            const p = me.points[i], m = median[i], at = place[i];
            return <li key={a.id} className={`grid gap-1 rounded-[4px] -mx-2 px-2 py-1 ${axis === i ? "bg-hair-2" : ""}`} onMouseEnter={() => setAxis(i)}>
              <div className="flex items-baseline gap-2 text-[13px] min-w-0">
                <span className="truncate">{a.name}</span><InfoIcon name={a.name} onClick={() => onInfo(a.id)} />
                <span className="cap shrink-0">{a.share.toFixed(0)}%</span>
                <span className="num ml-auto shrink-0">{formatValue(p, a)}{p.estimated ? " est." : ""}</span>
                <span className="cap shrink-0 w-[78px] text-right whitespace-nowrap">{at ? `#${at.rank} of ${at.n}` : "no data"}</span>
              </div>
              <span className="relative h-[8px] rounded-[2px] bg-hair-2" aria-hidden="true">
                {p.r != null && <i className="absolute inset-y-0 left-0 rounded-[2px]" style={{ width: `${p.r * 100}%`, background: series[0].color, opacity: p.estimated ? 0.55 : 1 }} />}
                {m.r != null && <i className="absolute -top-[3px] -bottom-[3px] w-[2px] rounded-full bg-ink" style={{ left: `calc(${m.r * 100}% - 1px)`, opacity: 0.55 }} title="Field median" />}
              </span>
            </li>;
          })}
        </ol>
      </div>
      <p className="cap">Bars show where {me.name} sits among the {models} ranked models on each benchmark (right is best); the tick is the field median.</p>
    </section>
  );
}
