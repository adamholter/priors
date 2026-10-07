"use client";
import { useMemo, useState, type PointerEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { affordableModels, type ModelFinderData } from "@/lib/model-finder";
import { useTheme } from "@/components/Theme";
import { markColor, DARK_PALETTE, LIGHT_PALETTE } from "@/components/chart/theme";
import styles from "./ModelFinder.module.css";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: value < .01 ? 3 : 2, maximumFractionDigits: value < .01 ? 3 : 2 }).format(value);
export const budgetAt = (position: number) => position >= 100 ? null : .005 * Math.pow(2000, position / 99);
const angleAt = (value: number, max: number) => -100 + value / max * 200;

function Dial({ label, value, max, text, onChange }: { label: string; value: number; max: number; text: string; onChange: (value: number) => void }) {
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const angle = Math.atan2(event.clientX - rect.left - rect.width / 2, -(event.clientY - rect.top - rect.height / 2)) * 180 / Math.PI;
    onChange(Math.round((Math.max(-100, Math.min(100, angle)) + 100) / 200 * max));
  };
  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "PageUp" || event.key === "PageDown" ? Math.max(1, Math.round(max / 10)) : 1;
    const next = ["ArrowRight", "ArrowUp", "PageUp"].includes(event.key) ? value + step : ["ArrowLeft", "ArrowDown", "PageDown"].includes(event.key) ? value - step : event.key === "Home" ? 0 : event.key === "End" ? max : undefined;
    if (next != null) { event.preventDefault(); onChange(Math.max(0, Math.min(max, next))); }
  };
  return <div className={styles.control}>
    <div className={styles.dial} role="slider" tabIndex={0} aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={text} onKeyDown={key}
      onPointerDown={event => { event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); move(event); }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) move(event); }} onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="53" className={styles.face} />
        {Array.from({ length: 15 }, (_, i) => <line key={i} x1="60" y1="12" x2="60" y2={i % 7 === 0 ? 21 : 17} transform={`rotate(${-100 + i / 14 * 200} 60 60)`} className={styles.tick} />)}
        <g style={{ transform: `rotate(${angleAt(value, max)}deg)`, transformOrigin: "60px 60px" }} className={styles.needle}><path d="M57 63 L60 23 L63 63 Z" /><circle cx="60" cy="60" r="7" /></g>
      </svg>
    </div>
    <span className={styles.controlLabel}>{label}</span>
    <span className={styles.controlValue}>{text}</span>
    <div className={styles.steps}><button type="button" aria-label={`Decrease ${label.toLowerCase()}`} disabled={value === 0} onClick={() => onChange(Math.max(0, value - (max > 10 ? 5 : 1)))}>−</button><button type="button" aria-label={`Increase ${label.toLowerCase()}`} disabled={value === max} onClick={() => onChange(Math.min(max, value + (max > 10 ? 5 : 1)))}>+</button></div>
  </div>;
}

