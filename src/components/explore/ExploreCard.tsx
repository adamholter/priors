"use client";
import Link from "next/link";
import type { CSSProperties } from "react";
import { markColor, paletteFor } from "@/components/chart/theme";
import { useTheme } from "@/components/Theme";
import { track } from "@/lib/analytics";
import { presetStyle, resolveAccent, resolvePreset } from "@/lib/page-presets";
import "./explore-card.css";

export interface ExploreCardData {
  handle: string; name: string; avatarUrl?: string; when: string; index: string; others: string[]; more: number; count: number;
  top: { name: string; score: number; labId: string; base: string }[]; mix: { name: string; share: number }[];
  theme?: { preset?: string; accent?: string; surface?: "bone" | "white"; mode?: "auto" | "fixed" };
  /** X handle, from the page's links. */ x?: string;
  pageHref: string; remixHref: string; compareHref: string;
}

const Icon = ({ d, size = 13 }: { d: string; size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
const FORK = "M6 3v6a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3v6M6 3a2 2 0 1 0 0 .01M18 21a2 2 0 1 0 0-.01M6 21a2 2 0 1 0 0-.01M6 9v12";
const COMPARE = "M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7";
const OPEN = "M14 4h6v6M20 4l-8 8M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4";

/**
 * A published page on Explore, drawn in its owner's page theme: Priors Light and Dark pages (and the
 * paired Analysis and Slop) follow the visitor's mode unless the owner fixed one; single-mode themes stay as picked.
 */
export function ExploreCard({ c }: { c: ExploreCardData }) {
  const { dark } = useTheme();
  const preset = resolvePreset(c.theme, dark), pal = paletteFor(preset);
  const style = presetStyle(preset, resolveAccent(c.theme, preset)) as CSSProperties;
  const lead = c.top[0]?.score || 1, low = c.top[c.top.length - 1]?.score ?? lead, floor = lead - Math.max(10, (lead - low) * 2);
  // Zoomed to the top three: scores sit close together, so a 0-100 bar would show no difference.
  const frac = (v: number) => Math.max(0.12, (v - floor) / (lead - floor || 1));
  return <li className="ex-card" style={style} data-theme-preset={preset.id}>
    <Link className="ex-stretch" href={c.pageHref as "/"} aria-label={`Open ${c.name}'s page`} />
    <div className="ex-head">
      {c.avatarUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={c.avatarUrl} alt="" width={36} height={36} className="ex-avatar" style={{ width: 36, height: 36 }} />
        : <span aria-hidden="true" className="ex-avatar ex-avatar-ph" style={{ width: 36, height: 36 }}>{c.name.slice(0, 1).toUpperCase()}</span>}
      <div className="ex-who"><div className="ex-name">{c.name}</div><div className="cap ex-sub">@{c.handle} · {c.when}</div></div>
      {c.x && <a className="ex-chip" href={`https://x.com/${c.x}`} target="_blank" rel="noreferrer" onClick={() => track("explore_x_clicked", { handle: c.handle })} aria-label={`${c.name} on X`}><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>@{c.x}</a>}
    </div>
    <div className="ex-index">{c.index}</div>
    {c.more > 0 && <p className="cap ex-also" title={c.others.join(", ")}>Also {c.others.join(", ")}{c.more > c.others.length ? ` and ${c.more - c.others.length} more` : ""}</p>}
    {c.top.length ? <div className="ex-cols">{c.top.map((m, i) => <div key={m.name} className="ex-col">
      <span className="num ex-col-score">{m.score.toFixed(1)}</span>
      <div className="ex-col-bar"><b style={{ height: `${Math.max(14, frac(m.score) * 100)}%`, background: markColor(m.base, pal, m.labId), opacity: i === 0 ? 1 : 0.55 }} /></div>
      <span className="ex-col-name" title={m.name}><span className="cap">{i + 1}</span> {m.name}</span>
    </div>)}</div> : <p className="cap">No ranked models on today&apos;s data.</p>}
    {c.count > 0 && <p className="cap ex-mix">{c.count} benchmark{c.count === 1 ? "" : "s"} · {c.mix.slice(0, 3).map((b) => `${b.name} ${b.share}%`).join(", ")}</p>}
    <div className="ex-foot">
      <Link href={c.pageHref as "/"}><Icon d={OPEN} />View page</Link>
      <Link href={c.compareHref as "/compare"} onClick={() => track("compare_opened", { from: "explore", handle: c.handle })} title={`Compare your ranking with @${c.handle}'s`}><Icon d={COMPARE} />Compare</Link>
      <Link href={c.remixHref as "/builder"} onClick={() => track("remix_clicked", { from: "explore", handle: c.handle })} title={`Open @${c.handle}'s mix in the builder as your own copy`}><Icon d={FORK} />Remix</Link>
    </div>
  </li>;
}
