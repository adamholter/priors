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
type Action = "footer" | "split" | "hover" | "title" | "icon";
const ACTIONS: { id: Action; label: string; note: string }[] = [
  { id: "footer", label: "A · Footer link", note: "Today, with an arrow" },
  { id: "split", label: "B · Split footer", note: "View page | Use as mine" },
  { id: "hover", label: "C · On hover", note: "Pill over the chart" },
  { id: "title", label: "D · Next to the title", note: "Small fork button" },
  { id: "icon", label: "E · Icon in the header", note: "Icon-only, with tooltip" },
];
const LABELS = ["Start from this", "Remix", "Use as mine", "Copy to builder"];

const Icon = ({ d, size = 14 }: { d: string; size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
const FORK = "M6 3v6a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3v6M6 3a2 2 0 1 0 0 .01M18 21a2 2 0 1 0 0-.01M6 21a2 2 0 1 0 0-.01M6 9v12";
const ARROW = "M5 12h14M13 6l6 6-6 6";
const OPEN = "M14 4h6v6M20 4l-8 8M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4";
const XLogo = ({ size = 12 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>;
const Avatar = ({ c, size = 36 }: { c: LabCard; size?: number }) => c.avatarUrl
  // eslint-disable-next-line @next/next/no-img-element
  ? <img src={c.avatarUrl} alt="" width={size} height={size} className="xl-avatar" style={{ width: size, height: size }} />
  : <span aria-hidden="true" className="xl-avatar xl-avatar-ph" style={{ width: size, height: size }}>{c.name.slice(0, 1).toUpperCase()}</span>;

function XLink({ c, style }: { c: LabCard; style: "icon" | "chip" }) {
  if (!c.x) return null;
  return <a className={style === "chip" ? "xl-x xl-x-chip" : "xl-x"} href={`https://x.com/${c.x}`} target="_blank" rel="noreferrer" aria-label={`${c.name} on X`} title={`@${c.x} on X`}><XLogo size={style === "chip" ? 11 : 13} />{style === "chip" && <span>@{c.x}</span>}</a>;
}

function Head({ c, xStyle, size, extra }: { c: LabCard; xStyle: "icon" | "chip"; size?: number; extra?: React.ReactNode }) {
  return <div className="xl-head">
    <Avatar c={c} size={size} />
    <div className="xl-who">
      <div className="xl-name"><span>{c.name}</span>{xStyle === "icon" && <XLink c={c} style="icon" />}</div>
      <div className="cap xl-sub">@{c.handle} · {c.when}</div>
    </div>
    {xStyle === "chip" && <span className="xl-chip-slot"><XLink c={c} style="chip" /></span>}
    {extra}
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

function Models({ c: card, zoom, colorOf }: { c: LabCard; zoom: boolean; colorOf: (m: LabCard["top"][number]) => string }) {
  const c = { ...card, top: card.top.map((m) => ({ ...m, color: colorOf(m) })) };
  const lead = c.top[0]?.score || 1, low = c.top[c.top.length - 1]?.score ?? lead, floor = lead - Math.max(10, (lead - low) * 2);
  const frac = (v: number) => (zoom ? Math.max(0.12, (v - floor) / (lead - floor || 1)) : v / 100);
  if (!c.top.length) return <p className="cap">No ranked models on today&apos;s data.</p>;
  return <div className="xl-cols">{c.top.map((m, i) => <div key={m.name} className="xl-col">
    <span className="num xl-col-score">{m.score.toFixed(1)}</span>
    <div className="xl-col-bar"><b style={{ height: `${Math.max(14, frac(m.score) * 100)}%`, background: m.color, opacity: i === 0 ? 1 : 0.55 }} /></div>
    <span className="xl-col-name" title={m.name}><span className="cap">{i + 1}</span> {m.name}</span></div>)}</div>;
}

/** The card wears its owner's page theme: resolved for the viewer's light/dark unless the owner fixed a mode. */
function lookOf(c: LabCard, dark: boolean) {
  const preset = resolvePreset(c.theme, dark), pal = paletteFor(preset);
  return { preset, style: presetStyle(preset, resolveAccent(c.theme, preset)) as CSSProperties, color: (m: LabCard["top"][number]) => markColor(m.base, pal, m.labId) };
}

export function ExploreLab({ cards }: { cards: LabCard[] }) {
  const { dark, mode, setMode } = useTheme();
  const [action, setAction] = useState<Action>("footer");
  const [label, setLabel] = useState(LABELS[0]);
  const opt = <T extends string | number>(name: string, value: T, set: (v: T) => void, items: { id: T; label: string; note?: string }[]) => <div className="ob-lab-group"><span className="ob-lab-label">{name}</span><div className="ob-lab-options" role="group" aria-label={name}>{items.map((o) => <button key={String(o.id)} type="button" aria-pressed={o.id === value} onClick={() => set(o.id)}>{o.label}{o.note && <small>{o.note}</small>}</button>)}</div></div>;
  const go = (e: React.MouseEvent) => e.preventDefault();
  return <div>
    <div className="ob-lab-bar" style={{ position: "relative" }}>
      {opt("Start from this", action, setAction, ACTIONS.map((a) => ({ id: a.id, label: a.label, note: a.note })))}
      {opt("Wording", label, setLabel, LABELS.map((l) => ({ id: l, label: l })))}
      {opt("Site mode", mode, setMode, [{ id: "system", label: "System" }, { id: "light", label: "Light" }, { id: "dark", label: "Dark" }])}
    </div>
    <div className="xl-page">
      <h1 className="text-[36px] leading-tight">Explore</h1>
      <p className="text-ink-2 text-[14px] mt-1 mb-2">Rankings people have built and published. Open one to see the full page and every chart, or start from it and make it yours.</p>
      <p className="cap mb-8">Lab: the chosen card (podium columns, text mix, @handle chip, zoomed bars, 3 across). Now deciding how the secondary action reads. Real published pages plus samples; X links are made up.</p>
      <ul className="xl-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        {cards.map((c) => { const look = lookOf(c, dark);
          const btn = (cls: string, icon: string, text: string | null, tip?: string) => <a href="#" onClick={go} className={cls} title={tip ?? label} aria-label={tip ?? label}><Icon d={icon} />{text && <span>{text}</span>}</a>;
          return <li key={c.handle} className={`xl-card xl-act-${action}`} style={look.style} data-theme-preset={look.preset.id}>
            <a className="xl-stretch" href="#" onClick={go} aria-label={`Open ${c.name}'s page`} />
            <Head c={c} xStyle="chip" size={36} extra={action === "icon" ? btn("xl-iconbtn", FORK, null, `${label}: open this mix in the builder as your own copy`) : undefined} />
            <div className="xl-titlerow"><div className="xl-index">{c.index}</div>{action === "title" && btn("xl-ghost", FORK, label)}</div>
            {c.more > 0 && <p className="cap xl-also">Also {c.others.join(", ")}{c.more > c.others.length ? ` and ${c.more - c.others.length} more` : ""}</p>}
            <div className="xl-modelswrap"><Models c={c} zoom colorOf={look.color} />{action === "hover" && btn("xl-hoverpill", FORK, label)}</div>
            <Mix c={c} mode="text" />
            {action === "footer" && <div className="xl-foot"><a href="#" onClick={go}>{label} <Icon d={ARROW} size={12} /></a></div>}
            {action === "split" && <div className="xl-foot xl-foot-split"><a href="#" onClick={go}><Icon d={OPEN} size={13} />View page</a><a href="#" onClick={go}><Icon d={FORK} size={13} />{label}</a></div>}
            {(action === "hover" || action === "title" || action === "icon") && <div className="xl-foot-pad" />}
          </li>; })}
      </ul>
    </div>
  </div>;
}
