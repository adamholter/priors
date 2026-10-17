"use client";
import { useState, type CSSProperties } from "react";
import { resolvePreset, presetStyle, resolveAccent } from "@/lib/page-presets";
import { markColor } from "@/components/chart/theme";
import { paletteFor } from "@/components/chart/theme";
import { useTheme } from "@/components/Theme";
import "./lab.css";
import "./explore-lab.css";

export interface LabCard {
  handle: string; name: string; avatarUrl?: string; when: string; index: string; others: string[]; more: number; count: number;
  top: { name: string; score: number; labId: string; base: string }[]; theme?: { preset?: string; accent?: string; mode?: "auto" | "fixed" }; mix: { name: string; share: number }[]; x?: string;
}
type Design = "bars" | "spotlight" | "fill" | "columns";
const DESIGNS: { id: Design; label: string; note: string }[] = [
  { id: "bars", label: "A · Bars under names", note: "Thin bar per model" },
  { id: "spotlight", label: "B · Leader spotlight", note: "#1 big, others smaller" },
  { id: "fill", label: "C · Filled rows", note: "Row is the bar" },
  { id: "columns", label: "D · Podium columns", note: "Top 3 side by side" },
];

const XLogo = ({ size = 12 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>;
const Avatar = ({ c, size = 36 }: { c: LabCard; size?: number }) => c.avatarUrl
  // eslint-disable-next-line @next/next/no-img-element
  ? <img src={c.avatarUrl} alt="" width={size} height={size} className="xl-avatar" style={{ width: size, height: size }} />
  : <span aria-hidden="true" className="xl-avatar xl-avatar-ph" style={{ width: size, height: size }}>{c.name.slice(0, 1).toUpperCase()}</span>;

function XLink({ c, style }: { c: LabCard; style: "icon" | "chip" }) {
  if (!c.x) return null;
  return <a className={style === "chip" ? "xl-x xl-x-chip" : "xl-x"} href={`https://x.com/${c.x}`} target="_blank" rel="noreferrer" aria-label={`${c.name} on X`} title={`@${c.x} on X`}><XLogo size={style === "chip" ? 11 : 13} />{style === "chip" && <span>@{c.x}</span>}</a>;
}

function Head({ c, xStyle, size }: { c: LabCard; xStyle: "icon" | "chip"; size?: number }) {
  return <div className="xl-head">
    <Avatar c={c} size={size} />
    <div className="xl-who">
      <div className="xl-name"><span>{c.name}</span>{xStyle === "icon" && <XLink c={c} style="icon" />}</div>
      <div className="cap xl-sub">@{c.handle} · {c.when}</div>
    </div>
    {xStyle === "chip" && <span className="xl-chip-slot"><XLink c={c} style="chip" /></span>}
  </div>;
}

/** Benchmark weights as a proportional strip, or the old sentence. */
function Mix({ c, mode }: { c: LabCard; mode: "bars" | "text" }) {
  if (!c.count) return null;
  if (mode === "text") return <p className="cap xl-mixtext">{c.count} benchmark{c.count === 1 ? "" : "s"} · {c.mix.slice(0, 3).map((b) => `${b.name} ${b.share}%`).join(", ")}</p>;
  const shown = c.mix.slice(0, 4), rest = Math.max(0, 100 - shown.reduce((s, b) => s + b.share, 0));
  return <div className="xl-mix">
    <div className="xl-strip" role="img" aria-label={shown.map((b) => `${b.name} ${b.share}%`).join(", ")}>
      {shown.map((b, i) => <i key={b.name} style={{ flex: b.share, opacity: 1 - i * 0.2 }} title={`${b.name} ${b.share}%`} />)}
      {rest > 0 && <i style={{ flex: rest, opacity: 0.12 }} />}
    </div>
    <p className="cap xl-mixtext">{c.count} benchmark{c.count === 1 ? "" : "s"} · {shown.slice(0, 3).map((b) => `${b.name} ${b.share}%`).join(" · ")}</p>
  </div>;
}

function Models({ c: card, design, zoom, colorOf }: { c: LabCard; design: Design; zoom: boolean; colorOf: (m: LabCard["top"][number]) => string }) {
  const c = { ...card, top: card.top.map((m) => ({ ...m, color: colorOf(m) })) };
  const lead = c.top[0]?.score || 1, low = c.top[c.top.length - 1]?.score ?? lead, floor = lead - Math.max(10, (lead - low) * 2);
  const frac = (v: number) => (zoom ? Math.max(0.12, (v - floor) / (lead - floor || 1)) : v / 100);
  if (!c.top.length) return <p className="cap">No ranked models on today&apos;s data.</p>;
  if (design === "bars") return <ol className="xl-list">{c.top.map((m, i) => <li key={m.name}>
    <span className="cap xl-rank">{i + 1}</span>
    <div className="xl-row"><div className="xl-line"><span className="xl-model"><i style={{ background: m.color }} />{m.name}</span><span className="num">{m.score.toFixed(1)}</span></div>
      <div className="xl-bar"><b style={{ width: `${frac(m.score) * 100}%`, background: m.color }} /></div></div>
  </li>)}</ol>;
  if (design === "fill") return <ol className="xl-fill">{c.top.map((m, i) => <li key={m.name} style={{ "--w": `${frac(m.score) * 100}%`, "--c": m.color } as CSSProperties}>
    <span className="xl-fill-bg" /><span className="cap xl-rank">{i + 1}</span><span className="xl-model">{m.name}</span><span className="num">{m.score.toFixed(1)}</span></li>)}</ol>;
  if (design === "columns") return <div className="xl-cols">{c.top.map((m, i) => <div key={m.name} className="xl-col">
    <span className="num xl-col-score">{m.score.toFixed(1)}</span>
    <div className="xl-col-bar"><b style={{ height: `${Math.max(14, frac(m.score) * 100)}%`, background: m.color, opacity: i === 0 ? 1 : 0.55 }} /></div>
    <span className="xl-col-name" title={m.name}><span className="cap">{i + 1}</span> {m.name}</span></div>)}</div>;
  const [first, ...rest] = c.top;
  return <div className="xl-spot">
    <div className="xl-spot-lead"><div><span className="cap">#1</span><div className="xl-spot-name"><i style={{ background: first.color }} />{first.name}</div></div><span className="xl-spot-score">{first.score.toFixed(1)}</span></div>
    <div className="xl-bar xl-bar-lg"><b style={{ width: `${frac(first.score) * 100}%`, background: first.color }} /></div>
    {rest.map((m, i) => <div key={m.name} className="xl-spot-row"><span className="cap">{i + 2}</span><span className="xl-model"><i style={{ background: m.color }} />{m.name}</span><div className="xl-bar"><b style={{ width: `${frac(m.score) * 100}%`, background: m.color }} /></div><span className="num">{m.score.toFixed(1)}</span></div>)}
  </div>;
}

/** The card wears its owner's page theme: resolved for the viewer's light/dark unless the owner fixed a mode. */
function lookOf(c: LabCard, dark: boolean) {
  const preset = resolvePreset(c.theme, dark), pal = paletteFor(preset);
  return { preset, style: presetStyle(preset, resolveAccent(c.theme, preset)) as CSSProperties, color: (m: LabCard["top"][number]) => markColor(m.base, pal, m.labId) };
}

export function ExploreLab({ cards }: { cards: LabCard[] }) {
  const { dark, mode, setMode } = useTheme();
  const [design, setDesign] = useState<Design>("bars");
  const [mix, setMix] = useState<"bars" | "text">("bars");
  const [xStyle, setXStyle] = useState<"icon" | "chip">("icon");
  const [cols, setCols] = useState<2 | 3>(3);
  const [zoom, setZoom] = useState(false);
  const opt = <T extends string | number>(label: string, value: T, set: (v: T) => void, items: { id: T; label: string }[]) => <div className="ob-lab-group"><span className="ob-lab-label">{label}</span><div className="ob-lab-options" role="group" aria-label={label}>{items.map((o) => <button key={String(o.id)} type="button" aria-pressed={o.id === value} onClick={() => set(o.id)}>{o.label}</button>)}</div></div>;
  return <div>
    <div className="ob-lab-bar" style={{ position: "relative" }}>
      <div className="ob-lab-group"><span className="ob-lab-label">Card design</span><div className="ob-lab-options" role="group" aria-label="Card design">{DESIGNS.map((d) => <button key={d.id} type="button" aria-pressed={d.id === design} onClick={() => setDesign(d.id)}>{d.label}<small>{d.note}</small></button>)}</div></div>
      {opt("Benchmark mix", mix, setMix, [{ id: "bars", label: "Strip + text" }, { id: "text", label: "Text only" }])}
      {opt("X link", xStyle, setXStyle, [{ id: "icon", label: "Icon by name" }, { id: "chip", label: "@handle chip" }])}
      {opt("Bar scale", zoom ? "zoom" : "zero", (v) => setZoom(v === "zoom"), [{ id: "zero", label: "From zero (0-100)" }, { id: "zoom", label: "Zoomed to the top 3" }])}
      {opt("Site mode", mode, setMode, [{ id: "system", label: "System" }, { id: "light", label: "Light" }, { id: "dark", label: "Dark" }])}
      {opt("Columns", cols, setCols, [{ id: 3, label: "3" }, { id: 2, label: "2" }])}
    </div>
    <div className="xl-page">
      <h1 className="text-[36px] leading-tight">Explore</h1>
      <p className="text-ink-2 text-[14px] mt-1 mb-2">Rankings people have built and published. Open one to see the full page and every chart, or start from it and make it yours.</p>
      <p className="cap mb-8">Lab: real published pages plus a few samples. X links are made up from each handle (the page data has none yet), and the last of every four cards has none.</p>
      <ul className="xl-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {cards.map((c) => { const look = lookOf(c, dark); return <li key={c.handle} className="xl-card" style={look.style} data-theme-preset={look.preset.id}>
          <a className="xl-stretch" href="#" onClick={(e) => e.preventDefault()} aria-label={`Open ${c.name}'s page`} />
          <Head c={c} xStyle={xStyle} size={design === "spotlight" ? 40 : 36} />
          <div className="xl-index">{c.index}</div>
          {c.more > 0 && <p className="cap xl-also">Also {c.others.join(", ")}{c.more > c.others.length ? ` and ${c.more - c.others.length} more` : ""}</p>}
          <Models c={c} design={design} zoom={zoom} colorOf={look.color} />
          <Mix c={c} mode={mix} />
          <div className="xl-foot"><a href="#" onClick={(e) => e.preventDefault()}>Start from this</a></div>
        </li>; })}
      </ul>
    </div>
  </div>;
}
