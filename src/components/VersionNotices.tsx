"use client";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { IconX } from "@tabler/icons-react";
import { api } from "../../convex/_generated/api";
import { storableIndex } from "../../convex/validators";
import { authEnabled, convexEnabled } from "@/app/providers";
import type { Benchmark } from "@/data/types";
import type { IndexConfig } from "@/engine";
import { track } from "@/lib/analytics";
import { findNotices, noticeCopy, upgradeIndex, upgradesByIndex, type NoticeSource, type Upgrade } from "@/lib/version-notices";
import { addDismissed, readDismissed, setNoticesOn, useNoticesOn } from "@/lib/version-notices-pref";

type Upgrades = Map<string, Upgrade[]>;
/** The builder's own saved indices (keyed by name: builder ids are positional) and how to apply upgrades to its state. */
export interface BuilderNotices { indices: IndexConfig[]; apply: (upgrades: Upgrades) => void }
/** The signed-in user's page indices. `handle` limits it to that page's owner; `onApplied` mirrors a saved upgrade into the page on screen. */
export interface PageNotices { handle?: string; onApplied?: (upgrades: Upgrades) => void }
interface Mine { indices: IndexConfig[]; save: (upgrades: Upgrades) => Promise<unknown> }

/**
 * One small toast when a benchmark the visitor's own indices weight has a newer version in the snapshot.
 * The host decides what counts as the visitor's own (see Builder and IndexPage); this never runs on someone else's link.
 */
export function VersionNotices(props: { benchmarks: Benchmark[]; builder?: BuilderNotices | null; page?: PageNotices | null; hidden?: boolean }) {
  return useNoticesOn() ? <Notices {...props} /> : null;
}

function Notices({ benchmarks, builder, page, hidden }: { benchmarks: Benchmark[]; builder?: BuilderNotices | null; page?: PageNotices | null; hidden?: boolean }) {
  const probe = !!page && authEnabled && convexEnabled;
  const [mine, setMine] = useState<Mine | null | undefined>(probe ? undefined : null);
  const [dismissed, setDismissed] = useState<Set<string> | null>(null);
  useEffect(() => { const id = requestAnimationFrame(() => setDismissed(readDismissed())); return () => cancelAnimationFrame(id); }, []);
  const sources = useMemo(() => {
    const list: NoticeSource[] = [];
    if (builder?.indices.length) list.push({ scope: "builder", indices: builder.indices, keyOf: (i) => i.name });
    if (mine?.indices.length) list.push({ scope: "page", indices: mine.indices });
    return list;
  }, [builder, mine]);
  const found = useMemo(() => dismissed ? findNotices(sources, benchmarks, dismissed) : [], [sources, benchmarks, dismissed]);
  // What a source needs is fixed when it first loads: a benchmark added later in the visit never pops a notice up mid-edit.
  const [latched, setLatched] = useState<Record<string, string[]>>({});
  const unlatched = dismissed ? sources.filter((s) => !(s.scope in latched)) : [];
  if (unlatched.length) setLatched({ ...latched, ...Object.fromEntries(unlatched.map((s) => [s.scope, found.filter((i) => i.scope === s.scope).map((i) => i.key)])) });
  const items = found.filter((i) => latched[i.scope]?.includes(i.key));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  useEffect(() => { if (!done) return; const t = setTimeout(() => setDone(""), 3500); return () => clearTimeout(t); }, [done]);
  const settle = (keys: string[]) => { addDismissed(keys); setDismissed((d) => new Set([...(d ?? []), ...keys])); };
  const copy = items.length ? noticeCopy(items, benchmarks) : null;
  const upgrade = async () => {
    setBusy(true); setError("");
    try {
      const forBuilder = upgradesByIndex(items, "builder"), forPage = upgradesByIndex(items, "page");
      if (builder && forBuilder.size) builder.apply(forBuilder);
      if (mine && forPage.size) { await mine.save(forPage); page?.onApplied?.(forPage); }
      const names = [...new Set(items.map((i) => i.to))].map((id) => benchmarks.find((b) => b.id === id)?.name ?? id);
      settle(items.map((i) => i.key));
      setDone(`Upgraded to ${names.length > 2 ? `${names.length} new versions` : names.join(" and ")}.`);
      track("version_notice", { action: "upgrade", pairs: items.length });
    } catch (e) {
      console.error("Version upgrade failed", e);
      setError("Could not save the upgrade. Try again.");
    } finally { setBusy(false); }
  };
  const dismiss = () => { settle(items.map((i) => i.key)); track("version_notice", { action: "dismiss", pairs: items.length }); };
  const turnOff = () => { setNoticesOn(false); track("version_notice", { action: "off" }); };
  const body = hidden ? null : done
    ? <div className="version-notice" data-testid="version-notice"><p>{done}</p></div>
    : copy && <div className="version-notice" data-testid="version-notice" onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); dismiss(); } }}>
      <button type="button" className="version-notice-close" aria-label="Dismiss" title="Dismiss" onClick={dismiss}><IconX size={15} stroke={1.5} aria-hidden="true" /></button>
      <p className="version-notice-text"><span className="text-ink">{copy.lead}</span> {copy.detail}</p>
      {error && <p className="version-notice-error">{error}</p>}
      <div className="version-notice-actions">
        <button type="button" className="btn" disabled={busy} aria-busy={busy} onClick={upgrade}>{busy ? "Upgrading…" : "Upgrade"}</button>
        <button type="button" className="version-notice-off" onClick={turnOff}>Turn off update notices</button>
      </div>
    </div>;
  return <>
    {probe && <PageProbe handle={page?.handle} onMine={setMine} />}
    {/* The live region stays mounted so screen readers hear the notice when it arrives. */}
    <div role="status" aria-live="polite" aria-label="Benchmark updates">{body}</div>
  </>;
}

/** The signed-in user's page indices, saved back through `profiles.update` (the same mutation the page editor uses). */
function PageProbe({ handle, onMine }: { handle?: string; onMine: (mine: Mine | null) => void }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const mine = useQuery(api.profiles.mine, isAuthenticated ? {} : "skip");
  const update = useMutation(api.profiles.update);
  useEffect(() => {
    if (isLoading || (isAuthenticated && mine === undefined)) return;
    if (!mine || (handle && mine.handle !== handle)) { onMine(null); return; }
    const indices = mine.indices as IndexConfig[];
    onMine({ indices, save: (upgrades) => update({ patch: { indices: indices.map((i) => storableIndex(upgradeIndex(i, upgrades.get(i.id) ?? []))) } }) });
  }, [isLoading, isAuthenticated, mine, handle, update, onMine]);
  return null;
}
