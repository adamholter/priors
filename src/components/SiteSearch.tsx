"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentType } from "react";
import {
  IconArrowBackUp, IconArrowsLeftRight, IconArrowsSort, IconBox, IconChartBar, IconCoin, IconCompass, IconCube, IconHeart, IconListCheck, IconLock,
  IconMathFunction, IconMessageReport, IconMoon, IconScale, IconSearch, IconSparkles, IconSun, IconTerminal2, IconTimeline, IconTool, IconTrophy, IconUpload,
} from "@tabler/icons-react";
import { useTheme } from "./Theme";
import { benchmarkPath } from "@/lib/benchmark-slug";
import { track } from "@/lib/analytics";

/**
 * The header's universal search (from Faye Quepeerzade's header mockups, November 2026): one box for models, benchmarks, pages and a few
 * actions. Every header's trigger opens the one palette the root layout mounts (`SiteSearchHost`), as do ⌘K and Ctrl+K anywhere.
 * Models and benchmarks come from /api/search, fetched the first time the palette opens.
 */
const OPEN = "priors:search";
export const openSiteSearch = () => window.dispatchEvent(new Event(OPEN));

type Icon = ComponentType<{ size?: number; stroke?: number; className?: string; "aria-hidden"?: boolean | "true" }>;
interface Hit { key: string; group: "Models" | "Benchmarks" | "Pages" | "Actions"; label: string; meta?: string; icon: Icon; run: () => void }
interface Index { models: { id: string; name: string; lab: string; rank?: number; score?: number; old?: true; aka: string[] }[]; benchmarks: { id: string; name: string; short?: string; category: string }[] }

const PAGES: { href: string; label: string; icon: Icon; aka?: string }[] = [
  { href: "/builder", label: "Data", icon: IconChartBar, aka: "rankings charts" }, { href: "/models", label: "Models", icon: IconCube }, { href: "/benchmarks", label: "Benchmarks", icon: IconListCheck },
  { href: "/explore", label: "Explore", icon: IconCompass, aka: "published rankings" }, { href: "/rank", label: "Rank models", icon: IconArrowsSort, aka: "new mix priors" },
  { href: "/subsidies", label: "Plan subsidies", icon: IconCoin, aka: "subscription price" }, { href: "/history", label: "Rankings through time", icon: IconTimeline, aka: "history" },
  { href: "/compare", label: "Compare rankings", icon: IconArrowsLeftRight }, { href: "/model-finder", label: "Model finder", icon: IconSearch }, { href: "/priorsbench", label: "PriorsBench", icon: IconTrophy },
  { href: "/tools", label: "Tools", icon: IconTool, aka: "export api" }, { href: "/cli", label: "CLI and MCP", icon: IconTerminal2 }, { href: "/skill", label: "Agent skill", icon: IconSparkles },
  { href: "/import", label: "Import data", icon: IconUpload }, { href: "/3d", label: "3D view", icon: IconBox }, { href: "/methods/scoring", label: "How scores work", icon: IconMathFunction, aka: "methodology" },
  { href: "/benchmarks/methodology", label: "Benchmark quality", icon: IconScale }, { href: "/request", label: "Report or request", icon: IconMessageReport, aka: "bug feedback" }, { href: "/privacy", label: "Privacy", icon: IconLock },
];

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9.]+/g, " ").trim();
/** 3: the name starts with the query; 2: a word starts with it; 1: it appears; 0: no match. Every query word must match. */
function match(q: string, ...names: (string | undefined)[]): number {
  const words = norm(q).split(" ").filter(Boolean);
  if (!words.length) return 0;
  let best = 0;
  for (const raw of names) {
    if (!raw) continue;
    const n = norm(raw), compact = n.replace(/ /g, "");
    if (!words.every((w) => n.includes(w) || compact.includes(w))) continue;
    best = Math.max(best, n.startsWith(words[0]) || compact.startsWith(words.join("")) ? 3 : ` ${n}`.includes(` ${words[0]}`) ? 2 : 1);
  }
  return best;
}

