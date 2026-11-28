"use client";
import Link from "next/link";
import { memo, useMemo, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { IconArrowsLeftRight, IconBrandX, IconStack2, IconUser } from "@tabler/icons-react";
import { LabLogo } from "@/components/LabLogo";
import { useTheme } from "@/components/Theme";
import { track } from "@/lib/analytics";
import { avatarSrc } from "@/lib/avatar";
import type { ExploreCardData, ExploreLead, ExploreMixPart, FeaturedMixData } from "@/lib/explore-cards";
import { mixSegments, plural, pct } from "@/lib/explore-find";
import { presetStyle, resolveAccent, resolvePreset } from "@/lib/page-presets";
import "./explore-card.css";

const effortOf = (m: ExploreLead) => (m.effort === "default" ? "" : m.effort);

/** Arrow keys walk a row of small buttons that share one tab stop. */
function rove(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  const btns = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button")), i = btns.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0) return;
  e.preventDefault();
  btns[(i + (e.key === "ArrowRight" ? 1 : -1) + btns.length) % btns.length]?.focus();
}

/** A card wears its owner's page theme: Priors Light and Dark pages (and the paired Analysis and Slop) follow the visitor's mode unless the owner fixed one; single-mode themes stay as picked. */
function useCardTheme(theme: ExploreCardData["theme"]) {
  const { dark } = useTheme();
  return useMemo(() => { const preset = resolvePreset(theme, dark); return { id: preset.id, dark: preset.dark, style: presetStyle(preset, resolveAccent(theme, preset)) as CSSProperties }; }, [theme, dark]);
}

function Shell({ href, label, theme, className = "", children }: { href: string; label: string; theme: ExploreCardData["theme"]; className?: string; children: ReactNode }) {
  const t = useCardTheme(theme);
  return <li className={`ex-card ${className}`} style={t.style} data-theme-preset={t.id} data-card-dark={t.dark ? "" : undefined}>
    <Link className="ex-stretch" href={href as "/"} prefetch={false} aria-label={label} />
    {children}
  </li>;
}

/** The top three: rank, lab logo, full name, effort and score. The number carries the gap: close scores would draw as three equal bars. */
function Rows({ leads }: { leads: ExploreLead[] }) {
  return <ol className="ex-rows">{leads.map((m, i) => <li key={m.id} className="ex-row">
    <span className="cap">{i + 1}</span>
    <LabLogo lab={m.lab} name={m.labName} color={m.base} size={16} />
    <span className="ex-row-name" title={`${m.name} ${effortOf(m)}`.trim()}><span>{m.name}</span>{effortOf(m) && <span className="cap">{effortOf(m)}</span>}</span>
    <span className="num ex-row-score">{m.score.toFixed(1)}</span>
  </li>)}</ol>;
}

function IndexName({ c }: { c: ExploreCardData }) {
  const also = c.more > 0 ? `Also ${c.others.join(", ")}${c.more > c.others.length ? ` and ${c.more - c.others.length} more` : ""}` : "";
  return <div className="ex-index-row">
    <div className="ex-index" title={c.index}>{c.index}</div>
    {c.more > 0 && <span className="cap ex-tabs" title={also} role="img" aria-label={also}><IconStack2 size={14} stroke={1.5} aria-hidden />+{c.more}</span>}
  </div>;
}

/**
 * The stacked weight bar and its caption: one segment per heavy benchmark. Hover, focus or tap a segment and the caption names it; nothing overlays the card.
 * `children` receives the caption when the caller places it itself (in a footer row). `via` is the benchmark a search matched.
 */
function MixBar({ parts, via, children }: { parts: ExploreMixPart[]; via?: ExploreMixPart; children?: (caption: string) => ReactNode }) {
  const segs = useMemo(() => mixSegments(parts), [parts]);
  const [hot, setHot] = useState<number | null>(null);
  const at = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect(), x = e.clientX - r.left, total = segs.reduce((t, s) => t + s.share, 0) || 1;
    let acc = 0;
    for (let i = 0; i < segs.length; i++) { acc += (segs[i].share / total) * r.width; if (x <= acc) return i; }
    return segs.length - 1;
  };
  const caption = hot != null && segs[hot] ? segs[hot].label : via ? `${via.name} ${pct(via.share)}` : plural(parts.length, "benchmark");
  return <div className="ex-mix">
    <div className="ex-mixbar" style={{ height: 8 }} onPointerMove={(e) => e.pointerType === "mouse" && setHot(at(e))} onPointerDown={(e) => setHot(at(e))} onPointerLeave={(e) => e.pointerType === "mouse" && setHot(null)} role="group" aria-label="Benchmark weights" onKeyDown={rove}>
      {segs.map((s, i) => <button key={i} type="button" className={`ex-seg${s.tone < 0 ? " ex-seg-rest" : ""}`} data-on={hot === i || undefined} tabIndex={i === 0 ? 0 : -1} aria-label={s.label} style={{ flexGrow: Math.max(s.share, 0.8), background: s.tone < 0 ? "var(--hair-3)" : `color-mix(in srgb, var(--indigo) ${Math.round(s.tone * 100)}%, transparent)` }} onFocus={() => setHot(i)} onBlur={() => setHot(null)} />)}
    </div>
    {children ? children(caption) : <p className="cap ex-mixcap" title={caption}>{caption}</p>}
  </div>;
}