export function ModelFinder({ data, initialGroup = "overall", initialBudget = 100, initialMix }: { data: ModelFinderData; initialGroup?: string; initialBudget?: number; initialMix?: string }) {
  const { dark } = useTheme();
  const colorOf = (row: ModelFinderData["groups"][number]["mixes"][number]["variants"][number]) => markColor(row.color, dark ? DARK_PALETTE : LIGHT_PALETTE, row.labId);
  const [groupId, setGroupId] = useState(initialGroup);
  const [budgetPosition, setBudgetPosition] = useState(initialBudget);
  const [mixId, setMixId] = useState(initialMix);
  const [expanded, setExpanded] = useState(false);
  const group = data.groups.find(item => item.id === groupId) ?? data.groups[0];
  const groupPosition = data.groups.indexOf(group);
  const mix = group.mixes.find(item => item.id === mixId) ?? group.mixes[0];
  const budget = budgetAt(budgetPosition);
  const models = useMemo(() => affordableModels(mix.variants, budget), [mix.variants, budget]);
  const rows = expanded ? models : models.slice(0, 12);
  const syncUrl = (nextGroup: string, nextBudget: number, nextMix?: string) => {
    const url = new URL(location.href);
    url.searchParams.set("use", nextGroup);
    if (nextBudget < 100) url.searchParams.set("budget", String(nextBudget)); else url.searchParams.delete("budget");
    if (nextMix) url.searchParams.set("mix", nextMix); else url.searchParams.delete("mix");
    history.replaceState(null, "", url);
  };
  const changeBudget = (value: number) => { setBudgetPosition(value); syncUrl(group.id, value, mixId); };
  const changeGroup = (position: number) => { const id = data.groups[position].id; setGroupId(id); setMixId(undefined); setExpanded(false); syncUrl(id, budgetPosition); };
  const changeMix = (id: string) => { setMixId(id); setExpanded(false); syncUrl(group.id, budgetPosition, id); };
  return <section className={styles.card} aria-label="Model finder">
    <div className={styles.heading}><h1>Model finder</h1><p>Pick your constraints. Find your model.</p></div>
    <div className={styles.dials}>
      <Dial label="Budget per task" max={100} value={budgetPosition} text={budget == null ? "No limit" : money(budget)} onChange={changeBudget} />
      <Dial label="Optimize for" max={data.groups.length - 1} value={groupPosition} text={group.label} onChange={changeGroup} />
    </div>
    <div className={styles.useCases} role="group" aria-label="Use case">{data.groups.map((item, position) => <button key={item.id} type="button" aria-pressed={item.id === group.id} onClick={() => changeGroup(position)}>{item.label}</button>)}</div>
    <div className={styles.divider} />
    <div className={styles.tableHeading}><span>Model</span><span>{group.label} index</span><span>Cost / task</span></div>
    <div className={styles.rows} role="list" aria-label={`${group.label} models within budget`} style={{ height: rows.length * 44 }}>
      {rows.map((row, index) => <div role="listitem" className={styles.row} key={row.modelId} data-model={row.modelId} data-cost={row.costUsd} style={{ transform: `translateY(${index * 44}px)` }}>
        <Link className={styles.model} href={`/models/${row.modelId}` as "/"} title={`${row.name}, ${row.effort}, ${row.labName}`}><span className={styles.lab} aria-hidden="true" style={{ color: colorOf(row) }}>{row.labName.slice(0, 2)}</span><span>{row.name}<small>{row.effort === "default" ? "" : row.effort}</small></span></Link>
        <div className={styles.score} aria-label={`Index score ${row.score.toFixed(1)}`}><div className={styles.bar} style={{ width: `${Math.max(2, row.score)}%`, background: colorOf(row) }}><span>{row.score.toFixed(1)}</span></div></div>
        <span className={styles.cost} title={row.costSource ?? "Measured task cost"}>{money(row.costUsd)}</span>
      </div>)}
    </div>
    {!rows.length && <p className={styles.empty}>No measured model fits this budget. Turn the budget dial up.</p>}
    {models.length > 12 && <button className={styles.showMore} type="button" onClick={() => setExpanded(!expanded)}>{expanded ? "Show top 12" : `Show all ${models.length} models`}</button>}
    <details className={styles.evidence}><summary>Benchmark mix <span>{mix.name}</span></summary><div>
      <label>Mix <select value={mix.id} onChange={event => changeMix(event.target.value)}>{group.mixes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <p>{mix.description}</p>
      <ul>{mix.benchmarks.map(benchmark => <li key={benchmark.id}><a href={benchmark.url} target="_blank" rel="noreferrer">{benchmark.name}</a><span>{benchmark.weight.toFixed(0)}%</span></li>)}</ul>
      <Link href={mix.builderUrl as "/"}>Open mix in builder ↗</Link>
    </div></details>
    <p className={styles.note}>Strictness 50. Measured task costs only.</p>
    <p className={styles.source}>{data.costNote} Data as of {data.date}.</p>
  </section>;
}