/** The trigger in every header: a search field on wide screens, an icon below that. */
export function SiteSearchButton({ wide = false }: { wide?: boolean }) {
  const mac = useSyncExternalStore(() => () => {}, () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent), () => true);
  if (!wide) return <button type="button" onClick={openSiteSearch} aria-label="Search models, benchmarks and pages" title={`Search (${mac ? "⌘" : "Ctrl+"}K)`}
    className="icon-btn inline-flex items-center justify-center"><IconSearch size={18} stroke={1.6} aria-hidden="true" /></button>;
  return <button type="button" onClick={openSiteSearch} aria-label="Search models, benchmarks and pages"
    className="site-search-trigger inline-flex items-center gap-2 h-8 w-full pl-2.5 pr-1.5 rounded-md border hairline bg-white text-[13px] text-grey hover:border-ink">
    <IconSearch size={15} stroke={1.75} aria-hidden="true" /><span className="flex-1 min-w-0 text-left truncate">Search models, benchmarks, pages</span>
    <kbd className="cap px-1.5 py-0.5 rounded border hairline">{mac ? "⌘K" : "Ctrl K"}</kbd>
  </button>;
}

/** The palette, mounted once by the root layout. */
export function SiteSearchHost() {
  const router = useRouter(), { dark, setMode } = useTheme();
  const [open, setOpen] = useState(false), [q, setQ] = useState(""), [at, setAt] = useState(0), [index, setIndex] = useState<Index | null>(null), [failed, setFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null), list = useRef<HTMLDivElement>(null), loading = useRef(false);
  useEffect(() => {
    const show = () => { setOpen(true); setQ(""); setAt(0); };
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => { if (!o) { setQ(""); setAt(0); } return !o; }); } };
    window.addEventListener(OPEN, show); window.addEventListener("keydown", key);
    return () => { window.removeEventListener(OPEN, show); window.removeEventListener("keydown", key); };
  }, []);
  useEffect(() => {
    if (!open) return;
    track("site_search_opened", {});
    requestAnimationFrame(() => input.current?.focus());
    if (index || loading.current) return;
    loading.current = true;
    fetch("/api/search").then((r) => (r.ok ? r.json() : Promise.reject(r.status))).then((d: Index) => setIndex(d)).catch(() => setFailed(true)).finally(() => { loading.current = false; });
  }, [open, index]);
  const go = (href: string) => () => { setOpen(false); router.push(href as "/"); };
  const hits = useMemo((): Hit[] => {
    const query = q.trim(), out: Hit[] = [];
    const ranked = <T,>(items: T[], score: (x: T) => number, tie: (a: T, b: T) => number) => items.map((x) => [x, score(x)] as const).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1] || tie(a[0], b[0])).map(([x]) => x);
    const models = index ? (query ? ranked(index.models, (m) => match(query, m.name, ...m.aka), (a, b) => (a.old ? 1 : 0) - (b.old ? 1 : 0) || (a.rank ?? 1e4) - (b.rank ?? 1e4)) : index.models.filter((m) => m.rank).sort((a, b) => a.rank! - b.rank!)).slice(0, query ? 6 : 4) : [];
    for (const m of models) out.push({ key: `m:${m.id}`, group: "Models", label: m.name, meta: m.score != null ? m.score.toFixed(1) : m.lab, icon: IconCube, run: go(`/models/${m.id}`) });
    if (index && query) for (const b of ranked(index.benchmarks, (b) => match(query, b.name, b.short, b.id), (a, b) => a.name.length - b.name.length).slice(0, 5)) out.push({ key: `b:${b.id}`, group: "Benchmarks", label: b.name, meta: b.category, icon: IconChartBar, run: go(benchmarkPath(b.id)) });
    for (const p of (query ? ranked(PAGES, (p) => match(query, p.label, p.aka), () => 0) : PAGES.slice(0, 5)).slice(0, query ? 4 : 5)) out.push({ key: `p:${p.href}`, group: "Pages", label: p.label, icon: p.icon, run: go(p.href) });
    const actions: Hit[] = [
      { key: "a:theme", group: "Actions", label: dark ? "Switch to light mode" : "Switch to dark mode", icon: dark ? IconSun : IconMoon, run: () => { setMode(dark ? "light" : "dark"); setOpen(false); } },
      { key: "a:support", group: "Actions", label: "Support Priors", icon: IconHeart, run: () => { track("support_clicked", { from: "search" }); go("/support")(); } },
      { key: "a:report", group: "Actions", label: "Report a bug or request a benchmark", icon: IconMessageReport, run: go("/request") },
    ];
    out.push(...(query ? actions.filter((a) => match(query, a.label, a.key === "a:theme" ? "theme dark light mode" : a.key === "a:support" ? "donate support" : "bug report request feedback")) : actions));
    return out;
  }, [q, index, dark, setMode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { list.current?.querySelector(`[data-i="${at}"]`)?.scrollIntoView({ block: "nearest" }); }, [at]);
  if (!open) return null;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setAt((i) => Math.min(hits.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAt((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter" && hits[at]) { e.preventDefault(); hits[at].run(); }
  };
  let last = "";
  return <div className="fixed inset-0 z-[90] grid justify-items-center items-start pt-[10vh] px-3 bg-[color-mix(in_srgb,var(--ink)_18%,transparent)]" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
    <div role="dialog" aria-modal="true" aria-label="Search Priors" className="site-search w-full max-w-[640px] bg-white border hairline rounded-xl shadow-[0_24px_60px_-20px_var(--shadow)] overflow-hidden" onKeyDown={onKey}>
      <div className="flex items-center gap-2.5 px-4 h-[52px] border-b hairline">
        <IconSearch size={18} stroke={1.75} aria-hidden="true" className="text-grey shrink-0" />
        <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setAt(0); }} placeholder="Search models, benchmarks, pages" aria-label="Search" role="combobox" aria-expanded="true" aria-controls="site-search-results"
          aria-activedescendant={hits[at] ? `site-search-${at}` : undefined} className="flex-1 min-w-0 bg-transparent text-[15px] text-ink placeholder:text-grey" style={{ outline: "none", boxShadow: "none" }} autoComplete="off" spellCheck={false} />
        <button type="button" className="cap px-1.5 py-0.5 rounded border hairline hover:text-ink" onClick={() => setOpen(false)}>esc</button>
      </div>
      <div ref={list} id="site-search-results" role="listbox" aria-label="Results" className="max-h-[min(60vh,460px)] overflow-y-auto p-1.5">
        {!index && !failed && <p className="cap px-3 py-2">Loading models and benchmarks…</p>}
        {failed && <p className="cap px-3 py-2">Models and benchmarks could not load; pages and actions still work.</p>}
        {q.trim() && !hits.length && <p className="text-[13px] text-ink-2 px-3 py-3">Nothing matches “{q.trim()}”.</p>}
        {hits.map((h, i) => {
          const head = h.group !== last ? (last = h.group, <p key={`g:${h.group}`} className="cap px-3 pt-2.5 pb-1">{h.group === "Models" && !q.trim() ? "Top models" : h.group}</p>) : null;
          return [head, <button key={h.key} id={`site-search-${i}`} data-i={i} type="button" role="option" aria-selected={i === at} onMouseMove={() => setAt(i)} onClick={h.run}
            className={`flex w-full items-center gap-2.5 px-3 py-2 rounded-md text-left text-[14px] ${i === at ? "bg-hair-2 text-ink" : "text-ink-2"}`}>
            <h.icon size={16} stroke={1.6} aria-hidden="true" className="shrink-0 text-grey" /><span className="flex-1 min-w-0 truncate">{h.label}</span>
            {h.meta && <span className="cap shrink-0">{h.meta}</span>}{i === at && <IconArrowBackUp size={14} stroke={1.75} aria-hidden="true" className="shrink-0 text-grey rotate-180 -scale-y-100" />}
          </button>];
        })}
      </div>
      <div className="flex items-center gap-4 px-4 py-2 border-t hairline cap"><span>↑↓ move</span><span>↵ open</span><span>esc close</span></div>
    </div>
  </div>;
}
