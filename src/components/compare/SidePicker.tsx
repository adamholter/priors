"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { IndexConfig } from "@/engine";
import { parsePasted } from "@/lib/compare-ref";
import { useLightDismiss } from "@/lib/useLightDismiss";
import { choiceFromIndex, choiceFromPage, type Choice, type PageData, type Published } from "./choice";

/** Everything a side can be set to besides a published page: the visitor's own rankings and a few starting points. */
export interface Sources {
  /** The signed-in visitor's published page. */
  page?: PageData;
  /** Indices in the visitor's builder. */
  builder: IndexConfig[];
  presets: Choice[];
  published: Published[];
  loadPage: (handle: string) => Promise<PageData | null>;
}

const Avatar = ({ src, name, size = 28 }: { src?: string; name: string; size?: number }) => src
  // eslint-disable-next-line @next/next/no-img-element
  ? <img src={src} alt="" width={size} height={size} className="cmp-avatar" style={{ width: size, height: size }} />
  : <span aria-hidden="true" className="cmp-avatar cmp-avatar-ph" style={{ width: size, height: size }}>{name.slice(0, 1).toUpperCase()}</span>;

/** One side's card. It is also the control: it opens a list of rankings to switch to. */
export function SidePicker({ tone, value, sources, onPick, label }: { tone: "a" | "b"; value?: Choice; sources: Sources; onPick: (c: Choice) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useLightDismiss(root, close);
  return <div ref={root} className="cmp-side" data-tone={tone}>
    <button type="button" className="cmp-card" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)} aria-label={`${label}: ${value ? `${value.title}, ${value.sub}` : "choose a ranking"}. Change`}>
      {value ? <>
        <Avatar src={value.avatarUrl} name={value.title} size={36} />
        <span className="cmp-card-text"><span className="cmp-card-title">{value.title}</span><span className="cap cmp-card-sub">{value.handle ? `@${value.handle} · ` : ""}{value.sub}</span></span>
      </> : <span className="cmp-card-text"><span className="cmp-card-title cmp-card-empty">Choose a ranking</span><span className="cap">Yours, a friend&apos;s or any link</span></span>}
      <svg className="cmp-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    {open && <Menu value={value} sources={sources} onPick={(c) => { onPick(c); setOpen(false); }} />}
  </div>;
}