/** A starting point on Explore: a ranking anyone can open in the builder and change. */
export function FeaturedMixCard({ c }: { c: FeaturedMixData }) {
  return <Shell href={c.href} label={`Open ${c.name} in the builder`} theme={undefined}>
    <div className="ex-index-row"><div className="ex-index" title={c.name}>{c.name}</div></div>
    <Rows leads={c.podium} />
    <MixBar parts={c.mix} />
  </Shell>;
}

/** A published page on Explore: who and when, its title, the top three, and its mix as one bar with Compare and Remix beside the caption. */
export const ExploreCard = memo(function ExploreCard({ c, via }: { c: ExploreCardData; via?: ExploreMixPart }) {
  return <Shell href={c.pageHref} label={`Open ${c.name}'s page`} theme={c.theme}>
    <div className="ex-head">
      {c.avatarUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={avatarSrc(c.avatarUrl, 36)} alt="" width={36} height={36} loading="lazy" decoding="async" className="ex-avatar" style={{ width: 36, height: 36 }} />
        : <span aria-hidden="true" className="ex-avatar ex-avatar-ph" style={{ width: 36, height: 36 }}><IconUser size={19} stroke={1.5} /></span>}
      <div className="ex-who"><div className="ex-name" title={c.name}>{c.name}</div><div className="cap ex-sub" title={`@${c.handle}`}><span className="ex-sub-handle">@{c.handle}</span><span className="ex-sub-when">· {c.when}</span></div></div>
      {c.x && <a className="ex-x hit" href={`https://x.com/${c.x}`} target="_blank" rel="noreferrer" onClick={() => track("explore_x_clicked", { handle: c.handle })} aria-label={`${c.name} on X`} title={`@${c.x} on X`}><IconBrandX size={14} stroke={1.5} aria-hidden /></a>}
    </div>
    <IndexName c={c} />
    {c.kind === "dead" ? <p className="cap ex-dead">Not ranked on today&apos;s data</p> : <>
      <Rows leads={c.podium} />
      <MixBar parts={c.mix} via={via}>{(cap) => <div className="ex-foot">
        <p className="cap ex-footcap" title={cap}>{cap}</p>
        <Link className="ex-ico hit" href={c.compareHref as "/compare"} prefetch={false} onClick={() => track("compare_opened", { from: "explore", handle: c.handle })} aria-label={`Compare with @${c.handle}`} title={`Compare your ranking with @${c.handle}'s`}><IconArrowsLeftRight size={16} stroke={1.5} aria-hidden /></Link>
        <Link className="ex-remix hit" href={c.remixHref as "/builder"} prefetch={false} onClick={() => track("remix_clicked", { from: "explore", handle: c.handle })} aria-label={`Remix @${c.handle}`} title={`Open @${c.handle}'s mix in the builder as your own copy`}>Remix</Link>
      </div>}</MixBar>
    </>}
  </Shell>;
});
