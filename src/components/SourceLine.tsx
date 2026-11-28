"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { Snapshot } from "@/data/types";
import type { IndexConfig } from "@/engine";
import { latestAAIndex } from "@/data/aa-index";
import { benchmarkPath } from "@/lib/benchmark-slug";
import { isAAWeights } from "@/lib/default-index";
import { ago, exactTime, oldestFetch, shortTime, sourcesFor, STALE_AFTER } from "@/lib/freshness";
import { useNow } from "@/lib/use-now";
import { useDismiss, useKeepOnScreen } from "./use-popover";
import "./source-line.css";

const SOURCE_NAMES: Record<string, string> = { aa: "Artificial Analysis", openrouter: "OpenRouter" };

/** What a mix is scored from and how old that is: the sources, the oldest scrape, and the clock. */
function useFreshness(snapshot: Snapshot, config: IndexConfig) {
  const at = useMemo(() => oldestFetch(snapshot, config), [snapshot, config]);
  const runs = useMemo(() => sourcesFor(snapshot, config), [snapshot, config]);
  const now = useNow();
  return { at, runs, now, ready: now > 0, stale: now - at > STALE_AFTER, failed: new Set(runs.filter((r) => r.status === "failed" || r.error).map((r) => r.sourceId)) };
}

/** The list behind the stamp: each source and when it was last fetched. */
function SourceList({ snapshot, config }: { snapshot: Snapshot; config: IndexConfig }) {
  const f = useFreshness(snapshot, config), shown = f.runs.slice(0, 6);
  return <>
    {f.stale && !f.failed.size && <p className="source-note">Older than usual</p>}
    {shown.map((r) => <div key={r.sourceId} className="source-row" role={f.failed.has(r.sourceId) ? "alert" : undefined}>
      <span className="source-name">
        {SOURCE_NAMES[r.sourceId] ?? r.sourceId}
        {f.failed.has(r.sourceId) && <span className="source-note">Refresh failed, showing earlier scores</span>}
      </span>
      <time className="num source-time" dateTime={r.fetchedAt} title={ago(f.now - Date.parse(r.fetchedAt), Date.parse(r.fetchedAt))}>{shortTime(Date.parse(r.fetchedAt))}</time>
    </div>)}
    {f.runs.length > 6 && <p className="cap">+{f.runs.length - 6} more</p>}
    {!f.runs.length && <div className="source-row"><span className="source-name">Snapshot</span><time className="num source-time" dateTime={new Date(f.at).toISOString()}>{shortTime(f.at)}</time></div>}
  </>;
}

/** "updated 15 h ago": when Priors last checked the sources. The button opens the list behind it. Old data reads in ink and says so in its name, not by colour alone. */
function Stamp({ snapshot, config }: { snapshot: Snapshot; config: IndexConfig }) {
  const f = useFreshness(snapshot, config), [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null), btn = useRef<HTMLButtonElement>(null), pop = useRef<HTMLDivElement>(null);
  useDismiss(open, [box], () => setOpen(false), () => btn.current?.focus());
  useKeepOnScreen(open, pop);
  const label = ago(f.now - f.at, f.at);
  return <span ref={box} className="source-host">
    <button ref={btn} type="button" className={`source-stamp hit${f.stale ? " is-old" : ""}`} aria-expanded={open} aria-haspopup="dialog" aria-label={f.ready ? `Updated ${label}${f.stale ? ", older than usual" : ""}. Sources` : "Sources"} title={f.ready ? `${exactTime(f.at)}${f.stale ? ", older than usual" : ""}` : undefined} onClick={() => setOpen(!open)}>
      {/* The clock is read after hydration, so the server's HTML and the first client render agree; the placeholder keeps the line's width. */}
      {f.ready ? <time dateTime={new Date(f.at).toISOString()}>updated {label}</time> : <span style={{ visibility: "hidden" }}>updated 14 min ago</span>}
    </button>
    {open && <div ref={pop} role="dialog" aria-label="Sources" className="source-pop"><SourceList snapshot={snapshot} config={config} /></div>}
  </span>;
}

/** "Artificial Analysis, updated 15 h ago": the credit (AA's own mix) or the benchmark count (yours), then the stamp. */
export function SourceLine({ snapshot, config }: { snapshot: Snapshot; config: IndexConfig }) {
  const n = Object.values(config.weights).filter((w) => w > 0).length;
  if (!n) return <div className="source-line">No benchmarks</div>;
  return <div className="source-line">
    {isAAWeights(config)
      ? <span className="source-credit"><Link href={benchmarkPath(latestAAIndex(snapshot)?.id ?? "") as "/"} className="source-link hit" transitionTypes={["nav-forward"]}>Artificial Analysis</Link></span>
      : <span className="source-credit">{n} benchmark{n === 1 ? "" : "s"}</span>}, <Stamp snapshot={snapshot} config={config} />
  </div>;
}
