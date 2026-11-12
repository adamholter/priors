"use client";
import { useState } from "react";
import type { ModelView } from "@/lib/model-view";
import { markColor, useChartPalette } from "../chart/echarts";
import { Radar, RadarSwatch } from "../chart/Radar";
import type { RadarSeries } from "../chart/radar-view";
import "../chart/radar.css";

/**
 * The model's shape across categories, over every current benchmark that measured it (the Strengths
 * panel above covers only this ranking's benchmarks). A radar against the ranking's leader and the
 * field median, and beside it one bar per category with how many benchmarks stand behind it.
 */
export function ModelDomains({ data, name, labId, labColors }: { data: NonNullable<ModelView["domains"]>; name: string; labId?: string; labColors: ModelView["labColors"] }) {
  const pal = useChartPalette();
  const { axes, me, leader, median, rows, models } = data;
  const [axis, setAxis] = useState<number | null>(null);
  const colorOf = (id?: string) => markColor(id ? labColors[id] : undefined, pal, id ?? "");
  const series: RadarSeries[] = [
    { id: "me", name, color: colorOf(labId), points: me },
    ...(leader ? [{ id: leader.id, name: `${leader.name} (#1)`, color: leader.labId === labId ? pal.ink2 : colorOf(leader.labId), dash: "5 4", points: leader.points }] : []),
  ];
  const total = rows.reduce((n, r) => n + r.n, 0);
  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b hairline pb-2">
        <h2 className="text-[26px]">By category</h2>
        <ul className="rl-legend" aria-label="On the radar">
          {series.map((s) => <li key={s.id}><RadarSwatch color={s.color} dash={s.dash} />{s.name}</li>)}
          <li className="rl-legend-median"><i aria-hidden="true" />Field median</li>
        </ul>
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center">
        <div className="flex justify-center min-w-0 overflow-x-clip">
          <Radar axes={axes} series={series} ghost={median} norm="rank" size={300} hoverAxis={axis} onHoverAxis={setAxis} ariaLabel={`${name}'s standing in ${axes.length} categories, against ${leader?.name ?? "the field median"}`} />
        </div>
        <ol className="grid gap-3 min-w-0" onMouseLeave={() => setAxis(null)}>
          {axes.map((a, i) => {
            const p = me[i], m = median[i], at = rows[i];
            return <li key={a.id} className={`grid gap-1 rounded-[4px] -mx-2 px-2 py-1 ${axis === i ? "bg-hair-2" : ""}`} onMouseEnter={() => setAxis(i)} title={a.description}>
              <div className="flex items-baseline gap-2 text-[13px] min-w-0">
                <span className="truncate">{a.name}</span>
                <span className="cap shrink-0">{at.n} benchmarks</span>
                <span className="num ml-auto shrink-0">{p.value == null ? "" : `${p.value.toFixed(0)}%`}</span>
                <span className="cap shrink-0 w-[78px] text-right whitespace-nowrap">#{at.rank} of {at.of}</span>
              </div>
              <span className="relative h-[8px] rounded-[2px] bg-hair-2" aria-hidden="true">
                {p.value != null && <i className="absolute inset-y-0 left-0 rounded-[2px]" style={{ width: `${p.value}%`, background: series[0].color }} />}
                {m.value != null && <i className="absolute -top-[3px] -bottom-[3px] w-[2px] rounded-full bg-ink" style={{ left: `calc(${m.value}% - 1px)`, opacity: 0.55 }} title="Field median" />}
              </span>
            </li>;
          })}
        </ol>
      </div>
      <p className="cap">Across {total} results on every current benchmark that measured {name}, not only this ranking&rsquo;s. The percentage is its average standing among the {models} models in this ranking that took the same benchmarks: 100% beat them all, 0% trailed them all. A benchmark in two categories counts in both; a category needs two benchmarks.</p>
    </section>
  );
}