function Menu({ value, sources, onPick }: { value?: Choice; sources: Sources; onPick: (c: Choice) => void }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState<PageData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  const open = async (handle: string, tab?: string) => {
    setBusy(handle); setError("");
    try {
      const data = await sources.loadPage(handle);
      if (!data || !data.indices.length) { setError(`No published page for @${handle}.`); return; }
      if (data.indices.length > 1 && tab === undefined) { setPage(data); return; }
      const c = choiceFromPage(data, tab); if (c) onPick(c);
    } catch { setError("Could not load that page."); } finally { setBusy(null); }
  };
  const query = q.trim().toLowerCase();
  const pasted = query ? parsePasted(q) : undefined;
  const match = (...s: (string | undefined)[]) => !query || s.some((x) => x?.toLowerCase().includes(query));
  const mine = sources.page, you = (config: IndexConfig) => choiceFromIndex(config, { title: "You", short: "you", mine: true });
  const published = sources.published.filter((p) => p.handle !== mine?.handle && match(p.handle, p.displayName, p.indexName));
  const presets = sources.presets.filter((p) => match(p.title));
  const builder = sources.builder.filter((c) => match(c.name, "you", "mine", "builder"));
  const pageRows = mine ? mine.indices.filter((c) => match(c.name, "you", mine.displayName, mine.handle)) : [];
  if (page) return <div className="cmp-menu" role="dialog" aria-label={`${page.displayName}'s rankings`}>
    <div className="cmp-menu-head"><button type="button" className="cmp-back" onClick={() => setPage(null)}>← Back</button><span className="cap">{page.displayName}&apos;s rankings</span></div>
    <ul className="cmp-menu-list">{page.indices.map((c, i) => <li key={c.id}><button type="button" className="cmp-opt" onClick={() => { const choice = choiceFromPage(page, i === 0 ? undefined : c.id); if (choice) onPick(choice); }}><span className="cmp-opt-text"><span>{c.name}</span>{i === 0 && <span className="cap">Main</span>}</span></button></li>)}</ul>
  </div>;
  return <div className="cmp-menu" role="dialog" aria-label="Choose a ranking">
    <input ref={input} className="inp cmp-search" value={q} onChange={(e) => { setQ(e.target.value); setError(""); }} placeholder="Search people, or paste a link" aria-label="Search people, or paste a link"
      onKeyDown={(e) => { if (e.key === "Enter" && pasted) { e.preventDefault(); if (pasted.kind === "page") void open(pasted.handle, pasted.tab); else if (pasted.kind === "index") onPick(choiceFromIndex(pasted.config)); } }} />
    {error && <p className="cap cmp-error" role="alert">{error}</p>}
    <div className="cmp-menu-scroll">
      {pasted && <Group title="From the link"><Opt disabled={busy != null} onClick={() => pasted.kind === "page" ? void open(pasted.handle, pasted.tab) : pasted.kind === "index" ? onPick(choiceFromIndex(pasted.config)) : undefined} title={pasted.kind === "page" ? `@${pasted.handle}` : pasted.kind === "index" ? pasted.config.name : "Yours"} sub={pasted.kind === "page" ? "Published page" : "Index in the link"} /></Group>}
      {(pageRows.length > 0 || builder.length > 0) && <Group title="Yours">
        {pageRows.map((c, i) => <Opt key={c.id} on={value?.mine && value.config.id === c.id} onClick={() => { const choice = choiceFromPage(mine!, i === 0 ? undefined : c.id, true); if (choice) onPick(choice); }} title={c.name} sub={`Your page${i === 0 ? ", main" : ""}`} avatar={<Avatar src={mine!.avatarUrl} name={mine!.displayName} />} />)}
        {builder.map((c) => <Opt key={c.id} on={value?.mine && value.config.name === c.name && !value.handle} onClick={() => onPick(you(c))} title={c.name} sub="In your builder" avatar={<Avatar name="Y" />} />)}
      </Group>}
      {!mine && builder.length === 0 && !query && <div className="cmp-group"><p className="cmp-note">You have no ranking yet.</p><Link href="/rank" className="btn cmp-rank-cta">Rank models · 1 min</Link></div>}
      {published.length > 0 && <Group title="Published">
        {published.map((p) => <Opt key={p.handle} disabled={busy != null} on={value?.handle === p.handle} onClick={() => void open(p.handle)} title={p.displayName} sub={`@${p.handle} · ${p.indexName}`} avatar={<Avatar src={p.avatarUrl} name={p.displayName} />} busy={busy === p.handle} />)}
      </Group>}
      {presets.length > 0 && <Group title="Starting points">
        {presets.map((p) => <Opt key={p.title} on={value?.ref.kind === "preset" && value.title === p.title} onClick={() => onPick(p)} title={p.title} sub="Preset mix" avatar={<Avatar name={p.title} />} />)}
      </Group>}
      {query && !pasted && !published.length && !presets.length && !builder.length && !pageRows.length && <p className="cmp-note">Nothing matches. Paste a mypriors.com link to compare any ranking.</p>}
    </div>
  </div>;
}

const Group = ({ title, children }: { title: string; children: React.ReactNode }) => <div className="cmp-group"><div className="cap cmp-group-title">{title}</div><ul className="cmp-menu-list">{children}</ul></div>;
const Opt = ({ title, sub, avatar, onClick, on, disabled, busy }: { title: string; sub: string; avatar?: React.ReactNode; onClick?: () => void; on?: boolean; disabled?: boolean; busy?: boolean }) =>
  <li><button type="button" className="cmp-opt" aria-current={on || undefined} disabled={disabled} onClick={onClick}>{avatar}<span className="cmp-opt-text"><span>{title}</span><span className="cap">{busy ? "Loading…" : sub}</span></span>{on && <span className="cap cmp-on">Selected</span>}</button></li>;
