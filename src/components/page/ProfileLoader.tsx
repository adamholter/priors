"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Snapshot } from "@/data/types";
import { mergeImports } from "@/lib/import";
import { findTab } from "@/lib/page-layout";
import { presetStyle, resolveAccent, resolvePreset } from "@/lib/page-presets";
import { useTheme } from "../Theme";
import { Wordmark } from "../Wordmark";
import { IndexPage, type Profile } from "./IndexPage";
import { snapshotVersionChanged } from "./profile-version";

/** Render the profile identity immediately, then load calculation rows for its charts. */
export function ProfileLoader({ profile, version, edit, tab, linkedHighlight, linkedView, leaders }: {
  profile: Profile; version: string; edit: boolean; tab?: string; linkedHighlight?: string; linkedView?: string;
  leaders: { name: string; score: number }[];
}) {
  const { dark: siteDark } = useTheme();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const currentVersion = useRef(version);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/snapshot?view=core&version=${encodeURIComponent(version)}`, { signal: controller.signal })
      .then(async (response) => {
        // New data was published after this page rendered: the page's own numbers are from the old
        // snapshot, so reload it (once) instead of showing an error.
        if (response.status === 409 && reloadForNewData()) return null;
        if (!response.ok) throw new Error(response.status === 409 ? "Benchmark data changed. Please reload the page." : "Could not load benchmark data.");
        const payload = await response.json();
        return payload.snapshot as Snapshot;
      })
      .then((data) => {
        if (!data) return;
        if (data.generatedAt !== version) throw new Error("Benchmark data changed. Please reload the page.");
        if (!controller.signal.aborted) setSnapshot(mergeImports(data, profile.imports ?? []).snapshot);
      })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load benchmark data."); });
    return () => controller.abort();
  }, [version, profile.imports, retry]);
  useEffect(() => {
    let checking = false;
    let loading = false;
    let disposed = false;
    let controller: AbortController | undefined;
    const loadLatest = async () => {
      if (loading || disposed) return;
      loading = true;
      controller = new AbortController();
      try {
        const response = await fetch("/api/snapshot?view=core", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json();
        if (!controller.signal.aborted && snapshotVersionChanged(currentVersion.current, payload.snapshot?.generatedAt)) {
          currentVersion.current = payload.snapshot.generatedAt;
          setSnapshot(mergeImports(payload.snapshot as Snapshot, profile.imports ?? []).snapshot);
        }
      } catch { /* Keep the current page if a background refresh fails. */ }
      finally { loading = false; }
    };
    const checkVersion = async () => {
      if (document.visibilityState !== "visible" || checking || disposed) return;
      checking = true;
      try {
        const response = await fetch("/api/snapshot?view=meta", { cache: "no-store" });
        if (!response.ok) return;
        const meta = await response.json();
        if (snapshotVersionChanged(currentVersion.current, meta.generatedAt)) await loadLatest();
      } catch { /* A later visibility or timer check can retry. */ }
      finally { checking = false; }
    };
    const interval = window.setInterval(checkVersion, 30 * 60 * 1000);
    document.addEventListener("visibilitychange", checkVersion);
    return () => { disposed = true; window.clearInterval(interval); document.removeEventListener("visibilitychange", checkVersion); controller?.abort(); };
  }, [version, profile.imports]);
  if (snapshot) return <IndexPage profile={profile} snapshot={snapshot} edit={edit} tab={tab} linkedHighlight={linkedHighlight} linkedView={linkedView} />;
  const preset = resolvePreset(profile.theme, siteDark);
  const surface = preset.bg;
  return <div className="page-root min-h-screen" data-dark={preset.dark || undefined} style={presetStyle(preset, resolveAccent(profile.theme, preset)) as React.CSSProperties}>
    <header className="flex items-center px-4 sm:px-8 h-12 sm:min-h-14 border-b hairline" style={{ background: surface }}><Wordmark /><div className="ml-auto load-bar w-24 h-6" /></header>
    {profile.bannerUrl && <div className="page-banner-frame"><img src={profile.bannerUrl} alt="" className="page-banner" /></div>}
    <main className={`max-w-[1100px] mx-auto px-5 sm:px-8 grid gap-10 ${profile.bannerUrl ? "pb-12" : "py-8 sm:py-12"}`} aria-busy={!error}>
      <section className={`flex items-start gap-4 sm:gap-5 ${profile.bannerUrl ? "-mt-8 sm:-mt-10" : ""}`}>
        {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shrink-0" style={{ boxShadow: `0 0 0 4px ${surface}` }} /> : <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-hair-2 grid place-items-center serif text-3xl text-ink-2 shrink-0" style={{ boxShadow: `0 0 0 4px ${surface}` }}>{profile.displayName[0]}</div>}
        <div className={`grid gap-1 min-w-0 ${profile.bannerUrl ? "pt-9 sm:pt-11" : ""}`}><h1 className="text-[28px] sm:text-[34px] leading-tight">{profile.displayName}</h1><p className="text-[13px] text-grey">mypriors.com/{profile.handle}</p>{profile.bio && <p className="text-[15px] text-ink-2 mt-1">{profile.bio}</p>}</div>
      </section>
      <section><div className="flex items-center justify-between gap-3 mb-4"><h2 className="text-[21px] sm:text-[24px]">{(findTab(profile.indices, tab) ?? profile.indices[0])?.name ?? "Rankings"}</h2><Link href="/" className="text-[12px] text-ink-2 underline">Build your own</Link></div>
        {leaders.length ? <ol className="grid gap-2 text-[13px]">{leaders.map((r, i) => <li key={`${i}-${r.name}`} className="grid grid-cols-[28px_minmax(0,1fr)_48px] gap-3"><span className="cap text-right">{i + 1}</span><span className="truncate">{r.name}</span><span className="num text-right">{r.score.toFixed(1)}</span></li>)}</ol> : <div className="load-bar w-full h-48" />}
      </section>
      <div className="load-bar w-full h-48" />
      <div role="status" className="text-[12px] text-grey">{error ? <>{error} <button type="button" className="underline" onClick={() => { setError(""); setRetry((n) => n + 1); }}>Retry</button></> : "Loading charts…"}</div>
    </main>
  </div>;
}

/** Reloads the page for newly published data, at most once a minute per page so a stale cache can't loop. */
function reloadForNewData() {
  try {
    const key = `priors:reloaded:${location.pathname}`, last = Number(sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(key, String(Date.now()));
  } catch { return false; }
  location.reload();
  return true;
}
